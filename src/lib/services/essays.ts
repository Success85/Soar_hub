import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { z } from "zod";
import type { CurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import {
  aiCritiqueApprovals,
  aiCritiqueRequests,
  aiCritiqueResults,
  applications,
  essayFeedback,
  essayReviews,
  essayRubrics,
  essays,
  essayVersions,
  reviewerAssignments,
  scholarships,
  users,
} from "@/lib/db/schema";
import { countWords } from "@/lib/engine/file-validation";
import { idempotencyKey } from "@/lib/engine/notification-keys";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { aiStatus, checkCritiqueSafety, CRITIQUE_PROMPT_VERSION, CritiqueSchema, DEFAULT_RUBRIC, generateCritique, type Critique, type RubricDimension } from "@/lib/integrations/ai";
import { IntegrationNotConfiguredError, ProviderError } from "@/lib/integrations/errors";
import { isAssignedReviewer } from "./access";
import { audit } from "./audit";
import { enqueueNotification } from "./notifications";
import { getSettings } from "./settings";

export type Essay = typeof essays.$inferSelect;

export const essaySchema = z.object({
  title: z.string().trim().min(1, "Give your essay a title").max(250),
  prompt: z.string().trim().max(5000).default(""),
  body: z.string().max(60000).default(""),
  wordLimit: z.coerce.number().int().min(50).max(10000).nullish(),
  applicationId: z.string().uuid().nullish(),
  note: z.string().max(250).nullish(),
});

async function resolveLinks(userId: string, applicationId: string | null | undefined) {
  if (!applicationId) return { applicationId: null, scholarshipId: null };
  const [app] = await db.select().from(applications).where(eq(applications.id, applicationId)).limit(1);
  if (!app || app.userId !== userId) throw new NotFoundError("Application");
  return { applicationId: app.id, scholarshipId: app.scholarshipId };
}

export async function createEssay(user: CurrentUser, input: z.input<typeof essaySchema>) {
  const data = essaySchema.parse(input);
  const links = await resolveLinks(user.id, data.applicationId);
  const wc = countWords(data.body);
  return db.transaction(async (tx) => {
    const [e] = await tx.insert(essays).values({ userId: user.id, title: data.title, prompt: data.prompt, body: data.body, wordCount: wc, wordLimit: data.wordLimit ?? null, currentVersion: 1, ...links }).returning();
    await tx.insert(essayVersions).values({ essayId: e.id, versionNumber: 1, title: e.title, prompt: e.prompt, body: e.body, wordCount: wc, note: "First draft", createdBy: user.id });
    await audit({ eventType: "essay.created", actorId: user.id, targetType: "essay", targetId: e.id }, tx);
    return e;
  });
}

async function ownEssay(user: CurrentUser, essayId: string) {
  const [e] = await db.select().from(essays).where(eq(essays.id, essayId)).limit(1);
  if (!e || e.deletedAt || e.userId !== user.id) throw new NotFoundError("Essay");
  return e;
}

/** Saves a draft; a new version is created only when the content actually changed. */
export async function saveEssay(user: CurrentUser, essayId: string, input: z.input<typeof essaySchema>) {
  const data = essaySchema.parse(input);
  const e = await ownEssay(user, essayId);
  if (e.status === "finalized") throw new AppError("This essay is finalised. Reopen it to make changes.", 409);
  if (["ai_review_pending", "human_review_pending"].includes(e.status) && data.body !== e.body) {
    throw new AppError("This essay is being reviewed. You can edit it again once feedback arrives.", 409);
  }
  const links = await resolveLinks(user.id, data.applicationId === undefined ? e.applicationId : data.applicationId);
  const wc = countWords(data.body);
  const changed = data.body !== e.body || data.title !== e.title || data.prompt !== e.prompt;
  return db.transaction(async (tx) => {
    const version = changed ? e.currentVersion + 1 : e.currentVersion;
    const status = e.status === "revision_requested" || e.status === "feedback_approved" ? (changed ? "draft" : e.status) : e.status;
    const [updated] = await tx
      .update(essays)
      .set({ title: data.title, prompt: data.prompt, body: data.body, wordCount: wc, wordLimit: data.wordLimit ?? null, currentVersion: version, status, updatedAt: new Date(), ...links })
      .where(eq(essays.id, essayId))
      .returning();
    if (changed) {
      await tx.insert(essayVersions).values({ essayId, versionNumber: version, title: data.title, prompt: data.prompt, body: data.body, wordCount: wc, note: data.note ?? null, createdBy: user.id });
    }
    return { essay: updated, newVersion: changed };
  });
}

export async function essayBundle(essayId: string) {
  const [e] = await db.select().from(essays).where(eq(essays.id, essayId)).limit(1);
  if (!e || e.deletedAt) throw new NotFoundError("Essay");
  const [versions, feedback, reviews, sch] = await Promise.all([
    db.select().from(essayVersions).where(eq(essayVersions.essayId, essayId)).orderBy(desc(essayVersions.versionNumber)),
    db
      .select({ f: essayFeedback, author: { firstName: users.firstName, lastName: users.lastName } })
      .from(essayFeedback)
      .leftJoin(users, eq(users.id, essayFeedback.authorId))
      .where(eq(essayFeedback.essayId, essayId))
      .orderBy(desc(essayFeedback.publishedAt)),
    db.select().from(essayReviews).where(eq(essayReviews.essayId, essayId)).orderBy(desc(essayReviews.requestedAt)),
    e.scholarshipId ? db.select({ id: scholarships.id, name: scholarships.name }).from(scholarships).where(eq(scholarships.id, e.scholarshipId)).limit(1) : Promise.resolve([]),
  ]);
  return { essay: e, versions, feedback, reviews, scholarship: sch[0] ?? null };
}

/** Access: owner, admins with reviews.essays / ai.approve, or reviewer assigned to the essay's application. */
export async function essayAccess(user: CurrentUser, essayId: string): Promise<{ essay: Essay; access: "owner" | "admin" | "reviewer" }> {
  const [e] = await db.select().from(essays).where(eq(essays.id, essayId)).limit(1);
  if (!e || e.deletedAt) throw new NotFoundError("Essay");
  if (e.userId === user.id) return { essay: e, access: "owner" };
  if (can(user.permissions, "reviews.essays") || can(user.permissions, "ai.approve")) return { essay: e, access: "admin" };
  if (e.applicationId && can(user.permissions, "reviewer.access") && (await isAssignedReviewer(user.id, e.applicationId))) return { essay: e, access: "reviewer" };
  throw new NotFoundError("Essay");
}

export async function listEssaysForUser(userId: string) {
  return db
    .select({ e: essays, scholarshipName: scholarships.name })
    .from(essays)
    .leftJoin(scholarships, eq(scholarships.id, essays.scholarshipId))
    .where(and(eq(essays.userId, userId), isNull(essays.deletedAt)))
    .orderBy(desc(essays.updatedAt));
}

/**
 * Submits the current version for review. If AI is enabled and configured, an AI critique is
 * queued first; either way the essay waits for a human. AI never publishes directly.
 */
export async function submitEssayForReview(user: CurrentUser, essayId: string) {
  const e = await ownEssay(user, essayId);
  if (!e.applicationId) throw new AppError("Link this essay to one of your applications so a reviewer can be assigned.", 400);
  if (countWords(e.body) < 30) throw new AppError("Write at least 30 words before asking for feedback.", 400);
  if (["ai_review_pending", "human_review_pending", "submitted_for_review"].includes(e.status)) throw new AppError("This essay is already waiting for review.", 409);
  const [version] = await db.select().from(essayVersions).where(and(eq(essayVersions.essayId, essayId), eq(essayVersions.versionNumber, e.currentVersion))).limit(1);
  const settings = await getSettings();
  const useAi = settings.ai_enabled && settings.ai_auto_generate_on_submit && aiStatus().configured;
  const requestId = await db.transaction(async (tx) => {
    await tx.insert(essayReviews).values({ essayId, essayVersionId: version.id, status: "pending" });
    await tx.update(essays).set({ status: useAi ? "ai_review_pending" : "human_review_pending", submittedAt: new Date(), updatedAt: new Date() }).where(eq(essays.id, essayId));
    let rid: string | null = null;
    if (useAi) {
      const [r] = await tx.insert(aiCritiqueRequests).values({ essayId, essayVersionId: version.id, requestedBy: user.id, status: "queued", promptVersion: CRITIQUE_PROMPT_VERSION }).returning({ id: aiCritiqueRequests.id });
      rid = r.id;
    }
    await audit({ eventType: "essay.submitted_for_review", actorId: user.id, targetType: "essay", targetId: essayId, metadata: { version: e.currentVersion, ai: useAi } }, tx);
    return rid;
  });
  const reviewers = await db.select({ id: reviewerAssignments.reviewerId }).from(reviewerAssignments).where(and(eq(reviewerAssignments.applicationId, e.applicationId), eq(reviewerAssignments.isActive, true)));
  for (const r of reviewers) {
    await enqueueNotification({ templateKey: "review.queue_item", channel: "in_app", userId: r.id, idempotencyKey: idempotencyKey(["essay-review-req", essayId, e.currentVersion, r.id]), vars: { itemType: "Essay", applicantName: `${user.firstName} ${user.lastName}`, itemTitle: `“${e.title}”` }, actionUrl: `/reviewer/essays/${essayId}` });
  }
  if (requestId) {
    // best-effort immediate processing; the cron job picks up anything left queued
    await processCritiqueRequest(requestId).catch(() => undefined);
  }
}

/* ------------------------------------------------------------------ */
/* Human feedback                                                      */
/* ------------------------------------------------------------------ */

async function assertEssayReviewer(user: CurrentUser, essayId: string) {
  const { essay, access } = await essayAccess(user, essayId);
  if (access === "owner") throw new ForbiddenError("You can't review your own essay.");
  if (access === "admin" && !can(user.permissions, "reviews.essays") && !can(user.permissions, "ai.approve")) throw new ForbiddenError();
  return essay;
}

export async function addEssayFeedback(user: CurrentUser, essayId: string, input: { versionId: string; body: string; selectedText?: string | null; startOffset?: number | null; endOffset?: number | null }) {
  const essay = await assertEssayReviewer(user, essayId);
  const [v] = await db.select().from(essayVersions).where(and(eq(essayVersions.id, input.versionId), eq(essayVersions.essayId, essayId))).limit(1);
  if (!v) throw new NotFoundError("Version");
  const body = input.body.trim();
  if (!body) throw new AppError("Write your feedback first.", 400);
  let start = input.startOffset ?? null;
  let end = input.endOffset ?? null;
  const sel = input.selectedText?.trim() ? input.selectedText : null;
  if (sel) {
    if (start === null || end === null || v.body.slice(start, end) !== sel) {
      const idx = v.body.indexOf(sel);
      if (idx < 0) throw new AppError("The highlighted passage wasn't found in this version.", 400);
      start = idx;
      end = idx + sel.length;
    }
  }
  const [f] = await db.insert(essayFeedback).values({ essayId, essayVersionId: v.id, authorId: user.id, source: "human", body: body.slice(0, 5000), selectedText: sel, startOffset: sel ? start : null, endOffset: sel ? end : null }).returning();
  await audit({ eventType: "essay.feedback_added", actorId: user.id, actorRole: "reviewer", targetType: "essay", targetId: essayId, metadata: { feedbackId: f.id, anchored: !!sel } });
  void essay;
  return f;
}

export async function completeEssayReview(user: CurrentUser, essayId: string, decision: "feedback_approved" | "revision_requested", summary: string | null) {
  const essay = await assertEssayReviewer(user, essayId);
  const pendingAi = await db
    .select({ id: aiCritiqueApprovals.id })
    .from(aiCritiqueApprovals)
    .innerJoin(aiCritiqueResults, eq(aiCritiqueResults.id, aiCritiqueApprovals.resultId))
    .innerJoin(aiCritiqueRequests, eq(aiCritiqueRequests.id, aiCritiqueResults.requestId))
    .where(and(eq(aiCritiqueRequests.essayId, essayId), eq(aiCritiqueApprovals.decision, "pending")));
  if (pendingAi.length) throw new AppError("An AI critique for this essay is still awaiting your approval or rejection.", 409);
  await db.transaction(async (tx) => {
    await tx
      .update(essayReviews)
      .set({ status: "completed", reviewerId: user.id, decision, summary: summary?.slice(0, 5000) ?? null, completedAt: new Date() })
      .where(and(eq(essayReviews.essayId, essayId), inArray(essayReviews.status, ["pending", "in_review"])));
    if (summary?.trim()) {
      const [v] = await tx.select().from(essayVersions).where(and(eq(essayVersions.essayId, essayId), eq(essayVersions.versionNumber, essay.currentVersion))).limit(1);
      await tx.insert(essayFeedback).values({ essayId, essayVersionId: v.id, authorId: user.id, source: "human", body: summary.trim().slice(0, 5000) });
    }
    await tx.update(essays).set({ status: decision, updatedAt: new Date() }).where(eq(essays.id, essayId));
    await audit({ eventType: "essay.review_completed", actorId: user.id, actorRole: "reviewer", targetType: "essay", targetId: essayId, newState: { status: decision } }, tx);
  });
  await notifyEssayFeedback(essay);
}

async function notifyEssayFeedback(essay: Essay) {
  const [u] = await db.select({ f: users.firstName }).from(users).where(eq(users.id, essay.userId)).limit(1);
  for (const channel of ["email", "in_app"] as const) {
    await enqueueNotification({ templateKey: "review.essay_feedback", channel, userId: essay.userId, idempotencyKey: idempotencyKey(["essay-feedback", essay.id, essay.currentVersion, Date.now(), channel]), vars: { firstName: u?.f ?? "", essayTitle: essay.title }, actionUrl: `/essays/${essay.id}` });
  }
}

export async function setFeedbackStatus(user: CurrentUser, feedbackId: string, status: "outstanding" | "resolved") {
  const [f] = await db.select().from(essayFeedback).where(eq(essayFeedback.id, feedbackId)).limit(1);
  if (!f) throw new NotFoundError("Feedback");
  await essayAccess(user, f.essayId);
  await db.update(essayFeedback).set({ status, resolvedAt: status === "resolved" ? new Date() : null }).where(eq(essayFeedback.id, feedbackId));
  await audit({ eventType: `essay.feedback_${status}`, actorId: user.id, targetType: "essay_feedback", targetId: feedbackId });
}

export async function finalizeEssay(user: CurrentUser, essayId: string, reopen = false) {
  const e = await ownEssay(user, essayId);
  if (!reopen && ["ai_review_pending", "human_review_pending"].includes(e.status)) throw new AppError("Wait for your review to finish before finalising.", 409);
  if (e.wordLimit && e.wordCount > e.wordLimit && !reopen) throw new AppError(`Your essay is ${e.wordCount - e.wordLimit} words over the ${e.wordLimit}-word limit.`, 400);
  await db.update(essays).set({ status: reopen ? "draft" : "finalized", finalizedAt: reopen ? null : new Date(), updatedAt: new Date() }).where(eq(essays.id, essayId));
  await audit({ eventType: reopen ? "essay.reopened" : "essay.finalized", actorId: user.id, targetType: "essay", targetId: essayId });
}

export async function deleteEssay(user: CurrentUser, essayId: string) {
  const e = await ownEssay(user, essayId);
  if (["ai_review_pending", "human_review_pending"].includes(e.status)) throw new AppError("This essay is being reviewed and can't be deleted right now.", 409);
  await db.update(essays).set({ deletedAt: new Date() }).where(eq(essays.id, essayId));
  await audit({ eventType: "essay.deleted", actorId: user.id, targetType: "essay", targetId: essayId });
}

/* ------------------------------------------------------------------ */
/* AI critique pipeline                                                */
/* ------------------------------------------------------------------ */

async function rubricFor(scholarshipId: string | null): Promise<{ id: string | null; version: number | null; values: string | null; dimensions: RubricDimension[] }> {
  if (scholarshipId) {
    const [r] = await db.select().from(essayRubrics).where(and(eq(essayRubrics.scholarshipId, scholarshipId), eq(essayRubrics.isActive, true))).orderBy(desc(essayRubrics.version)).limit(1);
    if (r) return { id: r.id, version: r.version, values: r.values, dimensions: r.dimensions as RubricDimension[] };
  }
  const [g] = await db.select().from(essayRubrics).where(and(isNull(essayRubrics.scholarshipId), eq(essayRubrics.isActive, true))).orderBy(desc(essayRubrics.version)).limit(1);
  if (g) return { id: g.id, version: g.version, values: g.values, dimensions: g.dimensions as RubricDimension[] };
  return { id: null, version: null, values: null, dimensions: DEFAULT_RUBRIC };
}

/** Manually request (or re-request) AI critique for the current version. */
export async function requestAiCritique(user: CurrentUser, essayId: string) {
  if (!can(user.permissions, "ai.generate")) throw new ForbiddenError();
  const { essay } = await essayAccess(user, essayId);
  if (!aiStatus().configured) throw new AppError("AI critique isn't configured. Add AI_PROVIDER and AI_API_KEY to enable it.", 503, "not_configured");
  const [v] = await db.select().from(essayVersions).where(and(eq(essayVersions.essayId, essayId), eq(essayVersions.versionNumber, essay.currentVersion))).limit(1);
  const active = await db.select().from(aiCritiqueRequests).where(and(eq(aiCritiqueRequests.essayVersionId, v.id), inArray(aiCritiqueRequests.status, ["queued", "generating"]))).limit(1);
  if (active[0]) return active[0].id;
  const [r] = await db.insert(aiCritiqueRequests).values({ essayId, essayVersionId: v.id, requestedBy: user.id, status: "queued", promptVersion: CRITIQUE_PROMPT_VERSION }).returning({ id: aiCritiqueRequests.id });
  await audit({ eventType: "ai.critique_requested", actorId: user.id, targetType: "essay", targetId: essayId, metadata: { requestId: r.id } });
  await processCritiqueRequest(r.id).catch(() => undefined);
  return r.id;
}

/** Generates one critique. Output is validated, safety-checked and stored as PENDING approval. */
export async function processCritiqueRequest(requestId: string): Promise<"completed" | "failed" | "skipped"> {
  const claimed = await db
    .update(aiCritiqueRequests)
    .set({ status: "generating", startedAt: new Date(), attempts: sql`${aiCritiqueRequests.attempts} + 1` })
    .where(and(eq(aiCritiqueRequests.id, requestId), eq(aiCritiqueRequests.status, "queued")))
    .returning();
  const req = claimed[0];
  if (!req) return "skipped";
  const [row] = await db.select({ e: essays, v: essayVersions }).from(essayVersions).innerJoin(essays, eq(essays.id, essayVersions.essayId)).where(eq(essayVersions.id, req.essayVersionId)).limit(1);
  const sch = row.e.scholarshipId ? (await db.select().from(scholarships).where(eq(scholarships.id, row.e.scholarshipId)).limit(1))[0] : null;
  const rubric = await rubricFor(row.e.scholarshipId);
  try {
    const out = await generateCritique({
      scholarshipName: sch?.name ?? null,
      scholarshipValues: rubric.values,
      rubric: rubric.dimensions,
      essayPrompt: row.v.prompt,
      essayTitle: row.v.title,
      essayBody: row.v.body,
      wordCount: row.v.wordCount,
      wordLimit: row.e.wordLimit,
    });
    const problems = checkCritiqueSafety(out.critique, row.v.body);
    if (problems.length) throw new ProviderError(out.provider, `Critique failed safety checks: ${problems.join(" ")}`, true);
    await db.transaction(async (tx) => {
      const [res] = await tx.insert(aiCritiqueResults).values({ requestId, output: out.critique, inputTokens: out.inputTokens, outputTokens: out.outputTokens }).returning();
      await tx.insert(aiCritiqueApprovals).values({ resultId: res.id, decision: "pending" });
      await tx.update(aiCritiqueRequests).set({ status: "completed", provider: out.provider, model: out.model, rubricId: rubric.id, rubricVersion: rubric.version, completedAt: new Date(), error: null }).where(eq(aiCritiqueRequests.id, requestId));
      await tx.update(essays).set({ status: "human_review_pending" }).where(and(eq(essays.id, row.e.id), eq(essays.status, "ai_review_pending")));
      await audit({ eventType: "ai.critique_generated", actorRole: "system", targetType: "essay", targetId: row.e.id, metadata: { requestId, provider: out.provider, model: out.model, promptVersion: req.promptVersion, rubricVersion: rubric.version, inputTokens: out.inputTokens, outputTokens: out.outputTokens }, ip: null }, tx);
    });
    return "completed";
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const retryable = !(e instanceof IntegrationNotConfiguredError) && (!(e instanceof ProviderError) || e.retryable) && req.attempts < 3;
    await db.update(aiCritiqueRequests).set({ status: retryable ? "queued" : "failed", error: message.slice(0, 1000) }).where(eq(aiCritiqueRequests.id, requestId));
    if (!retryable) {
      // fall back to a purely human review — the essay must never be stuck
      await db.update(essays).set({ status: "human_review_pending" }).where(and(eq(essays.id, row.e.id), eq(essays.status, "ai_review_pending")));
      await audit({ eventType: "ai.critique_failed", actorRole: "system", targetType: "essay", targetId: row.e.id, metadata: { requestId, error: message.slice(0, 300) }, ip: null });
    }
    return "failed";
  }
}

export async function processCritiqueQueue(limit = 5) {
  // A request still "generating" after 5 minutes was cut off (e.g. a serverless time limit): retry it, at most 3 attempts.
  const stale = new Date(Date.now() - 5 * 60_000);
  await db.update(aiCritiqueRequests).set({ status: "queued" }).where(and(eq(aiCritiqueRequests.status, "generating"), lt(aiCritiqueRequests.startedAt, stale), lt(aiCritiqueRequests.attempts, 3)));
  await db.update(aiCritiqueRequests).set({ status: "failed", error: "Generation was interrupted 3 times." }).where(and(eq(aiCritiqueRequests.status, "generating"), lt(aiCritiqueRequests.startedAt, stale), gte(aiCritiqueRequests.attempts, 3)));
  const queued = await db.select({ id: aiCritiqueRequests.id }).from(aiCritiqueRequests).where(eq(aiCritiqueRequests.status, "queued")).orderBy(asc(aiCritiqueRequests.createdAt)).limit(limit);
  const out = { completed: 0, failed: 0, skipped: 0 };
  for (const q of queued) out[await processCritiqueRequest(q.id)]++;
  return out;
}

function diffCritique(original: Critique, edited: Critique) {
  const changed: string[] = [];
  for (const k of Object.keys(original) as (keyof Critique)[]) if (JSON.stringify(original[k]) !== JSON.stringify(edited[k])) changed.push(k);
  return changed;
}

async function loadApproval(approvalId: string) {
  const [row] = await db
    .select({ approval: aiCritiqueApprovals, result: aiCritiqueResults, request: aiCritiqueRequests })
    .from(aiCritiqueApprovals)
    .innerJoin(aiCritiqueResults, eq(aiCritiqueResults.id, aiCritiqueApprovals.resultId))
    .innerJoin(aiCritiqueRequests, eq(aiCritiqueRequests.id, aiCritiqueResults.requestId))
    .where(eq(aiCritiqueApprovals.id, approvalId))
    .limit(1);
  if (!row) throw new NotFoundError("AI critique");
  return row;
}

async function assertApprover(user: CurrentUser, essayId: string) {
  const { essay, access } = await essayAccess(user, essayId);
  if (access === "owner") throw new ForbiddenError("You can't approve feedback on your own essay.");
  if (access === "admin" && !can(user.permissions, "ai.approve")) throw new ForbiddenError();
  return essay;
}

/** The ONLY path by which AI output reaches an applicant: a human approves (optionally edits) it. */
export async function approveCritique(user: CurrentUser, approvalId: string, edited: unknown, notes: string | null) {
  const row = await loadApproval(approvalId);
  if (row.approval.decision !== "pending" && row.approval.decision !== "needs_more_review") throw new AppError("This critique has already been decided.", 409);
  const essay = await assertApprover(user, row.request.essayId);
  const original = CritiqueSchema.parse(row.result.output);
  const final = edited ? CritiqueSchema.parse(edited) : original;
  const changes = diffCritique(original, final);
  await db.transaction(async (tx) => {
    const [fb] = await tx.insert(essayFeedback).values({ essayId: essay.id, essayVersionId: row.request.essayVersionId, authorId: user.id, source: "ai_approved", critique: final, body: final.overall_summary }).returning();
    await tx
      .update(aiCritiqueApprovals)
      .set({ decision: "approved", reviewerId: user.id, editedOutput: changes.length ? final : null, changesMade: { fields: changes }, notes: notes?.slice(0, 2000) ?? null, decidedAt: new Date(), publishedFeedbackId: fb.id })
      .where(eq(aiCritiqueApprovals.id, approvalId));
    await audit({ eventType: "ai.critique_approved", actorId: user.id, actorRole: "reviewer", targetType: "ai_critique", targetId: approvalId, metadata: { essayId: essay.id, changedFields: changes, provider: row.request.provider, model: row.request.model } }, tx);
  });
  await notifyEssayFeedback(essay);
}

export async function rejectCritique(user: CurrentUser, approvalId: string, notes: string | null, decision: "rejected" | "needs_more_review" = "rejected") {
  const row = await loadApproval(approvalId);
  if (row.approval.decision !== "pending" && row.approval.decision !== "needs_more_review") throw new AppError("This critique has already been decided.", 409);
  await assertApprover(user, row.request.essayId);
  if (decision === "rejected" && !notes?.trim()) throw new AppError("Add a short note explaining why the critique was rejected.", 400);
  await db.update(aiCritiqueApprovals).set({ decision, reviewerId: user.id, notes: notes?.slice(0, 2000) ?? null, decidedAt: decision === "rejected" ? new Date() : null }).where(eq(aiCritiqueApprovals.id, approvalId));
  await audit({ eventType: decision === "rejected" ? "ai.critique_rejected" : "ai.critique_flagged", actorId: user.id, actorRole: "reviewer", targetType: "ai_critique", targetId: approvalId, metadata: { essayId: row.request.essayId, notes } });
}

export async function aiQueue(user: CurrentUser, opts: { decision?: "pending" | "needs_more_review" | "approved" | "rejected" } = {}) {
  const all = can(user.permissions, "ai.approve");
  const decisions = opts.decision ? [opts.decision] : ["pending", "needs_more_review"];
  const rows = await db.execute<{
    approval_id: string; decision: string; generated_at: string; provider: string; model: string; essay_id: string; essay_title: string; prompt: string;
    first_name: string; last_name: string; scholarship_name: string | null; version_number: number; application_id: string | null;
  }>(sql`
    SELECT ap.id AS approval_id, ap.decision, r.created_at AS generated_at, rq.provider, rq.model, e.id AS essay_id, e.title AS essay_title, e.prompt,
           u.first_name, u.last_name, s.name AS scholarship_name, v.version_number, e.application_id
    FROM ai_critique_approvals ap
    JOIN ai_critique_results r ON r.id = ap.result_id
    JOIN ai_critique_requests rq ON rq.id = r.request_id
    JOIN essays e ON e.id = rq.essay_id
    JOIN essay_versions v ON v.id = rq.essay_version_id
    JOIN users u ON u.id = e.user_id
    LEFT JOIN scholarships s ON s.id = e.scholarship_id
    WHERE ap.decision::text IN ${decisions}
      AND (${all}::boolean OR EXISTS (SELECT 1 FROM reviewer_assignments ra WHERE ra.application_id = e.application_id AND ra.reviewer_id = ${user.id} AND ra.is_active))
    ORDER BY r.created_at ASC LIMIT 200`);
  return [...rows];
}

export async function essayReviewQueue(user: CurrentUser) {
  const all = can(user.permissions, "reviews.essays");
  const rows = await db.execute<{
    essay_id: string; title: string; prompt: string; status: string; submitted_at: string; first_name: string; last_name: string; scholarship_name: string | null; ai_status: string | null; reviewer_names: string | null;
  }>(sql`
    SELECT e.id AS essay_id, e.title, e.prompt, e.status, e.submitted_at, u.first_name, u.last_name, s.name AS scholarship_name,
      (SELECT rq.status::text FROM ai_critique_requests rq WHERE rq.essay_id = e.id ORDER BY rq.created_at DESC LIMIT 1) AS ai_status,
      (SELECT string_agg(ru.first_name || ' ' || ru.last_name, ', ') FROM reviewer_assignments ra JOIN users ru ON ru.id = ra.reviewer_id WHERE ra.application_id = e.application_id AND ra.is_active) AS reviewer_names
    FROM essays e JOIN users u ON u.id = e.user_id LEFT JOIN scholarships s ON s.id = e.scholarship_id
    WHERE e.deleted_at IS NULL AND e.status IN ('ai_review_pending','human_review_pending','submitted_for_review')
      AND (${all}::boolean OR EXISTS (SELECT 1 FROM reviewer_assignments ra WHERE ra.application_id = e.application_id AND ra.reviewer_id = ${user.id} AND ra.is_active))
    ORDER BY e.submitted_at ASC NULLS LAST LIMIT 200`);
  return [...rows];
}

export async function critiquesForEssay(essayId: string) {
  return db
    .select({ approval: aiCritiqueApprovals, result: aiCritiqueResults, request: aiCritiqueRequests })
    .from(aiCritiqueRequests)
    .leftJoin(aiCritiqueResults, eq(aiCritiqueResults.requestId, aiCritiqueRequests.id))
    .leftJoin(aiCritiqueApprovals, eq(aiCritiqueApprovals.resultId, aiCritiqueResults.id))
    .where(eq(aiCritiqueRequests.essayId, essayId))
    .orderBy(desc(aiCritiqueRequests.createdAt));
}
