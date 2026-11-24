import "server-only";
import { and, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { z } from "zod";
import type { CurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { generateToken, hashToken, tokenState } from "@/lib/auth/tokens";
import { db } from "@/lib/db";
import { applications, documents, refereeRequests, refereeUploads, scholarshipDocumentRequirements, scholarships, users } from "@/lib/db/schema";
import { idempotencyKey } from "@/lib/engine/notification-keys";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import type { RequestMeta } from "@/lib/request";
import { audit } from "./audit";
import { createVersion, storeValidatedFile, uploadLimits } from "./documents";
import { appUrl, dispatchNow, enqueueNotification } from "./notifications";
import { rateLimit } from "./rate-limit";
import { getSettings } from "./settings";

export const refereeSchema = z.object({
  applicationId: z.string().uuid(),
  refereeName: z.string().trim().min(2, "Enter the referee's name").max(200),
  refereeEmail: z.string().trim().toLowerCase().email("Enter a valid email").max(320),
  relationship: z.string().trim().min(2, "Describe your relationship").max(120),
  organization: z
    .string()
    .trim()
    .max(200)
    .nullish()
    .transform((v) => v || null),
  message: z
    .string()
    .trim()
    .max(3000)
    .nullish()
    .transform((v) => v || null),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a deadline"),
});

const fmtDate = (d: Date | string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });

async function sendInvitation(requestId: string, token: string) {
  const [row] = await db
    .select({ r: refereeRequests, s: scholarships, u: users })
    .from(refereeRequests)
    .innerJoin(applications, eq(applications.id, refereeRequests.applicationId))
    .innerJoin(scholarships, eq(scholarships.id, applications.scholarshipId))
    .innerJoin(users, eq(users.id, refereeRequests.applicantId))
    .where(eq(refereeRequests.id, requestId))
    .limit(1);
  const limits = await uploadLimits(["pdf", "docx"]);
  const id = await enqueueNotification({
    templateKey: "referee.invitation",
    channel: "email",
    recipientEmail: row.r.refereeEmail,
    transactional: true,
    idempotencyKey: idempotencyKey(["referee.invitation", requestId, row.r.tokenHash.slice(0, 12)]),
    vars: {
      refereeName: row.r.refereeName,
      applicantName: `${row.u.firstName} ${row.u.lastName}`,
      scholarshipName: row.s.name,
      message: row.r.message ? `Their message to you: “${row.r.message}”` : "",
      deadline: fmtDate(row.r.deadline),
      expiresAt: fmtDate(row.r.tokenExpiresAt),
      maxMb: limits.maxMb,
    },
    actionUrl: appUrl(`/referee/${token}`),
  });
  await dispatchNow(id);
}

export async function createRefereeRequest(user: CurrentUser, input: z.input<typeof refereeSchema>) {
  const data = refereeSchema.parse(input);
  await rateLimit(`referee-create:${user.id}`, 20, 86400);
  const [app] = await db.select().from(applications).where(eq(applications.id, data.applicationId)).limit(1);
  if (!app || app.userId !== user.id || app.deletedAt) throw new NotFoundError("Application");
  if (["submitted", "shortlisted", "outcome", "ineligible"].includes(app.status)) throw new AppError("You can't request new references for this application.", 409);
  if (data.refereeEmail === user.email.toLowerCase()) throw new AppError("A referee must be someone other than you.", 400, "invalid", { refereeEmail: "Use your referee's email address" });
  const today = new Date().toISOString().slice(0, 10);
  if (data.deadline < today) throw new AppError("The deadline must be in the future.", 400, "invalid", { deadline: "Choose a future date" });
  const days = Number((await getSettings()).referee_link_days) || 14;
  const token = generateToken();
  const [r] = await db
    .insert(refereeRequests)
    .values({ ...data, applicantId: user.id, tokenHash: hashToken(token), tokenExpiresAt: new Date(Date.now() + days * 86_400_000), status: "sent" })
    .returning();
  await audit({ eventType: "referee.requested", actorId: user.id, targetType: "referee_request", targetId: r.id, metadata: { applicationId: app.id, refereeEmail: data.refereeEmail } });
  await sendInvitation(r.id, token);
  return r;
}

/** Issues a fresh link (the old one stops working immediately). */
export async function resendRefereeRequest(user: CurrentUser, requestId: string) {
  const [r] = await db.select().from(refereeRequests).where(eq(refereeRequests.id, requestId)).limit(1);
  if (!r || (r.applicantId !== user.id && !can(user.permissions, "referees.manage"))) throw new NotFoundError("Request");
  if (r.status === "submitted") throw new AppError("This referee has already submitted their letter.", 409);
  await rateLimit(`referee-resend:${requestId}`, 3, 86400);
  const days = Number((await getSettings()).referee_link_days) || 14;
  const token = generateToken();
  await db.update(refereeRequests).set({ tokenHash: hashToken(token), tokenExpiresAt: new Date(Date.now() + days * 86_400_000), status: "sent", openedAt: null, cancelledAt: null, reminderSentAt: null, updatedAt: new Date() }).where(eq(refereeRequests.id, requestId));
  await audit({ eventType: "referee.link_reissued", actorId: user.id, targetType: "referee_request", targetId: requestId });
  await sendInvitation(requestId, token);
}

export async function cancelRefereeRequest(user: CurrentUser, requestId: string) {
  const [r] = await db.select().from(refereeRequests).where(eq(refereeRequests.id, requestId)).limit(1);
  if (!r) throw new NotFoundError("Request");
  if (r.applicantId !== user.id && !can(user.permissions, "referees.manage")) throw new ForbiddenError();
  if (!["sent", "opened"].includes(r.status)) throw new AppError("Only open requests can be cancelled.", 409);
  await db.update(refereeRequests).set({ status: "cancelled", cancelledAt: new Date(), cancelledBy: user.id, updatedAt: new Date() }).where(eq(refereeRequests.id, requestId));
  await audit({ eventType: "referee.revoked", actorId: user.id, actorRole: r.applicantId === user.id ? "applicant" : "admin", targetType: "referee_request", targetId: requestId });
}

export type RefereeLinkState = "valid" | "expired" | "used" | "revoked" | "invalid";

async function findByToken(token: string) {
  if (!token || token.length < 20 || token.length > 100) return null;
  const [row] = await db
    .select({ r: refereeRequests, s: scholarships, u: { firstName: users.firstName, lastName: users.lastName } })
    .from(refereeRequests)
    .innerJoin(applications, eq(applications.id, refereeRequests.applicationId))
    .innerJoin(scholarships, eq(scholarships.id, applications.scholarshipId))
    .innerJoin(users, eq(users.id, refereeRequests.applicantId))
    .where(eq(refereeRequests.tokenHash, hashToken(token)))
    .limit(1);
  return row ?? null;
}

function stateOf(r: typeof refereeRequests.$inferSelect): RefereeLinkState {
  return tokenState({ expiresAt: r.tokenExpiresAt, usedAt: r.tokenUsedAt ?? (r.status === "submitted" ? r.submittedAt : null), revokedAt: r.status === "cancelled" ? (r.cancelledAt ?? new Date()) : null });
}

/** The ONLY data a referee can see: applicant name, scholarship, instructions, deadline. */
export async function openRefereeLink(token: string, meta: RequestMeta) {
  await rateLimit(`referee-open:${meta.ip ?? "unknown"}`, 60, 3600);
  const row = await findByToken(token);
  if (!row) return { state: "invalid" as const };
  const state = stateOf(row.r);
  if (state === "expired" && row.r.status !== "expired") {
    await db.update(refereeRequests).set({ status: "expired", updatedAt: new Date() }).where(eq(refereeRequests.id, row.r.id));
  }
  if (state === "valid" && row.r.status === "sent") {
    await db.update(refereeRequests).set({ status: "opened", openedAt: new Date(), updatedAt: new Date() }).where(eq(refereeRequests.id, row.r.id));
    await audit({ eventType: "referee.opened", targetType: "referee_request", targetId: row.r.id, ...meta });
  }
  const limits = await uploadLimits(["pdf", "docx"]);
  return {
    state,
    view: {
      applicantName: `${row.u.firstName} ${row.u.lastName}`,
      scholarshipName: row.s.name,
      university: row.s.partnerUniversity,
      refereeName: row.r.refereeName,
      message: row.r.message,
      deadline: row.r.deadline,
      expiresAt: row.r.tokenExpiresAt.toISOString(),
      maxMb: limits.maxMb,
    },
  };
}

/** Single-use upload: the request row is locked so concurrent submissions can't both succeed. */
export async function submitRefereeLetter(token: string, file: File, confirmedName: string, meta: RequestMeta) {
  await rateLimit(`referee-submit:${meta.ip ?? "unknown"}`, 10, 3600);
  const pre = await findByToken(token);
  if (!pre) throw new AppError("This link isn't valid.", 404, "invalid_link");
  if (stateOf(pre.r) !== "valid") throw new AppError("This link has expired or has already been used.", 410, "link_closed");
  const name = confirmedName.trim();
  if (name.length < 2) throw new AppError("Type your full name to confirm the submission.", 400, "invalid", { confirmedName: "Required" });
  const stored = await storeValidatedFile(file, `users/${pre.r.applicantId}/references`, ["pdf", "docx"]);

  const result = await db.transaction(async (tx) => {
    const [r] = await tx.select().from(refereeRequests).where(eq(refereeRequests.id, pre.r.id)).for("update").limit(1);
    if (stateOf(r) !== "valid") throw new AppError("This link has expired or has already been used.", 410, "link_closed");
    const [app] = await tx.select().from(applications).where(eq(applications.id, r.applicationId)).limit(1);
    // Fill the first recommendation-letter slot that doesn't have a letter yet (required slots first).
    const slots = await tx
      .select()
      .from(scholarshipDocumentRequirements)
      .where(and(eq(scholarshipDocumentRequirements.scholarshipId, app.scholarshipId), eq(scholarshipDocumentRequirements.category, "recommendation_letter")))
      .orderBy(desc(scholarshipDocumentRequirements.isRequired), scholarshipDocumentRequirements.sortOrder);
    const filled = new Set(
      (await tx.select({ req: documents.requirementId }).from(documents).where(and(eq(documents.applicationId, r.applicationId), isNull(documents.deletedAt)))).map((d) => d.req),
    );
    const req = slots.find((sl) => !filled.has(sl.id)) ?? slots[0];
    const [doc] = await tx
      .insert(documents)
      .values({ userId: r.applicantId, applicationId: r.applicationId, requirementId: req?.id ?? null, category: "recommendation_letter", title: `Reference letter — ${r.refereeName}`.slice(0, 200) })
      .returning();
    const version = await createVersion(tx, doc.id, stored, { id: null, via: "referee" });
    await tx.insert(refereeUploads).values({ requestId: r.id, documentVersionId: version.id, confirmedName: name.slice(0, 200), ip: meta.ip });
    await tx.update(refereeRequests).set({ status: "submitted", submittedAt: new Date(), tokenUsedAt: new Date(), documentId: doc.id, updatedAt: new Date() }).where(eq(refereeRequests.id, r.id));
    await audit({ eventType: "referee.submitted", targetType: "referee_request", targetId: r.id, metadata: { documentId: doc.id, versionId: version.id, confirmedName: name }, ...meta }, tx);
    return { request: r, documentId: doc.id };
  });

  const [applicant] = await db.select().from(users).where(eq(users.id, result.request.applicantId)).limit(1);
  const vars = { firstName: applicant.firstName, refereeName: result.request.refereeName, applicantName: `${applicant.firstName} ${applicant.lastName}`, scholarshipName: pre.s.name, submittedAt: fmtDate(new Date()) };
  for (const channel of ["email", "in_app"] as const) {
    await enqueueNotification({ templateKey: "referee.submitted", channel, userId: applicant.id, idempotencyKey: idempotencyKey(["referee.submitted", result.request.id, channel]), vars, actionUrl: `/documents/${result.documentId}` });
  }
  await enqueueNotification({ templateKey: "referee.confirmation", channel: "email", recipientEmail: result.request.refereeEmail, transactional: true, idempotencyKey: idempotencyKey(["referee.confirmation", result.request.id]), vars });
  const settings = await getSettings();
  if (settings.notify_admin_on_referee_submission && settings.admin_alert_email) {
    await enqueueNotification({ templateKey: "referee.submitted_admin", channel: "email", recipientEmail: settings.admin_alert_email, transactional: true, idempotencyKey: idempotencyKey(["referee.submitted_admin", result.request.id]), vars });
  }
  const { recomputeProgress } = await import("./planner");
  await recomputeProgress(result.request.applicationId);
  return { ok: true };
}

export async function refereesForUser(userId: string) {
  return db
    .select({ r: refereeRequests, scholarshipName: scholarships.name })
    .from(refereeRequests)
    .innerJoin(applications, eq(applications.id, refereeRequests.applicationId))
    .innerJoin(scholarships, eq(scholarships.id, applications.scholarshipId))
    .where(eq(refereeRequests.applicantId, userId))
    .orderBy(desc(refereeRequests.createdAt));
}

export async function adminReferees(status?: string) {
  return db
    .select({ r: refereeRequests, scholarshipName: scholarships.name, applicant: { firstName: users.firstName, lastName: users.lastName } })
    .from(refereeRequests)
    .innerJoin(applications, eq(applications.id, refereeRequests.applicationId))
    .innerJoin(scholarships, eq(scholarships.id, applications.scholarshipId))
    .innerJoin(users, eq(users.id, refereeRequests.applicantId))
    .where(status ? eq(refereeRequests.status, status as never) : undefined)
    .orderBy(desc(refereeRequests.createdAt))
    .limit(200);
}

/* ---------------- jobs ---------------- */

/** Reminder 7 days before link expiry when nothing has been submitted. */
export async function sendRefereeReminders(): Promise<number> {
  const due = await db
    .select({ r: refereeRequests, s: scholarships, u: users })
    .from(refereeRequests)
    .innerJoin(applications, eq(applications.id, refereeRequests.applicationId))
    .innerJoin(scholarships, eq(scholarships.id, applications.scholarshipId))
    .innerJoin(users, eq(users.id, refereeRequests.applicantId))
    .where(and(inArray(refereeRequests.status, ["sent", "opened"]), isNull(refereeRequests.reminderSentAt), sql`${refereeRequests.tokenExpiresAt} <= now() + interval '7 days'`, sql`${refereeRequests.tokenExpiresAt} > now()`));
  for (const row of due) {
    // Only a hash of the token is stored, so the reminder carries a fresh link (same expiry);
    // the earlier link stops working, which keeps exactly one valid link in circulation.
    const token = generateToken();
    await db.update(refereeRequests).set({ tokenHash: hashToken(token), reminderSentAt: new Date(), updatedAt: new Date() }).where(eq(refereeRequests.id, row.r.id));
    const nid = await enqueueNotification({
      templateKey: "referee.reminder",
      channel: "email",
      recipientEmail: row.r.refereeEmail,
      transactional: true,
      idempotencyKey: idempotencyKey(["referee.reminder", row.r.id, row.r.tokenExpiresAt.toISOString()]),
      vars: { refereeName: row.r.refereeName, applicantName: `${row.u.firstName} ${row.u.lastName}`, scholarshipName: row.s.name, expiresAt: fmtDate(row.r.tokenExpiresAt) },
      actionUrl: appUrl(`/referee/${token}`),
    });
    await dispatchNow(nid);
  }
  return due.length;
}

export async function expireRefereeLinks(): Promise<number> {
  const rows = await db
    .update(refereeRequests)
    .set({ status: "expired", updatedAt: new Date() })
    .where(and(inArray(refereeRequests.status, ["sent", "opened"]), lt(refereeRequests.tokenExpiresAt, new Date())))
    .returning();
  for (const r of rows) {
    const [u] = await db.select().from(users).where(eq(users.id, r.applicantId)).limit(1);
    const [s] = await db.select({ name: scholarships.name }).from(applications).innerJoin(scholarships, eq(scholarships.id, applications.scholarshipId)).where(eq(applications.id, r.applicationId)).limit(1);
    for (const channel of ["email", "in_app"] as const) {
      await enqueueNotification({ templateKey: "referee.expired", channel, userId: r.applicantId, idempotencyKey: idempotencyKey(["referee.expired", r.id, r.tokenExpiresAt.toISOString(), channel]), vars: { firstName: u?.firstName, refereeName: r.refereeName, scholarshipName: s?.name }, actionUrl: "/referees" });
    }
    await audit({ eventType: "referee.expired", actorRole: "system", targetType: "referee_request", targetId: r.id, ip: null });
  }
  return rows.length;
}
