import "server-only";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  applicationMilestones,
  applications,
  applicationStateTransitions,
  documents,
  eligibilityAssessments,
  refereeRequests,
  scholarshipDocumentRequirements,
  scholarships,
} from "@/lib/db/schema";
import { idempotencyKey } from "@/lib/engine/notification-keys";
import { canTransition, STATUS_LABELS, type Actor, type AppStatus, type Outcome } from "@/lib/engine/state-machine";
import { AppError, NotFoundError } from "@/lib/errors";
import { audit, trackActivity } from "./audit";
import { enqueueNotification } from "./notifications";
import { generateSchedule, recomputeProgress, SUBMIT_KEY } from "./planner";

const READY_STATUSES = new Set(["uploaded", "pending_review", "under_review", "approved"]);

export async function checklistFor(applicationId: string) {
  const [app] = await db.select().from(applications).where(eq(applications.id, applicationId)).limit(1);
  if (!app) throw new NotFoundError("Application");
  const reqs = await db.select().from(scholarshipDocumentRequirements).where(eq(scholarshipDocumentRequirements.scholarshipId, app.scholarshipId)).orderBy(asc(scholarshipDocumentRequirements.sortOrder));
  const docs = await db.select().from(documents).where(and(eq(documents.applicationId, applicationId), isNull(documents.deletedAt)));
  const docList = reqs.map((r) => {
    const matches = docs.filter((d) => d.requirementId === r.id || (!d.requirementId && d.category === r.category));
    const best = matches.find((d) => d.reviewStatus === "approved") ?? matches.find((d) => d.currentVersion > 0 && READY_STATUSES.has(d.reviewStatus)) ?? matches[0];
    const ready = !!best && best.currentVersion > 0 && READY_STATUSES.has(best.reviewStatus);
    return {
      requirementId: r.id,
      name: r.name,
      section: r.section ?? "admission",
      category: r.category,
      description: r.description,
      isRequired: r.isRequired,
      documentId: best?.id ?? null,
      reviewStatus: best?.reviewStatus ?? null,
      ready,
      problem: !best ? "Not uploaded yet" : !ready ? (best.reviewStatus === "needs_revision" ? "Needs revision" : best.reviewStatus === "rejected" ? "Rejected — upload a new version" : "Not uploaded yet") : null,
    };
  });
  const ms = await db.select().from(applicationMilestones).where(eq(applicationMilestones.applicationId, applicationId));
  const incompleteMilestones = ms.filter((m) => m.isRequired && m.status !== "completed" && m.templateKey !== SUBMIT_KEY).map((m) => m.name);
  return {
    documents: docList,
    missingDocuments: docList.filter((d) => d.isRequired && !d.ready).map((d) => d.name),
    incompleteMilestones,
  };
}

async function currentVerdict(userId: string, scholarshipId: string) {
  const [a] = await db
    .select({ id: eligibilityAssessments.id, verdict: eligibilityAssessments.overallVerdict })
    .from(eligibilityAssessments)
    .where(and(eq(eligibilityAssessments.userId, userId), eq(eligibilityAssessments.scholarshipId, scholarshipId), eq(eligibilityAssessments.isCurrent, true)))
    .limit(1);
  return a ?? null;
}

