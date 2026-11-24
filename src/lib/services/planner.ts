import "server-only";
import { and, asc, eq, inArray, isNull, notInArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { applicationMilestones, applications, milestoneDependencies, scholarshipMilestoneTemplates, scholarships } from "@/lib/db/schema";
import { backwardSchedule, dayInTimezone, diffDays, milestoneProgress, ScheduleError, type TaskTemplate } from "@/lib/engine/scheduler";
import { AppError, NotFoundError } from "@/lib/errors";
import { audit } from "./audit";
import { enqueueNotification } from "./notifications";
import { idempotencyKey } from "@/lib/engine/notification-keys";

export const DEFAULT_MILESTONES: TaskTemplate[] = [
  { key: "research", name: "Research the scholarship", description: "Read the official page, values and requirements carefully.", durationDays: 3, dependsOn: [], priority: "medium", isRequired: true, sortOrder: 1 },
  { key: "eligibility", name: "Complete eligibility assessment", description: "Confirm you meet the criteria and note anything to fix.", durationDays: 1, dependsOn: ["research"], priority: "high", isRequired: true, sortOrder: 2 },
  { key: "transcript", name: "Obtain transcript", description: "Request your official transcript or results from your school/exam body.", durationDays: 14, dependsOn: ["eligibility"], priority: "high", isRequired: true, sortOrder: 3 },
  { key: "referee_request", name: "Request referee letter", description: "Ask a teacher, mentor or employer early and send them a secure link.", durationDays: 2, dependsOn: ["eligibility"], priority: "high", isRequired: true, sortOrder: 4 },
  { key: "essay_draft", name: "Draft essay", description: "Write a first draft in your own words. Use your answer bank for inspiration.", durationDays: 7, dependsOn: ["eligibility"], priority: "high", isRequired: true, sortOrder: 5 },
  { key: "cv", name: "Prepare CV", description: "Summarise your education, achievements, leadership and service.", durationDays: 5, dependsOn: ["eligibility"], priority: "medium", isRequired: true, sortOrder: 6 },
  { key: "essay_revision_1", name: "Essay revision 1", description: "Revise using reviewer feedback.", durationDays: 5, dependsOn: ["essay_draft"], priority: "medium", isRequired: true, sortOrder: 7 },
  { key: "essay_revision_2", name: "Essay revision 2", description: "Tighten structure, evidence and reflection.", durationDays: 4, dependsOn: ["essay_revision_1"], priority: "medium", isRequired: false, sortOrder: 8 },
  { key: "supporting_documents", name: "Collect supporting documents", description: "Passport/ID, certificates and any financial documentation.", durationDays: 10, dependsOn: ["eligibility"], priority: "medium", isRequired: true, sortOrder: 9 },
  { key: "reference_letter", name: "Receive reference letter", description: "Follow up politely so your referee submits before the deadline.", durationDays: 14, dependsOn: ["referee_request"], priority: "high", isRequired: true, sortOrder: 10 },
  { key: "final_essay", name: "Finalise essay", description: "Proofread and confirm word count compliance.", durationDays: 2, dependsOn: ["essay_revision_2"], priority: "high", isRequired: true, sortOrder: 11 },
  { key: "final_review", name: "Final application review", description: "Check every document, answer and requirement one last time.", durationDays: 2, dependsOn: ["final_essay", "cv", "transcript", "supporting_documents", "reference_letter"], priority: "critical", isRequired: true, sortOrder: 12 },
  { key: "submit", name: "Submit application", description: "Submit on the official university portal, then mark your application as submitted here.", durationDays: 1, dependsOn: ["final_review"], priority: "critical", isRequired: true, sortOrder: 13 },
];
export const SUBMIT_KEY = "submit";

export async function templatesFor(scholarshipId: string): Promise<TaskTemplate[]> {
  let rows = await db.select().from(scholarshipMilestoneTemplates).where(eq(scholarshipMilestoneTemplates.scholarshipId, scholarshipId)).orderBy(asc(scholarshipMilestoneTemplates.sortOrder));
  if (rows.length === 0) rows = await db.select().from(scholarshipMilestoneTemplates).where(isNull(scholarshipMilestoneTemplates.scholarshipId)).orderBy(asc(scholarshipMilestoneTemplates.sortOrder));
  if (rows.length === 0) return DEFAULT_MILESTONES;
  return rows.map((r) => ({ key: r.key, name: r.name, description: r.description, durationDays: r.durationDays, dependsOn: r.dependsOn, priority: r.priority, isRequired: r.isRequired, sortOrder: r.sortOrder }));
}

export interface ScheduleNotice {
  warnings: string[];
  prioritisation: string[];
}

export function parseScheduleNotice(text: string | null): ScheduleNotice | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as ScheduleNotice;
  } catch {
    return { warnings: [text], prioritisation: [] };
  }
}

/**
 * Generates or regenerates an application's milestone plan backward from the official deadline.
 * Completed milestones are never moved; applicant-adjusted dates are kept unless `resetCustom`.
 */
