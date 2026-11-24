"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertPermission } from "@/lib/auth/session";
import type { Permission, Role } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { notificationTemplates } from "@/lib/db/schema";
import type { ActionResult } from "@/lib/errors";
import { toActionError } from "@/lib/errors";
import { assignReviewer, setRolePermission, setUserRole, setUserStatus, unassignReviewer } from "@/lib/services/admin";
import { transitionApplication } from "@/lib/services/applications";
import { audit } from "@/lib/services/audit";
import { deleteResource, saveCategory, saveResource } from "@/lib/services/content";
import { previewAgainstSample } from "@/lib/services/eligibility";
import { runJob, JOBS, type JobName } from "@/lib/services/jobs";
import { cancelNotification, retryNotification } from "@/lib/services/notifications";
import { processDeletion } from "@/lib/services/privacy";
import { cancelRefereeRequest } from "@/lib/services/referees";
import {
  addSource,
  changeScholarshipStatus,
  createScholarship,
  criteriaPayloadSchema,
  duplicateScholarship,
  getScholarshipBundle,
  markSourceOutdated,
  removeSource,
  saveCriteria,
  saveMilestoneTemplates,
  saveRequirements,
  saveRubric,
  updateScholarship,
} from "@/lib/services/scholarships";
import { saveSettings, SETTING_DEFAULTS } from "@/lib/services/settings";
import { storeValidatedFile } from "@/lib/services/documents";
import { scholarshipFiles } from "@/lib/db/schema";
import type { Criterion } from "@/lib/engine/eligibility";

const uuid = z.string().uuid();
const opt = (v: FormDataEntryValue | null) => (v === null || String(v).trim() === "" ? null : String(v));

/* ---------------- scholarships ---------------- */

