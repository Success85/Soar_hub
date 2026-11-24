import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { hashPassword } from "@/lib/auth/password";
import { revokeAllSessions } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  answerBankEmbeddings,
  answerBankEntries,
  applicationMilestones,
  applications,
  consents,
  dataRequests,
  documents,
  documentVersions,
  eligibilityAssessments,
  eligibilityResults,
  essays,
  essayFeedback,
  essayVersions,
  notificationPreferences,
  notifications,
  profiles,
  refereeRequests,
  savedScholarships,
  users,
} from "@/lib/db/schema";
import { idempotencyKey } from "@/lib/engine/notification-keys";
import { AppError, NotFoundError } from "@/lib/errors";
import { storage } from "@/lib/integrations/storage";
import { audit } from "./audit";
import { enqueueNotification } from "./notifications";
import { rateLimit } from "./rate-limit";

/** NDPR right of access: a machine-readable JSON export of the applicant's personal data. */
export async function buildExport(userId: string) {
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u) throw new NotFoundError("Account");
  const apps = await db.select().from(applications).where(eq(applications.userId, userId));
  const appIds = apps.map((a) => a.id);
  const docs = await db.select().from(documents).where(eq(documents.userId, userId));
  const essayRows = await db.select().from(essays).where(eq(essays.userId, userId));
  const essayIds = essayRows.map((e) => e.id);
  const assessments = await db.select().from(eligibilityAssessments).where(eq(eligibilityAssessments.userId, userId));
  return {
    exportedAt: new Date().toISOString(),
    notice: "This export contains the personal data SOAR Hub holds about you. Uploaded files are listed by name; download them from your Documents workspace.",
    account: { id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName, createdAt: u.createdAt, emailVerifiedAt: u.emailVerifiedAt, lastLoginAt: u.lastLoginAt },
    profile: (await db.select().from(profiles).where(eq(profiles.userId, userId)))[0] ?? null,
    consents: await db.select().from(consents).where(eq(consents.userId, userId)),
    notificationPreferences: (await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId)))[0] ?? null,
    savedScholarships: await db.select().from(savedScholarships).where(eq(savedScholarships.userId, userId)),
    eligibilityAssessments: assessments,
    eligibilityResults: assessments.length ? await db.select().from(eligibilityResults).where(inArray(eligibilityResults.assessmentId, assessments.map((a) => a.id))) : [],
    applications: apps,
    milestones: appIds.length ? await db.select().from(applicationMilestones).where(inArray(applicationMilestones.applicationId, appIds)) : [],
    documents: docs,
    documentVersions: docs.length ? (await db.select().from(documentVersions).where(inArray(documentVersions.documentId, docs.map((d) => d.id)))).map(({ storageKey: _k, extractedText: _t, ...v }) => (void _k, void _t, v)) : [],
    essays: essayRows,
    essayVersions: essayIds.length ? await db.select().from(essayVersions).where(inArray(essayVersions.essayId, essayIds)) : [],
    essayFeedback: essayIds.length ? await db.select().from(essayFeedback).where(inArray(essayFeedback.essayId, essayIds)) : [],
    answerBank: await db.select().from(answerBankEntries).where(eq(answerBankEntries.userId, userId)),
    refereeRequests: (await db.select().from(refereeRequests).where(eq(refereeRequests.applicantId, userId))).map(({ tokenHash: _h, ...r }) => (void _h, r)),
    notifications: (await db.select().from(notifications).where(eq(notifications.userId, userId))).map(({ actionUrl: _a, ...n }) => (void _a, n)),
  };
}

export async function requestExport(userId: string) {
  await rateLimit(`export:${userId}`, 3, 86400);
  const data = await buildExport(userId);
  const key = `exports/${userId}/${Date.now()}-${randomBytes(6).toString("hex")}.json`;
  await storage().put(key, Buffer.from(JSON.stringify(data, null, 2)), "application/json");
  const [row] = await db.insert(dataRequests).values({ userId, type: "export", status: "completed", exportStorageKey: key, completedAt: new Date() }).returning();
  await audit({ eventType: "privacy.export_generated", actorId: userId, targetType: "data_request", targetId: row.id });
  await enqueueNotification({ templateKey: "account.export_ready", channel: "in_app", userId, idempotencyKey: idempotencyKey(["export", row.id]), vars: {}, actionUrl: "/settings" });
  return row;
}

export async function exportDownloadUrl(userId: string, requestId: string) {
  const [r] = await db.select().from(dataRequests).where(and(eq(dataRequests.id, requestId), eq(dataRequests.userId, userId), eq(dataRequests.type, "export"))).limit(1);
  if (!r?.exportStorageKey) throw new NotFoundError("Export");
  if (r.completedAt && Date.now() - r.completedAt.getTime() > 7 * 86_400_000) throw new AppError("This export has expired. Please generate a new one.", 410);
  return storage().signedUrl(r.exportStorageKey, { expiresInSeconds: 120, filename: "soar-hub-data-export.json", contentType: "application/json" });
}