export async function generateSchedule(applicationId: string, actorId: string | null, opts: { resetCustom?: boolean; today?: string } = {}) {
  const [row] = await db.select({ app: applications, sch: scholarships }).from(applications).innerJoin(scholarships, eq(scholarships.id, applications.scholarshipId)).where(eq(applications.id, applicationId)).limit(1);
  if (!row) throw new NotFoundError("Application");
  const deadline = row.sch.deadline ?? row.app.deadline;
  if (!deadline) throw new AppError("This scholarship has no published deadline yet, so a schedule can't be generated.", 400);
  const tz = row.sch.timezone || "Africa/Lagos";
  const today = opts.today ?? dayInTimezone(new Date(), tz);
  const deadlineDay = dayInTimezone(deadline, tz);
  const templates = await templatesFor(row.sch.id);

  const existing = await db.select().from(applicationMilestones).where(eq(applicationMilestones.applicationId, applicationId));
  const done = new Set(existing.filter((m) => m.status === "completed").map((m) => m.templateKey));
  // completed work no longer needs time: schedule only what's left
  const remaining = templates
    .filter((t) => !done.has(t.key))
    .map((t) => ({ ...t, dependsOn: t.dependsOn.filter((d) => !done.has(d)) }));

  let result;
  try {
    result = remaining.length ? backwardSchedule(remaining, deadlineDay, today, { bufferDays: "auto" }) : null;
  } catch (e) {
    if (e instanceof ScheduleError) throw new AppError(e.message, 400);
    throw e;
  }

  await db.transaction(async (tx) => {
    const byKey = new Map(existing.map((m) => [m.templateKey, m]));
    const ids = new Map<string, string>();
    for (const m of existing) ids.set(m.templateKey, m.id);
    for (const t of result?.tasks ?? []) {
      const prev = byKey.get(t.key);
      const keepDates = prev && prev.isCustomDate && !opts.resetCustom;
      const values = {
        name: t.name,
        description: t.description,
        startDate: keepDates ? prev.startDate : t.startDate,
        dueDate: keepDates ? prev.dueDate : t.dueDate,
        durationDays: t.durationDays,
        plannedDurationDays: t.plannedDurationDays,
        priority: t.priority,
        isRequired: t.isRequired,
        isCritical: t.isCritical,
        isCompressed: t.isCompressed,
        isCustomDate: keepDates ? true : false,
        sortOrder: templates.findIndex((x) => x.key === t.key),
        updatedBy: actorId,
        updatedAt: new Date(),
      };
      if (prev) {
        await tx.update(applicationMilestones).set(values).where(eq(applicationMilestones.id, prev.id));
      } else {
        const [ins] = await tx.insert(applicationMilestones).values({ ...values, applicationId, templateKey: t.key, createdBy: actorId }).returning({ id: applicationMilestones.id });
        ids.set(t.key, ins.id);
      }
    }
    // remove milestones whose template no longer exists (only if not completed)
    const validKeys = templates.map((t) => t.key);
    if (validKeys.length) {
      await tx.delete(applicationMilestones).where(and(eq(applicationMilestones.applicationId, applicationId), notInArray(applicationMilestones.templateKey, validKeys), notInArray(applicationMilestones.status, ["completed"])));
    }
    // rebuild dependency edges from templates
    const allIds = [...ids.values()];
    if (allIds.length) await tx.delete(milestoneDependencies).where(inArray(milestoneDependencies.milestoneId, allIds));
    for (const t of templates) {
      const mid = ids.get(t.key);
      if (!mid) continue;
      for (const d of t.dependsOn) {
        const did = ids.get(d);
        if (did) await tx.insert(milestoneDependencies).values({ milestoneId: mid, dependsOnId: did }).onConflictDoNothing();
      }
    }
    const notice: ScheduleNotice | null = result && result.compressed ? { warnings: result.warnings, prioritisation: result.prioritisation } : null;
    await tx
      .update(applications)
      .set({ scheduleCompressed: !!notice, scheduleWarning: notice ? JSON.stringify(notice) : null, scheduleGeneratedAt: new Date(), deadline, updatedAt: new Date() })
      .where(eq(applications.id, applicationId));
    await audit({ eventType: "planner.schedule_generated", actorId, targetType: "application", targetId: applicationId, metadata: { deadline: deadlineDay, compressed: !!notice, tasks: result?.tasks.length ?? 0, resetCustom: !!opts.resetCustom } }, tx);
  });
  await recomputeProgress(applicationId);
  return result;
}