function scholarshipFromForm(fd: FormData) {
  const tz = String(fd.get("timezone") || "Africa/Lagos");
  const deadlineLocal = opt(fd.get("deadline"));
  const openingLocal = opt(fd.get("openingDate"));
  // datetime-local values are interpreted as Lagos time (UTC+1, no DST)
  const toUtc = (v: string | null) => (v ? new Date(`${v}:00${tz === "Africa/Lagos" ? "+01:00" : "Z"}`) : null);
  return {
    name: String(fd.get("name") ?? ""),
    slug: opt(fd.get("slug")) ?? undefined,
    partnerUniversity: String(fd.get("partnerUniversity") ?? ""),
    country: String(fd.get("country") ?? ""),
    city: opt(fd.get("city")),
    programmeLevel: (fd.get("programmeLevel") as never) || "undergraduate",
    scholarshipType: String(fd.get("scholarshipType") || "Fully funded"),
    programmes: String(fd.get("programmes") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    summary: opt(fd.get("summary")),
    description: String(fd.get("description") ?? ""),
    tuitionCoverage: opt(fd.get("tuitionCoverage")),
    livingAllowance: opt(fd.get("livingAllowance")),
    accommodationBenefits: opt(fd.get("accommodationBenefits")),
    travelBenefits: opt(fd.get("travelBenefits")),
    otherBenefits: opt(fd.get("otherBenefits")),
    openingDate: toUtc(openingLocal),
    deadline: toUtc(deadlineLocal),
    timezone: tz,
    applicationUrl: opt(fd.get("applicationUrl")),
    isFeatured: fd.get("isFeatured") === "on",
    windowStatus: (fd.get("windowStatus") as never) || "open",
    category: (opt(fd.get("category")) as never) ?? null,
    currentWindow: opt(fd.get("currentWindow")),
    nextWindow: opt(fd.get("nextWindow")),
    keyEligibility: opt(fd.get("keyEligibility")),
    logoUrl: opt(fd.get("logoUrl")),
    howToApply: opt(fd.get("howToApply")),
    contactEmail: opt(fd.get("contactEmail")),
    researchSources: opt(fd.get("researchSources")),
  };
}

export async function createScholarshipAction(_: unknown, fd: FormData): Promise<ActionResult> {
  let id: string;
  try {
    const u = await assertPermission("scholarships.manage");
    ({ id } = await createScholarship(scholarshipFromForm(fd), u.id));
  } catch (e) {
    return toActionError(e);
  }
  redirect(`/admin/scholarships/${id}?tab=sources&created=1`);
}

export async function updateScholarshipAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const u = await assertPermission("scholarships.manage");
    await updateScholarship(uuid.parse(fd.get("id")), scholarshipFromForm(fd), u.id);
    return { ok: true, message: "Scholarship saved. A revision snapshot was recorded." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function scholarshipStatusAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const action = z.enum(["submit_for_verification", "verify", "publish", "unpublish", "deactivate", "reactivate", "archive", "expire"]).parse(fd.get("action"));
    const u = await assertPermission(["verify", "publish", "unpublish"].includes(action) ? "scholarships.publish" : "scholarships.manage");
    await changeScholarshipStatus(uuid.parse(fd.get("id")), action, u.id);
    return { ok: true, message: "Status updated." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function duplicateScholarshipAction(_: unknown, fd: FormData): Promise<ActionResult> {
  let id: string;
  try {
    const u = await assertPermission("scholarships.manage");
    ({ id } = await duplicateScholarship(uuid.parse(fd.get("id")), u.id));
  } catch (e) {
    return toActionError(e);
  }
  redirect(`/admin/scholarships/${id}`);
}

export async function saveCriteriaAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const u = await assertPermission("scholarships.manage");
    const payload = criteriaPayloadSchema.parse(JSON.parse(String(fd.get("payload") ?? "{}")));
    await saveCriteria(uuid.parse(fd.get("id")), payload, u.id);
    return { ok: true, message: "Criteria saved. Existing applicant assessments were recalculated." };
  } catch (e) {
    if (e instanceof SyntaxError) return { ok: false, error: "Invalid criteria payload." };
    return toActionError(e);
  }
}

export async function previewCriteriaAction(_: unknown, fd: FormData): Promise<ActionResult<{ result: ReturnType<typeof previewAgainstSample> }>> {
  try {
    await assertPermission("scholarships.manage");
    const payload = criteriaPayloadSchema.parse(JSON.parse(String(fd.get("payload") ?? "{}")));
    const sample = z.record(z.string(), z.unknown()).parse(JSON.parse(String(fd.get("sample") ?? "{}")));
    const criteria: Criterion[] = payload.criteria.map((c, i) => ({ ...c, id: c.id ?? `c${i}`, groupId: c.groupKey ?? null, requiredValue: c.requiredValue ?? null, sortOrder: i }));
    const groups = payload.groups.map((g) => ({ id: g.key, name: g.name, logic: g.logic }));
    const sch = fd.get("id") ? await getScholarshipBundle({ id: uuid.parse(fd.get("id")) }) : null;
    return { ok: true, data: { result: previewAgainstSample(criteria, groups, sample, sch?.scholarship.deadline ?? null) } };
  } catch (e) {
    if (e instanceof SyntaxError) return { ok: false, error: "The sample profile must be valid JSON." };
    return toActionError(e);
  }
}

export async function saveRequirementsAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const u = await assertPermission("scholarships.manage");
    const cats = fd.getAll("category").map(String);
    const names = fd.getAll("name").map(String);
    const descs = fd.getAll("description").map(String);
    const req = fd.getAll("isRequired").map(String);
    const sections = fd.getAll("section").map(String);
    const rows = cats.map((category, i) => ({ category, name: names[i]?.trim(), description: descs[i]?.trim() || null, section: sections[i] === "scholarship" ? "scholarship" : "admission", isRequired: req[i] === "true" })).filter((r) => r.name) as never;
    await saveRequirements(uuid.parse(fd.get("id")), rows, u.id);
    return { ok: true, message: "Required documents saved." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function saveMilestonesAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const u = await assertPermission("scholarships.manage");
    const keys = fd.getAll("key").map(String);
    const rows = keys
      .map((key, i) => ({
        key: key.trim(),
        name: String(fd.getAll("name")[i] ?? "").trim(),
        description: String(fd.getAll("description")[i] ?? "").trim() || null,
        durationDays: Number(fd.getAll("durationDays")[i]),
        dependsOn: String(fd.getAll("dependsOn")[i] ?? "").split(",").map((s) => s.trim()).filter(Boolean),
        priority: String(fd.getAll("priority")[i] ?? "medium"),
        isRequired: String(fd.getAll("isRequired")[i]) === "true",
      }))
      .filter((r) => r.key && r.name) as never;
    const id = opt(fd.get("id"));
    await saveMilestoneTemplates(id, rows, u.id);
    return { ok: true, message: id ? "Milestone template saved for this scholarship." : "Default milestone template saved." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function addSourceAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const u = await assertPermission("scholarships.manage");
    await addSource(uuid.parse(fd.get("id")), { sourceName: String(fd.get("sourceName") ?? ""), url: String(fd.get("url") ?? ""), notes: opt(fd.get("notes")) }, u.id);
    return { ok: true, message: "Source added. Verify it before publishing." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function sourceAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const u = await assertPermission("scholarships.manage");
    const sid = uuid.parse(fd.get("sourceId"));
    if (fd.get("op") === "remove") await removeSource(sid, u.id);
    else await markSourceOutdated(sid, u.id);
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function saveRubricAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const u = await assertPermission("scholarships.manage");
    const labels = fd.getAll("label").map(String);
    const guidance = fd.getAll("guidance").map(String);
    const dims = labels.map((label, i) => ({ key: label.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 60), label: label.trim(), guidance: guidance[i]?.trim() || undefined })).filter((d) => d.label);
    await saveRubric(uuid.parse(fd.get("id")), { values: opt(fd.get("values")), dimensions: dims }, u.id);
    return { ok: true, message: "Rubric saved as a new version." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function uploadScholarshipFileAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const u = await assertPermission("scholarships.manage");
    const id = uuid.parse(fd.get("id"));
    const file = fd.get("file");
    if (!(file instanceof File) || !file.size) return { ok: false, error: "Choose a file." };
    const stored = await storeValidatedFile(file, `scholarships/${id}`);
    await db.insert(scholarshipFiles).values({ scholarshipId: id, name: (opt(fd.get("name")) ?? stored.filename).slice(0, 250), storageKey: stored.key, mimeType: stored.mime, sizeBytes: stored.size, uploadedBy: u.id });
    await audit({ eventType: "scholarship.file_uploaded", actorId: u.id, actorRole: "admin", targetType: "scholarship", targetId: id });
    return { ok: true, message: "File uploaded." };
  } catch (e) {
    return toActionError(e);
  }
}

/* ---------------- applications & reviewers ---------------- */

export async function assignReviewerAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const u = await assertPermission("reviewers.assign");
    const appId = uuid.parse(fd.get("applicationId"));
    const reviewerId = uuid.parse(fd.get("reviewerId"));
    if (fd.get("op") === "remove") await unassignReviewer(u, appId, reviewerId);
    else await assignReviewer(u, appId, reviewerId);
    return { ok: true, message: fd.get("op") === "remove" ? "Reviewer removed." : "Reviewer assigned and notified." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function adminTransitionAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const u = await assertPermission("applications.manage");
    await transitionApplication(uuid.parse(fd.get("applicationId")), z.enum(["draft", "screening", "eligible", "ineligible", "in_progress", "submitted", "shortlisted", "outcome"]).parse(fd.get("to")), { id: u.id, type: "admin" }, {
      reason: opt(fd.get("reason")),
      outcome: (opt(fd.get("outcome")) as never) ?? null,
      outcomeNotes: opt(fd.get("outcomeNotes")),
    });
    return { ok: true, message: "Application updated and audited." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function adminCancelRefereeAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const u = await assertPermission("referees.manage");
    await cancelRefereeRequest(u, uuid.parse(fd.get("requestId")));
    return { ok: true, message: "Referee link revoked." };
  } catch (e) {
    return toActionError(e);
  }
}

/* ---------------- notifications ---------------- */

export async function notificationOpAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const u = await assertPermission("notifications.manage");
    const id = uuid.parse(fd.get("id"));
    if (fd.get("op") === "cancel") await cancelNotification(id, u.id);
    else await retryNotification(id, u.id);
    return { ok: true, message: fd.get("op") === "cancel" ? "Cancelled." : "Retry attempted — see the delivery log." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function saveTemplateAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const u = await assertPermission("templates.manage");
    const id = uuid.parse(fd.get("id"));
    const body = String(fd.get("body") ?? "").trim();
    if (!body) return { ok: false, error: "The template body can't be empty." };
    const [prev] = await db.select().from(notificationTemplates).where(eq(notificationTemplates.id, id)).limit(1);
    await db.update(notificationTemplates).set({ subject: opt(fd.get("subject")), body, isActive: fd.get("isActive") === "on", updatedBy: u.id, updatedAt: new Date() }).where(eq(notificationTemplates.id, id));
    await audit({ eventType: "notification.template_updated", actorId: u.id, actorRole: "admin", targetType: "notification_template", targetId: id, previousState: { subject: prev?.subject, body: prev?.body }, newState: { subject: opt(fd.get("subject")), body } });
    return { ok: true, message: "Template saved." };
  } catch (e) {
    return toActionError(e);
  }
}

/* ---------------- content ---------------- */

export async function saveResourceAction(_: unknown, fd: FormData): Promise<ActionResult> {
  let id: string;
  try {
    const u = await assertPermission("content.manage");
    const existing = opt(fd.get("id"));
    const row = await saveResource(existing, {
      title: String(fd.get("title") ?? ""),
      slug: opt(fd.get("slug")) ?? undefined,
      categoryId: opt(fd.get("categoryId")),
      type: String(fd.get("type") ?? "article"),
      description: opt(fd.get("description")),
      body: String(fd.get("body") ?? ""),
      featuredImageUrl: opt(fd.get("featuredImageUrl")),
      externalUrl: opt(fd.get("externalUrl")),
      authorName: opt(fd.get("authorName")),
      status: (fd.get("status") as never) ?? "draft",
      visibility: (fd.get("visibility") as never) ?? "public",
      publishedAt: opt(fd.get("publishedAt")) as never,
      seoTitle: opt(fd.get("seoTitle")),
      seoDescription: opt(fd.get("seoDescription")),
      tags: String(fd.get("tags") ?? "").split(",").map((t) => t.trim()).filter(Boolean),
    }, u.id);
    if (existing) return { ok: true, message: "Saved." };
    id = row.id;
  } catch (e) {
    return toActionError(e);
  }
  redirect(`/admin/content/${id}?created=1`);
}

export async function archiveResourceAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const u = await assertPermission("content.manage");
    await deleteResource(uuid.parse(fd.get("id")), u.id);
    return { ok: true, message: "Archived." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function saveCategoryAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const u = await assertPermission("content.manage");
    await saveCategory({ name: String(fd.get("name") ?? ""), description: opt(fd.get("description")) }, u.id);
    return { ok: true, message: "Category saved." };
  } catch (e) {
    return toActionError(e);
  }
}