export async function transitionApplication(
  applicationId: string,
  to: AppStatus,
  actor: { id: string | null; type: Actor },
  extra: { reason?: string | null; outcome?: Outcome | null; outcomeNotes?: string | null; submissionReference?: string | null } = {},
) {
  return db.transaction(async (tx) => {
    const [app] = await tx.select().from(applications).where(eq(applications.id, applicationId)).for("update").limit(1);
    if (!app || app.deletedAt) throw new NotFoundError("Application");
    const verdict = await currentVerdict(app.userId, app.scholarshipId);
    const checklist = to === "submitted" ? await checklistFor(applicationId) : null;
    const check = canTransition(app.status, to, {
      actor: actor.type,
      assessmentVerdict: verdict?.verdict ?? null,
      missingDocuments: checklist?.missingDocuments,
      incompleteMilestones: checklist?.incompleteMilestones,
      outcome: extra.outcome ?? null,
      reason: extra.reason ?? null,
    });
    if (!check.ok) throw new AppError(check.errors.join(" "), 409, "invalid_transition");

    const set: Partial<typeof applications.$inferInsert> = { status: to, updatedAt: new Date() };
    if (to === "submitted") {
      set.submittedAt = new Date();
      set.submissionReference = extra.submissionReference ?? null;
      set.progress = 100;
    }
    if (to === "outcome") {
      set.outcome = extra.outcome!;
      set.outcomeAt = new Date();
      set.outcomeNotes = extra.outcomeNotes ?? null;
    }
    if (verdict && (to === "eligible" || to === "ineligible")) set.assessmentId = verdict.id;
    await tx.update(applications).set(set).where(eq(applications.id, applicationId));
    await tx.insert(applicationStateTransitions).values({ applicationId, fromStatus: app.status, toStatus: to, actorId: actor.id, reason: extra.reason ?? (to === "outcome" ? `Outcome: ${extra.outcome}` : null) });
    if (to === "submitted") {
      await tx.update(applicationMilestones).set({ status: "completed", completedAt: new Date() }).where(and(eq(applicationMilestones.applicationId, applicationId), eq(applicationMilestones.templateKey, SUBMIT_KEY)));
    }
    await audit(
      {
        eventType: to === "outcome" ? "application.outcome_recorded" : "application.transition",
        actorId: actor.id,
        actorRole: actor.type,
        targetType: "application",
        targetId: applicationId,
        previousState: { status: app.status, outcome: app.outcome },
        newState: { status: to, outcome: extra.outcome ?? app.outcome },
        metadata: { reason: extra.reason ?? null },
      },
      tx,
    );
    if (actor.type !== "applicant") {
      const [sch] = await tx.select({ name: scholarships.name }).from(scholarships).where(eq(scholarships.id, app.scholarshipId)).limit(1);
      await enqueueNotification(
        {
          templateKey: "application.status_changed",
          channel: "in_app",
          userId: app.userId,
          idempotencyKey: idempotencyKey(["app-status", applicationId, to, Date.now()]),
          vars: { scholarshipName: sch?.name, status: STATUS_LABELS[to] },
          actionUrl: `/applications/${applicationId}`,
        },
        tx,
      );
    }
    return { from: app.status, to };
  });
}

/** Creates an application, screens it with the current assessment, and generates the plan. */
export async function createApplication(userId: string, scholarshipId: string) {
  const [sch] = await db.select().from(scholarships).where(eq(scholarships.id, scholarshipId)).limit(1);
  if (!sch || sch.status !== "published" || !sch.isActive) throw new AppError("This scholarship isn't open for applications.", 400);
  if (sch.windowStatus !== "open" && sch.windowStatus !== "opens_soon") throw new AppError(`Applications aren't open right now${sch.nextWindow ? ` — next window: ${sch.nextWindow}` : ""}. Save it to be reminded.`, 400);
  if (sch.deadline && sch.deadline.getTime() < Date.now()) throw new AppError("The deadline for this scholarship has passed.", 400);
  const existing = await db.select({ id: applications.id }).from(applications).where(and(eq(applications.userId, userId), eq(applications.scholarshipId, scholarshipId), isNull(applications.deletedAt))).limit(1);
  if (existing[0]) return { id: existing[0].id, created: false };

  const [app] = await db.insert(applications).values({ userId, scholarshipId, deadline: sch.deadline, status: "draft" }).returning();
  await db.insert(applicationStateTransitions).values({ applicationId: app.id, fromStatus: null, toStatus: "draft", actorId: userId, reason: "Application created" });
  await audit({ eventType: "application.created", actorId: userId, actorRole: "applicant", targetType: "application", targetId: app.id, metadata: { scholarshipId } });
  await trackActivity("application.created", { userId, entityType: "scholarship", entityId: scholarshipId });

  await transitionApplication(app.id, "screening", { id: userId, type: "applicant" }, { reason: "Started screening" });
  const verdict = await currentVerdict(userId, scholarshipId);
  if (verdict?.verdict) await syncApplicationWithAssessment(userId, scholarshipId, verdict.id, verdict.verdict);
  if (sch.deadline) {
    try {
      await generateSchedule(app.id, userId);
    } catch (e) {
      if (!(e instanceof AppError)) throw e;
    }
  }
  return { id: app.id, created: true };
}