/** When an official deadline changes, every open application's plan is recalculated. */
export async function recalculateForDeadlineChange(scholarshipId: string, actorId: string | null): Promise<number> {
  const apps = await db
    .select({ id: applications.id, userId: applications.userId })
    .from(applications)
    .where(and(eq(applications.scholarshipId, scholarshipId), isNull(applications.deletedAt), notInArray(applications.status, ["submitted", "shortlisted", "outcome", "ineligible"])));
  const [sch] = await db.select().from(scholarships).where(eq(scholarships.id, scholarshipId)).limit(1);
  let n = 0;
  for (const a of apps) {
    try {
      await generateSchedule(a.id, actorId);
      n++;
      await enqueueNotification({
        templateKey: "application.status_changed",
        channel: "in_app",
        userId: a.userId,
        idempotencyKey: idempotencyKey(["deadline-change", a.id, sch?.deadline?.toISOString()]),
        vars: { scholarshipName: sch?.name, status: "Deadline updated — your plan was recalculated" },
        actionUrl: `/planner?application=${a.id}`,
      });
    } catch (e) {
      console.warn(JSON.stringify({ level: "warn", msg: "schedule recalculation failed", applicationId: a.id, error: String(e) }));
    }
  }
  return n;
}

export async function recomputeProgress(applicationId: string): Promise<number> {
  const [app] = await db.select().from(applications).where(eq(applications.id, applicationId)).limit(1);
  if (!app) return 0;
  if (["submitted", "shortlisted", "outcome"].includes(app.status)) {
    if (app.progress !== 100) await db.update(applications).set({ progress: 100 }).where(eq(applications.id, applicationId));
    return 100;
  }
  const ms = await db.select({ status: applicationMilestones.status, isRequired: applicationMilestones.isRequired }).from(applicationMilestones).where(eq(applicationMilestones.applicationId, applicationId));
  const { checklistFor } = await import("./applications");
  const checklist = await checklistFor(applicationId);
  const docTotal = checklist.documents.filter((d) => d.isRequired).length;
  const docDone = checklist.documents.filter((d) => d.isRequired && d.ready).length;
  const msPct = milestoneProgress(ms);
  const weightMs = ms.length ? 0.6 : 0;
  const weightDocs = docTotal ? 0.4 : 0;
  const total = weightMs + weightDocs;
  const progress = total === 0 ? 0 : Math.round(((msPct / 100) * weightMs + (docTotal ? docDone / docTotal : 0) * weightDocs) / total * 100);
  await db.update(applications).set({ progress }).where(eq(applications.id, applicationId));
  return progress;
}

export interface MilestoneUpdate {
  status?: "upcoming" | "in_progress" | "completed" | "blocked";
  completionNotes?: string | null;
  startDate?: string;
  dueDate?: string;
}

export async function updateMilestone(milestoneId: string, actorId: string, update: MilestoneUpdate) {
  const [row] = await db.select({ m: applicationMilestones, app: applications }).from(applicationMilestones).innerJoin(applications, eq(applications.id, applicationMilestones.applicationId)).where(eq(applicationMilestones.id, milestoneId)).limit(1);
  if (!row) throw new NotFoundError("Milestone");
  const set: Partial<typeof applicationMilestones.$inferInsert> = { updatedBy: actorId, updatedAt: new Date() };
  if (update.status) {
    set.status = update.status;
    set.completedAt = update.status === "completed" ? new Date() : null;
  }
  if (update.completionNotes !== undefined) set.completionNotes = update.completionNotes?.slice(0, 2000) ?? null;
  if (update.startDate || update.dueDate) {
    const start = update.startDate ?? row.m.startDate;
    const due = update.dueDate ?? row.m.dueDate;
    if (diffDays(due, start) < 0) throw new AppError("The due date can't be before the start date.", 400, "invalid", { dueDate: "Must be on or after the start date" });
    if (row.app.deadline) {
      const deadlineDay = dayInTimezone(row.app.deadline, "Africa/Lagos");
      if (diffDays(deadlineDay, due) < 0) throw new AppError("Tasks must be due on or before the official deadline.", 400, "invalid", { dueDate: `Must be on or before ${deadlineDay}` });
    }
    set.startDate = start;
    set.dueDate = due;
    set.durationDays = diffDays(due, start) + 1;
    set.isCustomDate = true;
  }
  await db.update(applicationMilestones).set(set).where(eq(applicationMilestones.id, milestoneId));
  await audit({ eventType: "milestone.updated", actorId, targetType: "milestone", targetId: milestoneId, previousState: { status: row.m.status, startDate: row.m.startDate, dueDate: row.m.dueDate }, newState: update as Record<string, unknown> });
  await recomputeProgress(row.app.id);
  return row.app.id;
}

export async function milestonesForApplication(applicationId: string) {
  const ms = await db.select().from(applicationMilestones).where(eq(applicationMilestones.applicationId, applicationId)).orderBy(asc(applicationMilestones.dueDate), asc(applicationMilestones.sortOrder));
  const deps = ms.length ? await db.select().from(milestoneDependencies).where(inArray(milestoneDependencies.milestoneId, ms.map((m) => m.id))) : [];
  return ms.map((m) => ({ ...m, dependsOn: deps.filter((d) => d.milestoneId === m.id).map((d) => d.dependsOnId) }));
}
