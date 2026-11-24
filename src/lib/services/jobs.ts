import "server-only";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { applicationMilestones, applications, jobRuns, scholarships, sessions, users } from "@/lib/db/schema";
import { addDays, dayInTimezone } from "@/lib/engine/scheduler";
import { idempotencyKey, MILESTONE_SMS_OFFSET } from "@/lib/engine/notification-keys";
import { aggregateDaily } from "./analytics";
import { backfillEmbeddings } from "./answer-bank";
import { processCritiqueQueue } from "./essays";
import { dispatchDue, enqueueNotification } from "./notifications";
import { purgeRateLimits } from "./rate-limit";
import { expireRefereeLinks, sendRefereeReminders } from "./referees";
import { expirePastDeadlines } from "./scholarships";
import { getSettings } from "./settings";

const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

/**
 * Milestone reminders. Idempotency key = milestone + due date + offset + channel, so
 * re-running the job (or retries/overlapping workers) never duplicates a reminder, while a
 * changed due date legitimately produces a new reminder.
 */
export async function milestoneReminders(): Promise<{ queued: number }> {
  const settings = await getSettings();
  const offsets = (settings.reminder_offsets_days as number[]).filter((n) => Number.isInteger(n) && n >= 0);
  const today = dayInTimezone(new Date(), settings.timezone || "Africa/Lagos");
  const targets = offsets.map((o) => addDays(today, o));
  if (!targets.length) return { queued: 0 };
  const rows = await db
    .select({ m: applicationMilestones, app: applications, s: scholarships, u: users })
    .from(applicationMilestones)
    .innerJoin(applications, eq(applications.id, applicationMilestones.applicationId))
    .innerJoin(scholarships, eq(scholarships.id, applications.scholarshipId))
    .innerJoin(users, eq(users.id, applications.userId))
    .where(and(inArray(applicationMilestones.dueDate, targets), notInArray(applicationMilestones.status, ["completed"]), inArray(applications.status, ["eligible", "in_progress", "screening"]), sql`${applications.deletedAt} IS NULL`, eq(users.status, "active")));
  let queued = 0;
  for (const r of rows) {
    const offset = offsets.find((o) => addDays(today, o) === r.m.dueDate)!;
    const key = offset === 0 ? "milestone.due_today" : offset === 1 ? "milestone.reminder_1d" : "milestone.reminder_7d";
    const vars = { firstName: r.u.firstName, milestoneName: r.m.name, scholarshipName: r.s.name, dueDate: fmt(r.m.dueDate) };
    const channels: ("email" | "in_app" | "sms")[] = ["email", "in_app"];
    if (offset === MILESTONE_SMS_OFFSET) channels.push("sms");
    for (const channel of channels) {
      const id = await enqueueNotification({
        templateKey: key,
        channel,
        userId: r.u.id,
        recipientPhone: channel === "sms" ? (await phoneOf(r.u.id)) : null,
        idempotencyKey: idempotencyKey(["milestone", r.m.id, r.m.dueDate, offset, channel]),
        vars,
        actionUrl: `/planner?application=${r.app.id}`,
      });
      if (id) queued++;
    }
  }
  return { queued };
}

async function phoneOf(userId: string) {
  const rows = await db.execute<{ phone: string | null }>(sql`SELECT phone FROM profiles WHERE user_id = ${userId}`);
  return rows[0]?.phone ?? null;
}

export async function overdueReminders(): Promise<{ queued: number }> {
  const settings = await getSettings();
  if (!settings.overdue_reminders_enabled) return { queued: 0 };
  const today = dayInTimezone(new Date(), settings.timezone || "Africa/Lagos");
  const rows = await db
    .select({ m: applicationMilestones, app: applications, s: scholarships, u: users })
    .from(applicationMilestones)
    .innerJoin(applications, eq(applications.id, applicationMilestones.applicationId))
    .innerJoin(scholarships, eq(scholarships.id, applications.scholarshipId))
    .innerJoin(users, eq(users.id, applications.userId))
    .where(and(sql`${applicationMilestones.dueDate} < ${today}::date`, sql`${applicationMilestones.dueDate} >= ${today}::date - 14`, notInArray(applicationMilestones.status, ["completed"]), inArray(applications.status, ["eligible", "in_progress"]), sql`${applications.deletedAt} IS NULL`, eq(users.status, "active")));
  let queued = 0;
  for (const r of rows) {
    for (const channel of ["email", "in_app"] as const) {
      const id = await enqueueNotification({
        templateKey: "milestone.overdue",
        channel,
        userId: r.u.id,
        idempotencyKey: idempotencyKey(["milestone-overdue", r.m.id, r.m.dueDate, channel]),
        vars: { firstName: r.u.firstName, milestoneName: r.m.name, scholarshipName: r.s.name, dueDate: fmt(r.m.dueDate) },
        actionUrl: `/planner?application=${r.app.id}`,
      });
      if (id) queued++;
    }
  }
  return { queued };
}

export async function cleanup() {
  await purgeRateLimits();
  await db.delete(sessions).where(sql`${sessions.expiresAt} < now() - interval '7 days' OR ${sessions.revokedAt} < now() - interval '7 days'`);
  return { ok: true };
}

export const JOBS = {
  "milestone-reminders": milestoneReminders,
  "overdue-reminders": overdueReminders,
  "referee-reminders": async () => ({ reminded: await sendRefereeReminders() }),
  "referee-expiry": async () => ({ expired: await expireRefereeLinks() }),
  "dispatch-notifications": () => dispatchDue(100),
  "ai-critiques": () => processCritiqueQueue(5),
  "scholarship-expiry": async () => ({ expired: await expirePastDeadlines() }),
  "embeddings-backfill": async () => ({ embedded: await backfillEmbeddings(50) }),
  "analytics-aggregate": async () => ({ rows: await aggregateDaily() }),
  cleanup,
} as const;
export type JobName = keyof typeof JOBS;

/** Job groups invoked by the scheduler. "frequent" runs every few minutes; "daily" once a day. */
export const JOB_GROUPS: Record<string, JobName[]> = {
  frequent: ["dispatch-notifications", "ai-critiques"],
  hourly: ["referee-expiry", "scholarship-expiry", "embeddings-backfill"],
  daily: ["milestone-reminders", "overdue-reminders", "referee-reminders", "analytics-aggregate", "cleanup", "dispatch-notifications"],
};

export async function runJob(name: JobName) {
  const [run] = await db.insert(jobRuns).values({ job: name }).returning();
  try {
    const result = await JOBS[name]();
    await db.update(jobRuns).set({ status: "succeeded", finishedAt: new Date(), result: result as object }).where(eq(jobRuns.id, run.id));
    return { job: name, ok: true, result };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await db.update(jobRuns).set({ status: "failed", finishedAt: new Date(), error: error.slice(0, 2000) }).where(eq(jobRuns.id, run.id));
    console.error(JSON.stringify({ level: "error", msg: "job failed", job: name, error }));
    return { job: name, ok: false, error };
  }
}

export async function runGroup(group: string) {
  const names = JOB_GROUPS[group];
  if (!names) throw new Error(`Unknown job group ${group}`);
  const results = [];
  for (const n of names) results.push(await runJob(n));
  return results;
}
