"use server";

import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { applicationMilestones, applications, notificationPreferences, notifications } from "@/lib/db/schema";
import { NotFoundError, toActionError, type ActionResult } from "@/lib/errors";
import { attachDocumentToApplication, createApplication, softDeleteApplication, transitionApplication } from "@/lib/services/applications";
import { trackActivity } from "@/lib/services/audit";
import { recalculateForProfileChange, runAssessment } from "@/lib/services/eligibility";
import { generateSchedule, updateMilestone } from "@/lib/services/planner";
import { markOnboardingStep, profileSchema, updateProfile } from "@/lib/services/profile";
import { toggleSaved } from "@/lib/services/scholarships";

const BOOL_FIELDS = ["firstGeneration", "demonstratesFinancialNeed", "hasDisability", "isRefugeeOrDisplaced"];
const NUM_FIELDS = ["graduationYear", "creditPasses", "gradeAverage"];

function profileFromForm(fd: FormData) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (k.startsWith("$") || k === "step" || k === "qualifications") continue;
    const s = String(v);
    if ((k === "firstName" || k === "lastName") && !s.trim()) continue;
    if (BOOL_FIELDS.includes(k)) out[k] = s === "" ? null : s === "true";
    else if (NUM_FIELDS.includes(k)) out[k] = s === "" ? null : s;
    else if (k === "dataProcessingConsent") out[k] = s === "on" || s === "true";
    else out[k] = s === "" ? null : s;
  }
  if (fd.has("qualifications") || fd.has("$qualifications")) out.qualifications = fd.getAll("qualifications").map(String);
  if (fd.has("$consentField") && !fd.has("dataProcessingConsent")) out.dataProcessingConsent = false;
  return out;
}