/* ---------------- users & roles ---------------- */

export async function userRoleAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const u = await assertPermission("roles.manage");
    await setUserRole(u, uuid.parse(fd.get("userId")), z.enum(["applicant", "reviewer", "admin", "super_admin"]).parse(fd.get("role")) as Role, fd.get("grant") === "1");
    return { ok: true, message: "Roles updated." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function userStatusAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const u = await assertPermission("users.manage");
    await setUserStatus(u, uuid.parse(fd.get("userId")), fd.get("status") === "suspended" ? "suspended" : "active");
    return { ok: true, message: "Account status updated." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function rolePermissionAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const u = await assertPermission("roles.manage");
    await setRolePermission(u, z.enum(["applicant", "reviewer", "admin", "super_admin"]).parse(fd.get("role")) as Role, String(fd.get("permission")) as Permission, fd.get("grant") === "1");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

/* ---------------- settings, jobs, privacy ---------------- */

export async function saveSettingsAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const u = await assertPermission("settings.manage");
    const values: Record<string, unknown> = {};
    for (const [key, def] of Object.entries(SETTING_DEFAULTS)) {
      if (!fd.has(key) && !fd.has(`$${key}`)) continue;
      const raw = fd.get(key);
      if (typeof def === "boolean") values[key] = raw === "on";
      else if (typeof def === "number") {
        const n = Number(raw);
        if (!Number.isFinite(n) || n <= 0) return { ok: false, error: `${key.replace(/_/g, " ")} must be a positive number.` };
        values[key] = n;
      } else if (Array.isArray(def)) {
        const list = fd.getAll(key).flatMap((v) => String(v).split(",")).map((s) => s.trim()).filter(Boolean);
        values[key] = typeof def[0] === "number" ? list.map(Number).filter((n) => Number.isInteger(n) && n >= 0) : list;
      } else if (typeof def === "object") {
        const obj: Record<string, string> = {};
        for (const k of Object.keys(def)) {
          const v = String(fd.get(`${key}.${k}`) ?? "");
          if (!/^#[0-9a-fA-F]{6}$/.test(v)) return { ok: false, error: "Brand colours must be hex values like #0B1F3A." };
          obj[k] = v;
        }
        values[key] = obj;
      } else values[key] = String(raw ?? "");
    }
    if (values.upload_max_mb !== undefined && Number(values.upload_max_mb) > 50) return { ok: false, error: "Upload limit can't exceed 50 MB." };
    const { previous } = await saveSettings(values as never, u.id);
    await audit({ eventType: "settings.updated", actorId: u.id, actorRole: "admin", targetType: "platform_settings", targetId: "global", previousState: previous, newState: values });
    return { ok: true, message: "Settings saved." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function runJobAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const u = await assertPermission("settings.manage");
    const name = String(fd.get("job")) as JobName;
    if (!(name in JOBS)) return { ok: false, error: "Unknown job." };
    const r = await runJob(name);
    await audit({ eventType: "job.manual_run", actorId: u.id, actorRole: "admin", targetType: "job", targetId: name, metadata: { ok: r.ok } });
    return r.ok ? { ok: true, message: `${name}: ${JSON.stringify(r.result)}` } : { ok: false, error: `${name} failed: ${r.error}` };
  } catch (e) {
    return toActionError(e);
  }
}

export async function dataRequestAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const u = await assertPermission("data_requests.manage");
    await processDeletion(uuid.parse(fd.get("id")), u.id, fd.get("decision") === "reject" ? "reject" : "complete", opt(fd.get("notes")));
    return { ok: true, message: "Request processed." };
  } catch (e) {
    return toActionError(e);
  }
}