export async function requestDeletion(userId: string, reason: string | null) {
  const pending = await db.select().from(dataRequests).where(and(eq(dataRequests.userId, userId), eq(dataRequests.type, "deletion"), inArray(dataRequests.status, ["pending", "processing"]))).limit(1);
  if (pending[0]) return pending[0];
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const [row] = await db.insert(dataRequests).values({ userId, type: "deletion", reason: reason?.slice(0, 2000) ?? null }).returning();
  await db.update(users).set({ status: "deletion_requested", updatedAt: new Date() }).where(eq(users.id, userId));
  await audit({ eventType: "privacy.deletion_requested", actorId: userId, targetType: "data_request", targetId: row.id });
  await enqueueNotification({ templateKey: "account.deletion_requested", channel: "email", userId, recipientEmail: u.email, transactional: true, idempotencyKey: idempotencyKey(["deletion", row.id]), vars: { firstName: u.firstName } });
  await revokeAllSessions(userId);
  return row;
}

export async function listDataRequests(status?: string) {
  return db
    .select({ r: dataRequests, u: { firstName: users.firstName, lastName: users.lastName, email: users.email } })
    .from(dataRequests)
    .innerJoin(users, eq(users.id, dataRequests.userId))
    .where(status ? eq(dataRequests.status, status as never) : undefined)
    .orderBy(desc(dataRequests.requestedAt))
    .limit(200);
}

export async function userDataRequests(userId: string) {
  return db.select().from(dataRequests).where(eq(dataRequests.userId, userId)).orderBy(desc(dataRequests.requestedAt)).limit(20);
}

/**
 * Processes an erasure request: personal data is erased or anonymised; records needed for
 * audit/legal retention (applications, audit log, document version metadata) are kept but de-identified.
 */
export async function processDeletion(requestId: string, actorId: string, decision: "complete" | "reject", notes: string | null) {
  const [r] = await db.select().from(dataRequests).where(eq(dataRequests.id, requestId)).limit(1);
  if (!r || r.type !== "deletion") throw new NotFoundError("Request");
  if (r.status === "completed" || r.status === "rejected") throw new AppError("This request has already been processed.", 409);
  if (decision === "reject") {
    await db.update(dataRequests).set({ status: "rejected", processedBy: actorId, notes, completedAt: new Date() }).where(eq(dataRequests.id, requestId));
    await db.update(users).set({ status: "active" }).where(and(eq(users.id, r.userId), eq(users.status, "deletion_requested")));
    await audit({ eventType: "privacy.deletion_rejected", actorId, actorRole: "admin", targetType: "data_request", targetId: requestId, metadata: { notes } });
    return;
  }
  const uid = r.userId;
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ email: `deleted+${uid}@deleted.invalid`, firstName: "Deleted", lastName: "User", passwordHash: await hashPassword(randomBytes(32).toString("hex")), status: "deleted", deletedAt: new Date(), emailVerifiedAt: null, updatedAt: new Date() })
      .where(eq(users.id, uid));
    await tx.delete(profiles).where(eq(profiles.userId, uid));
    await tx.insert(profiles).values({ userId: uid });
    await tx.delete(answerBankEmbeddings).where(eq(answerBankEmbeddings.userId, uid));
    await tx.delete(answerBankEntries).where(eq(answerBankEntries.userId, uid));
    await tx.delete(savedScholarships).where(eq(savedScholarships.userId, uid));
    await tx.update(essays).set({ body: "", prompt: "", title: "[deleted]", deletedAt: new Date() }).where(eq(essays.userId, uid));
    await tx.update(essayVersions).set({ body: "", prompt: "", title: "[deleted]" }).where(inArray(essayVersions.essayId, tx.select({ id: essays.id }).from(essays).where(eq(essays.userId, uid))));
    await tx.update(documents).set({ deletedAt: new Date(), title: "[deleted]" }).where(eq(documents.userId, uid));
    await tx.update(documentVersions).set({ extractedText: null, originalFilename: "deleted" }).where(inArray(documentVersions.documentId, tx.select({ id: documents.id }).from(documents).where(eq(documents.userId, uid))));
    await tx.update(refereeRequests).set({ refereeName: "[deleted]", refereeEmail: "deleted@deleted.invalid", message: null, status: "cancelled" }).where(eq(refereeRequests.applicantId, uid));
    await tx.update(notifications).set({ recipientEmail: null, recipientPhone: null, body: "[deleted]", data: null, actionUrl: null }).where(eq(notifications.userId, uid));
    await tx.update(dataRequests).set({ status: "completed", processedBy: actorId, notes, completedAt: new Date() }).where(eq(dataRequests.id, requestId));
    await audit({ eventType: "privacy.deletion_completed", actorId, actorRole: "admin", targetType: "user", targetId: uid, metadata: { requestId, notes } }, tx);
  });
  await revokeAllSessions(uid);
}
