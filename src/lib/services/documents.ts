import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import type { CurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { db, type DbOrTx } from "@/lib/db";
import { documentCommentAnchors, documentComments, documentReviews, documents, documentVersions, reviewerAssignments, scholarships, users, applications } from "@/lib/db/schema";
import { idempotencyKey } from "@/lib/engine/notification-keys";
import { KIND_INFO, safeFilename, validateUpload, type FileKind } from "@/lib/engine/file-validation";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { scanBuffer } from "@/lib/integrations/malware";
import { storage } from "@/lib/integrations/storage";
import { isAssignedReviewer } from "./access";
import { audit } from "./audit";
import { enqueueNotification } from "./notifications";
import { getSettings } from "./settings";

export type DocumentCategory = (typeof documents.$inferSelect)["category"];
export type ReviewStatus = (typeof documents.$inferSelect)["reviewStatus"];

export async function uploadLimits(kinds?: FileKind[]) {
  const s = await getSettings();
  const allowed = (kinds ?? (s.allowed_file_types as FileKind[])).filter((k) => k in KIND_INFO);
  return { maxBytes: Number(s.upload_max_mb) * 1024 * 1024, allowed, maxMb: Number(s.upload_max_mb) };
}

async function extractText(buf: Buffer, kind: FileKind): Promise<string | null> {
  try {
    if (kind === "docx") {
      const mammoth = await import("mammoth");
      const out = await mammoth.extractRawText({ buffer: buf });
      return out.value.slice(0, 200_000);
    }
    if (kind === "pdf") {
      const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const { text } = await pdfText(pdf, { mergePages: true });
      return (Array.isArray(text) ? text.join("\n") : text).slice(0, 200_000);
    }
  } catch (e) {
    console.warn(JSON.stringify({ level: "warn", msg: "text extraction failed", kind, error: String(e) }));
  }
  return null;
}

export interface StoredFile {
  key: string;
  kind: FileKind;
  mime: string;
  size: number;
  sha256: string;
  scan: "clean" | "not_scanned" | "error";
  text: string | null;
  filename: string;
}

/** Validates, scans and stores a file in private storage. Never overwrites an existing object. */
export async function storeValidatedFile(file: File, prefix: string, kinds?: FileKind[]): Promise<StoredFile> {
  const limits = await uploadLimits(kinds);
  if (file.size > limits.maxBytes) throw new AppError(`The file is too large. The maximum size is ${limits.maxMb} MB.`, 413);
  const buf = Buffer.from(await file.arrayBuffer());
  const v = validateUpload({ filename: file.name, declaredMime: file.type, size: buf.length, bytes: buf, maxBytes: limits.maxBytes, allowed: limits.allowed });
  if (!v.ok) throw new AppError(v.error, 400, "invalid_file");
  const scan = await scanBuffer(buf);
  if (scan === "infected") throw new AppError("This file failed our security scan and was not uploaded.", 400, "infected");
  const ext = KIND_INFO[v.kind].extensions[0];
  const key = `${prefix}/${randomUUID()}.${ext}`;
  await storage().put(key, buf, v.mime);
  return { key, kind: v.kind, mime: v.mime, size: buf.length, sha256: createHash("sha256").update(buf).digest("hex"), scan, text: await extractText(buf, v.kind), filename: safeFilename(file.name) };
}

export async function createVersion(
  tx: DbOrTx,
  documentId: string,
  stored: StoredFile,
  uploader: { id: string | null; via: "applicant" | "referee" | "admin" | "reviewer" },
): Promise<typeof documentVersions.$inferSelect> {
  const [doc] = await tx.select().from(documents).where(eq(documents.id, documentId)).for("update").limit(1);
  if (!doc) throw new NotFoundError("Document");
  const versionNumber = doc.currentVersion + 1;
  const [v] = await tx
    .insert(documentVersions)
    .values({
      documentId,
      versionNumber,
      storageKey: stored.key,
      originalFilename: stored.filename,
      sizeBytes: stored.size,
      mimeType: stored.mime,
      sha256: stored.sha256,
      uploadedBy: uploader.id,
      uploadedVia: uploader.via,
      scanStatus: stored.scan,
      extractedText: stored.text,
      reviewStatus: "uploaded",
    })
    .returning();
  await tx.update(documents).set({ currentVersion: versionNumber, reviewStatus: "uploaded", updatedAt: new Date() }).where(eq(documents.id, documentId));
  return v;
}

export interface UploadInput {
  file: File;
  category: DocumentCategory;
  title?: string;
  applicationId?: string | null;
  requirementId?: string | null;
  documentId?: string | null; // upload a new version into an existing slot
}

export async function uploadDocument(user: CurrentUser, input: UploadInput) {
  let doc: typeof documents.$inferSelect | undefined;
  if (input.documentId) {
    [doc] = await db.select().from(documents).where(eq(documents.id, input.documentId)).limit(1);
    if (!doc || doc.userId !== user.id || doc.deletedAt) throw new NotFoundError("Document");
  }
  if (input.applicationId) {
    const [app] = await db.select().from(applications).where(eq(applications.id, input.applicationId)).limit(1);
    if (!app || app.userId !== user.id) throw new NotFoundError("Application");
    if (["submitted", "shortlisted", "outcome"].includes(app.status)) throw new AppError("This application has been submitted; its documents are locked.", 409);
  }
  const stored = await storeValidatedFile(input.file, `users/${user.id}/documents`);
  const result = await db.transaction(async (tx) => {
    let documentId = doc?.id;
    if (!documentId) {
      const [created] = await tx
        .insert(documents)
        .values({ userId: user.id, category: input.category, title: (input.title?.trim() || stored.filename).slice(0, 200), applicationId: input.applicationId ?? null, requirementId: input.requirementId ?? null })
        .returning();
      documentId = created.id;
    }
    const version = await createVersion(tx, documentId, stored, { id: user.id, via: "applicant" });
    await audit({ eventType: doc ? "document.version_uploaded" : "document.uploaded", actorId: user.id, actorRole: "applicant", targetType: "document", targetId: documentId, metadata: { version: version.versionNumber, size: stored.size, mime: stored.mime, scan: stored.scan } }, tx);
    return { documentId, version };
  });
  const appId = input.applicationId ?? doc?.applicationId;
  if (appId) {
    const { recomputeProgress } = await import("./planner");
    await recomputeProgress(appId);
  }
  const { recalculateForProfileChange } = await import("./eligibility");
  await recalculateForProfileChange(user.id, ["__documents__"]);
  return result;
}

/** Who may see a document: the owner, admins with permission, or a reviewer assigned to its application. */
export async function documentAccess(user: CurrentUser, documentId: string): Promise<{ doc: typeof documents.$inferSelect; access: "owner" | "admin" | "reviewer" }> {
  const [doc] = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
  if (!doc) throw new NotFoundError("Document");
  if (doc.userId === user.id && !doc.deletedAt) return { doc, access: "owner" };
  if (can(user.permissions, "reviews.documents") || can(user.permissions, "applicants.view")) return { doc, access: "admin" };
  if (doc.applicationId && can(user.permissions, "reviewer.access") && (await isAssignedReviewer(user.id, doc.applicationId))) return { doc, access: "reviewer" };
  throw new NotFoundError("Document");
}

export async function signedDownloadUrl(user: CurrentUser, versionId: string, inline = false): Promise<string> {
  const [v] = await db.select().from(documentVersions).where(eq(documentVersions.id, versionId)).limit(1);
  if (!v) throw new NotFoundError("File");
  const { access } = await documentAccess(user, v.documentId);
  if (access !== "owner") {
    await audit({ eventType: "document.accessed", actorId: user.id, actorRole: access, targetType: "document_version", targetId: versionId, metadata: { documentId: v.documentId } });
  }
  return storage().signedUrl(v.storageKey, { expiresInSeconds: 120, filename: v.originalFilename, contentType: v.mimeType, inline });
}

export async function documentDetail(documentId: string) {
  const [doc] = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
  if (!doc) throw new NotFoundError("Document");
  const versions = await db.select().from(documentVersions).where(eq(documentVersions.documentId, documentId)).orderBy(desc(documentVersions.versionNumber));
  const comments = await db
    .select({ c: documentComments, a: documentCommentAnchors, author: { firstName: users.firstName, lastName: users.lastName } })
    .from(documentComments)
    .innerJoin(documentVersions, eq(documentVersions.id, documentComments.documentVersionId))
    .leftJoin(documentCommentAnchors, eq(documentCommentAnchors.commentId, documentComments.id))
    .innerJoin(users, eq(users.id, documentComments.authorId))
    .where(eq(documentVersions.documentId, documentId))
    .orderBy(asc(documentComments.createdAt));
  const reviews = await db
    .select({ r: documentReviews, reviewer: { firstName: users.firstName, lastName: users.lastName } })
    .from(documentReviews)
    .innerJoin(documentVersions, eq(documentVersions.id, documentReviews.documentVersionId))
    .innerJoin(users, eq(users.id, documentReviews.reviewerId))
    .where(eq(documentVersions.documentId, documentId))
    .orderBy(desc(documentReviews.createdAt));
  let app: { id: string; scholarshipName: string } | null = null;
  if (doc.applicationId) {
    const [a] = await db.select({ id: applications.id, scholarshipName: scholarships.name }).from(applications).innerJoin(scholarships, eq(scholarships.id, applications.scholarshipId)).where(eq(applications.id, doc.applicationId)).limit(1);
    app = a ?? null;
  }
  return { doc, versions, comments, reviews, app };
}

export async function listDocumentsForUser(userId: string) {
  return db
    .select({ d: documents, scholarshipName: scholarships.name })
    .from(documents)
    .leftJoin(applications, eq(applications.id, documents.applicationId))
    .leftJoin(scholarships, eq(scholarships.id, applications.scholarshipId))
    .where(and(eq(documents.userId, userId), isNull(documents.deletedAt)))
    .orderBy(desc(documents.updatedAt));
}

export async function renameDocument(user: CurrentUser, documentId: string, title: string) {
  const { doc, access } = await documentAccess(user, documentId);
  if (access !== "owner") throw new ForbiddenError();
  const clean = title.trim().slice(0, 200);
  if (!clean) throw new AppError("Enter a document name.", 400);
  await db.update(documents).set({ title: clean, updatedAt: new Date() }).where(eq(documents.id, documentId));
  await audit({ eventType: "document.renamed", actorId: user.id, targetType: "document", targetId: documentId, previousState: { title: doc.title }, newState: { title: clean } });
}

/** Soft delete: versions and their files are retained for audit; the document disappears for the applicant. */
export async function deleteDocument(user: CurrentUser, documentId: string) {
  const { doc, access } = await documentAccess(user, documentId);
  if (access !== "owner") throw new ForbiddenError();
  if (doc.reviewStatus === "under_review") throw new AppError("This document is being reviewed right now and can't be deleted.", 409);
  if (doc.applicationId) {
    const [app] = await db.select().from(applications).where(eq(applications.id, doc.applicationId)).limit(1);
    if (app && ["submitted", "shortlisted", "outcome"].includes(app.status)) throw new AppError("Documents attached to a submitted application can't be deleted.", 409);
  }
  await db.update(documents).set({ deletedAt: new Date() }).where(eq(documents.id, documentId));
  await audit({ eventType: "document.deleted", actorId: user.id, targetType: "document", targetId: documentId });
}

export async function requestDocumentReview(user: CurrentUser, documentId: string) {
  const { doc, access } = await documentAccess(user, documentId);
  if (access !== "owner") throw new ForbiddenError();
  if (doc.currentVersion === 0) throw new AppError("Upload a file first.", 400);
  if (!doc.applicationId) throw new AppError("Attach this document to an application so a reviewer can be assigned.", 400);
  await db.transaction(async (tx) => {
    await tx.update(documents).set({ reviewStatus: "pending_review", updatedAt: new Date() }).where(eq(documents.id, documentId));
    await tx.update(documentVersions).set({ reviewStatus: "pending_review" }).where(and(eq(documentVersions.documentId, documentId), eq(documentVersions.versionNumber, doc.currentVersion)));
    await audit({ eventType: "document.review_requested", actorId: user.id, targetType: "document", targetId: documentId, metadata: { version: doc.currentVersion } }, tx);
  });
  const reviewers = await db.select({ reviewerId: reviewerAssignments.reviewerId }).from(reviewerAssignments).where(and(eq(reviewerAssignments.applicationId, doc.applicationId), eq(reviewerAssignments.isActive, true)));
  for (const r of reviewers) {
    await enqueueNotification({ templateKey: "review.queue_item", channel: "in_app", userId: r.reviewerId, idempotencyKey: idempotencyKey(["doc-review-req", documentId, doc.currentVersion, r.reviewerId]), vars: { itemType: "Document", applicantName: `${user.firstName} ${user.lastName}`, itemTitle: doc.title }, actionUrl: `/reviewer/documents/${documentId}` });
  }
}

async function assertReviewer(user: CurrentUser, documentId: string) {
  const { doc, access } = await documentAccess(user, documentId);
  if (access === "owner") throw new ForbiddenError("You can't review your own document.");
  if (access === "admin" && !can(user.permissions, "reviews.documents")) throw new ForbiddenError();
  return doc;
}

export async function startReview(user: CurrentUser, versionId: string) {
  const [v] = await db.select().from(documentVersions).where(eq(documentVersions.id, versionId)).limit(1);
  if (!v) throw new NotFoundError("Version");
  const doc = await assertReviewer(user, v.documentId);
  await db.update(documentVersions).set({ reviewStatus: "under_review" }).where(eq(documentVersions.id, versionId));
  if (doc.currentVersion === v.versionNumber) await db.update(documents).set({ reviewStatus: "under_review" }).where(eq(documents.id, doc.id));
  await audit({ eventType: "document.review_started", actorId: user.id, actorRole: "reviewer", targetType: "document_version", targetId: versionId });
}

export async function decideReview(user: CurrentUser, versionId: string, decision: "approved" | "needs_revision" | "rejected", summary: string | null) {
  const [v] = await db.select().from(documentVersions).where(eq(documentVersions.id, versionId)).limit(1);
  if (!v) throw new NotFoundError("Version");
  const doc = await assertReviewer(user, v.documentId);
  await db.transaction(async (tx) => {
    await tx.insert(documentReviews).values({ documentVersionId: versionId, reviewerId: user.id, decision, summary: summary?.slice(0, 5000) ?? null });
    await tx.update(documentVersions).set({ reviewStatus: decision }).where(eq(documentVersions.id, versionId));
    if (doc.currentVersion === v.versionNumber) await tx.update(documents).set({ reviewStatus: decision, updatedAt: new Date() }).where(eq(documents.id, doc.id));
    await audit({ eventType: "document.reviewed", actorId: user.id, actorRole: "reviewer", targetType: "document_version", targetId: versionId, previousState: { status: v.reviewStatus }, newState: { status: decision } }, tx);
  });
  const label = { approved: "Approved", needs_revision: "Needs revision", rejected: "Rejected" }[decision];
  for (const channel of ["email", "in_app"] as const) {
    await enqueueNotification({ templateKey: "review.document_completed", channel, userId: doc.userId, idempotencyKey: idempotencyKey(["doc-reviewed", versionId, decision, channel]), vars: { firstName: (await userFirstName(doc.userId)) ?? "", documentTitle: doc.title, status: label }, actionUrl: `/documents/${doc.id}` });
  }
  if (doc.applicationId) {
    const { recomputeProgress } = await import("./planner");
    await recomputeProgress(doc.applicationId);
  }
}

async function userFirstName(id: string) {
  const [u] = await db.select({ f: users.firstName }).from(users).where(eq(users.id, id)).limit(1);
  return u?.f;
}

export interface AnchorInput {
  selectedText: string;
  startOffset: number | null;
  endOffset: number | null;
}

/** Adds a comment to a specific version; anchored comments must match that version's text exactly. */
export async function addDocumentComment(user: CurrentUser, versionId: string, body: string, anchor: AnchorInput | null) {
  const [v] = await db.select().from(documentVersions).where(eq(documentVersions.id, versionId)).limit(1);
  if (!v) throw new NotFoundError("Version");
  await assertReviewer(user, v.documentId);
  const text = body.trim();
  if (!text) throw new AppError("Write a comment first.", 400);
  let anchorRow: Omit<typeof documentCommentAnchors.$inferInsert, "commentId"> | null = null;
  if (anchor && anchor.selectedText.trim()) {
    const source = v.extractedText ?? "";
    let start = anchor.startOffset;
    let end = anchor.endOffset;
    if (start === null || end === null || source.slice(start, end) !== anchor.selectedText) {
      const idx = source.indexOf(anchor.selectedText);
      if (idx < 0) throw new AppError("The highlighted passage wasn't found in this version of the document.", 400);
      start = idx;
      end = idx + anchor.selectedText.length;
    }
    anchorRow = { documentVersionId: versionId, selectedText: anchor.selectedText.slice(0, 2000), startOffset: start, endOffset: end, contextBefore: source.slice(Math.max(0, start - 40), start), contextAfter: source.slice(end, end + 40) };
  }
  const id = await db.transaction(async (tx) => {
    const [c] = await tx.insert(documentComments).values({ documentVersionId: versionId, authorId: user.id, body: text.slice(0, 5000) }).returning({ id: documentComments.id });
    if (anchorRow) await tx.insert(documentCommentAnchors).values({ ...anchorRow, commentId: c.id });
    await audit({ eventType: "document.comment_added", actorId: user.id, actorRole: "reviewer", targetType: "document_version", targetId: versionId, metadata: { commentId: c.id, anchored: !!anchorRow } }, tx);
    return c.id;
  });
  return id;
}

export async function setCommentStatus(user: CurrentUser, commentId: string, status: "outstanding" | "resolved") {
  const [row] = await db.select({ c: documentComments, v: documentVersions }).from(documentComments).innerJoin(documentVersions, eq(documentVersions.id, documentComments.documentVersionId)).where(eq(documentComments.id, commentId)).limit(1);
  if (!row) throw new NotFoundError("Comment");
  await documentAccess(user, row.v.documentId); // owner, assigned reviewer or admin
  await db.update(documentComments).set({ status, resolvedBy: status === "resolved" ? user.id : null, resolvedAt: status === "resolved" ? new Date() : null, updatedAt: new Date() }).where(eq(documentComments.id, commentId));
  await audit({ eventType: `document.comment_${status}`, actorId: user.id, targetType: "document_comment", targetId: commentId });
}

export async function documentReviewQueue(user: CurrentUser, opts: { status?: string } = {}) {
  const all = can(user.permissions, "reviews.documents");
  const statuses = opts.status ? [opts.status] : ["pending_review", "under_review"];
  const rows = await db.execute<{
    id: string; title: string; category: string; current_version: number; review_status: string; updated_at: string;
    first_name: string; last_name: string; scholarship_name: string | null; application_id: string | null; reviewer_names: string | null;
  }>(sql`
    SELECT d.id, d.title, d.category, d.current_version, d.review_status, d.updated_at,
           u.first_name, u.last_name, s.name AS scholarship_name, d.application_id,
           (SELECT string_agg(ru.first_name || ' ' || ru.last_name, ', ') FROM reviewer_assignments ra JOIN users ru ON ru.id = ra.reviewer_id
             WHERE ra.application_id = d.application_id AND ra.is_active) AS reviewer_names
    FROM application_documents d
    JOIN users u ON u.id = d.user_id
    LEFT JOIN applications a ON a.id = d.application_id
    LEFT JOIN scholarships s ON s.id = a.scholarship_id
    WHERE d.deleted_at IS NULL AND d.review_status::text IN ${statuses}
      AND (${all}::boolean OR EXISTS (SELECT 1 FROM reviewer_assignments ra WHERE ra.application_id = d.application_id AND ra.reviewer_id = ${user.id} AND ra.is_active))
    ORDER BY d.updated_at ASC LIMIT 200`);
  return [...rows];
}