export async function saveProfileAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const user = await assertUser();
    const input = profileSchema.parse(profileFromForm(fd));
    const changed = await updateProfile(user.id, input, { id: user.id, role: "applicant" });
    const recalculated = await recalculateForProfileChange(user.id, changed);
    const step = fd.get("step");
    if (step === "finish") await markOnboardingStep(user.id, "completed");
    return { ok: true, message: changed.length ? `Saved.${recalculated ? ` ${recalculated} eligibility result${recalculated === 1 ? " was" : "s were"} updated.` : ""}` : "No changes to save." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function finishOnboardingAction(): Promise<void> {
  const user = await assertUser();
  await markOnboardingStep(user.id, "completed");
  redirect("/dashboard?welcome=1");
}

export async function welcomeSeenAction(): Promise<void> {
  const user = await assertUser();
  await markOnboardingStep(user.id, "welcome");
  redirect("/onboarding?step=personal");
}

export async function toggleSaveAction(_: unknown, fd: FormData): Promise<ActionResult<{ saved: boolean }>> {
  try {
    const user = await assertUser();
    const saved = await toggleSaved(user.id, z.string().uuid().parse(fd.get("scholarshipId")));
    return { ok: true, data: { saved }, message: saved ? "Saved to your list." : "Removed from your list." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function eligibilityAction(_: unknown, fd: FormData): Promise<ActionResult<{ assessmentId: string }>> {
  try {
    const user = await assertUser();
    const scholarshipId = z.string().uuid().parse(fd.get("scholarshipId"));
    const answers: Record<string, unknown> = {};
    for (const key of new Set([...fd.keys()].filter((k) => k.startsWith("q:")))) {
      const field = key.slice(2);
      const all = fd.getAll(key).map(String);
      if (fd.get(`multi:${field}`)) answers[field] = all.filter(Boolean);
      else if (all[0] !== undefined && all[0] !== "") answers[field] = all[0];
    }
    const out = await runAssessment(user.id, scholarshipId, { answers, trigger: "manual" });
    return { ok: true, data: { assessmentId: out.assessmentId } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function startApplicationAction(_: unknown, fd: FormData): Promise<ActionResult> {
  let id: string;
  try {
    const user = await assertUser();
    ({ id } = await createApplication(user.id, z.string().uuid().parse(fd.get("scholarshipId"))));
  } catch (e) {
    return toActionError(e);
  }
  redirect(`/applications/${id}`);
}

async function ownApp(userId: string, id: string) {
  const [app] = await db.select().from(applications).where(and(eq(applications.id, id), isNull(applications.deletedAt))).limit(1);
  if (!app || app.userId !== userId) throw new NotFoundError("Application");
  return app;
}

export async function transitionAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const user = await assertUser();
    const id = z.string().uuid().parse(fd.get("applicationId"));
    await ownApp(user.id, id);
    const to = z.enum(["screening", "in_progress", "submitted", "shortlisted", "outcome"]).parse(fd.get("to"));
    await transitionApplication(id, to, { id: user.id, type: "applicant" }, {
      outcome: (fd.get("outcome") as never) || null,
      outcomeNotes: (fd.get("outcomeNotes") as string) || null,
      submissionReference: (fd.get("submissionReference") as string) || null,
      reason: (fd.get("reason") as string) || null,
    });
    await trackActivity(`application.${to}`, { userId: user.id, entityType: "application", entityId: id });
    return { ok: true, message: "Application updated." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function withdrawApplicationAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const user = await assertUser();
    await softDeleteApplication(user.id, z.string().uuid().parse(fd.get("applicationId")));
  } catch (e) {
    return toActionError(e);
  }
  redirect("/applications");
}

export async function regenerateScheduleAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const user = await assertUser();
    const id = z.string().uuid().parse(fd.get("applicationId"));
    await ownApp(user.id, id);
    await generateSchedule(id, user.id, { resetCustom: fd.get("reset") === "1" });
    return { ok: true, message: "Your plan has been recalculated from the official deadline." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function milestoneAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const user = await assertUser();
    const id = z.string().uuid().parse(fd.get("milestoneId"));
    const [m] = await db.select({ appUser: applications.userId }).from(applicationMilestones).innerJoin(applications, eq(applications.id, applicationMilestones.applicationId)).where(eq(applicationMilestones.id, id)).limit(1);
    if (!m || m.appUser !== user.id) throw new NotFoundError("Task");
    const status = fd.get("status") as never;
    const startDate = (fd.get("startDate") as string) || undefined;
    const dueDate = (fd.get("dueDate") as string) || undefined;
    await updateMilestone(id, user.id, {
      status: status || undefined,
      completionNotes: fd.has("completionNotes") ? String(fd.get("completionNotes")) : undefined,
      startDate,
      dueDate,
    });
    return { ok: true, message: status === "completed" ? "Nice work — task completed." : "Task updated." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function attachDocumentAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const user = await assertUser();
    await attachDocumentToApplication(user.id, z.string().uuid().parse(fd.get("applicationId")), z.string().uuid().parse(fd.get("documentId")), (fd.get("requirementId") as string) || null);
    return { ok: true, message: "Document attached." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function markNotificationsAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const user = await assertUser({ verified: false });
    const id = fd.get("id") as string | null;
    const read = fd.get("read") !== "0";
    await db
      .update(notifications)
      .set({ readAt: read ? new Date() : null })
      .where(and(eq(notifications.userId, user.id), eq(notifications.channel, "in_app"), id ? eq(notifications.id, id) : read ? isNull(notifications.readAt) : undefined));
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function preferencesAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const user = await assertUser({ verified: false });
    const b = (k: string) => fd.get(k) === "on";
    const values = { emailEnabled: b("emailEnabled"), smsEnabled: b("smsEnabled"), inAppEnabled: b("inAppEnabled"), milestoneReminders: b("milestoneReminders"), overdueReminders: b("overdueReminders"), refereeUpdates: b("refereeUpdates"), feedbackUpdates: b("feedbackUpdates"), updatedAt: new Date() };
    await db.insert(notificationPreferences).values({ userId: user.id, ...values }).onConflictDoUpdate({ target: notificationPreferences.userId, set: values });
    if (values.smsEnabled) {
      const { consents } = await import("@/lib/db/schema");
      await db.insert(consents).values({ userId: user.id, type: "sms", version: "2026-11" });
    }
    return { ok: true, message: "Notification preferences saved." };
  } catch (e) {
    return toActionError(e);
  }
}