/** Moves screening applications to eligible/ineligible (system actor) when a verdict is known. */
export async function syncApplicationWithAssessment(userId: string, scholarshipId: string, assessmentId: string, verdict: "likely_eligible" | "more_info_needed" | "not_eligible") {
  const [app] = await db.select().from(applications).where(and(eq(applications.userId, userId), eq(applications.scholarshipId, scholarshipId), isNull(applications.deletedAt))).limit(1);
  if (!app) return;
  await db.update(applications).set({ assessmentId }).where(eq(applications.id, app.id));
  const sys = { id: null, type: "system" as const };
  const reason = "Eligibility assessment updated";
  if ((app.status === "eligible" && verdict !== "likely_eligible") || (app.status === "ineligible" && verdict !== "not_eligible")) {
    await transitionApplication(app.id, "screening", sys, { reason });
    app.status = "screening";
  }
  if (app.status === "screening") {
    if (verdict === "likely_eligible") await transitionApplication(app.id, "eligible", sys, { reason });
    if (verdict === "not_eligible") await transitionApplication(app.id, "ineligible", sys, { reason });
  }
}

export async function listApplicationsForUser(userId: string) {
  return db
    .select({ app: applications, sch: { id: scholarships.id, name: scholarships.name, slug: scholarships.slug, partnerUniversity: scholarships.partnerUniversity, deadline: scholarships.deadline, timezone: scholarships.timezone, isActive: scholarships.isActive, status: scholarships.status } })
    .from(applications)
    .innerJoin(scholarships, eq(scholarships.id, applications.scholarshipId))
    .where(and(eq(applications.userId, userId), isNull(applications.deletedAt)))
    .orderBy(desc(applications.updatedAt));
}

export async function applicationDetail(applicationId: string) {
  const [row] = await db.select({ app: applications, sch: scholarships }).from(applications).innerJoin(scholarships, eq(scholarships.id, applications.scholarshipId)).where(eq(applications.id, applicationId)).limit(1);
  if (!row) throw new NotFoundError("Application");
  const [transitions, checklist, referees] = await Promise.all([
    db.select().from(applicationStateTransitions).where(eq(applicationStateTransitions.applicationId, applicationId)).orderBy(desc(applicationStateTransitions.createdAt)),
    checklistFor(applicationId),
    db.select().from(refereeRequests).where(eq(refereeRequests.applicationId, applicationId)).orderBy(desc(refereeRequests.createdAt)),
  ]);
  return { ...row, transitions, checklist, referees };
}

export async function attachDocumentToApplication(userId: string, applicationId: string, documentId: string, requirementId: string | null) {
  const [app] = await db.select().from(applications).where(eq(applications.id, applicationId)).limit(1);
  if (!app || app.userId !== userId) throw new NotFoundError("Application");
  if (["submitted", "shortlisted", "outcome"].includes(app.status)) throw new AppError("This application has been submitted; its documents are locked.", 409);
  const [doc] = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
  if (!doc || doc.userId !== userId || doc.deletedAt) throw new NotFoundError("Document");
  if (requirementId) {
    const [req] = await db.select().from(scholarshipDocumentRequirements).where(eq(scholarshipDocumentRequirements.id, requirementId)).limit(1);
    if (!req || req.scholarshipId !== app.scholarshipId) throw new AppError("That requirement doesn't belong to this scholarship.", 400);
  }
  await db.update(documents).set({ applicationId, requirementId, updatedAt: new Date() }).where(eq(documents.id, documentId));
  await audit({ eventType: "document.attached", actorId: userId, targetType: "document", targetId: documentId, metadata: { applicationId, requirementId } });
  await recomputeProgress(applicationId);
}

export async function softDeleteApplication(userId: string, applicationId: string) {
  const [app] = await db.select().from(applications).where(eq(applications.id, applicationId)).limit(1);
  if (!app || app.userId !== userId) throw new NotFoundError("Application");
  if (!["draft", "screening", "eligible", "ineligible", "in_progress"].includes(app.status)) throw new AppError("Submitted applications can't be removed.", 409);
  await db.update(applications).set({ deletedAt: new Date() }).where(eq(applications.id, applicationId));
  await db.update(refereeRequests).set({ status: "cancelled", cancelledAt: new Date(), cancelledBy: userId }).where(and(eq(refereeRequests.applicationId, applicationId), inArray(refereeRequests.status, ["sent", "opened"])));
  await audit({ eventType: "application.withdrawn", actorId: userId, targetType: "application", targetId: applicationId });
}
