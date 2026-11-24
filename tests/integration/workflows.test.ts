import { beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  aiCritiqueApprovals,
  applicationMilestones,
  applications,
  auditLogs,
  documents,
  documentVersions,
  essayFeedback,
  essays,
  notificationDeliveryAttempts,
  notifications,
  profiles,
  refereeRequests,
  scholarships,
  users,
} from "@/lib/db/schema";
import { AppError } from "@/lib/errors";
import { count, ELIGIBLE_PROFILE, makeUser, outboxLinks, pdf } from "./helpers";

// AI provider is mocked so the full human-approval pipeline can be tested without credentials.
vi.mock("@/lib/integrations/ai", async (orig) => {
  const real = await orig<typeof import("@/lib/integrations/ai")>();
  return {
    ...real,
    aiStatus: () => ({ configured: true, provider: "Mock", model: "mock-model", missing: [] }),
    generateCritique: vi.fn(async () => ({
      provider: "mock",
      model: "mock-model",
      inputTokens: 10,
      outputTokens: 20,
      critique: {
        overall_summary: "A sincere essay with a strong opening.",
        strengths: ["Specific opening moment"],
        areas_for_improvement: ["Add reflection on what you learned"],
        specific_observations: [{ quote: "I started a club", observation: "Say how many joined." }],
        evidence_gaps: ["No outcome numbers"],
        questions_to_consider: ["What changed in you?"],
        rubric_evaluation: [{ dimension: "Clarity", rating: "strong", comment: "Clear." }],
        revision_priorities: [{ priority: 1, action: "Add a reflection paragraph." }],
        word_count_compliance: { compliant: true, note: "Within limit." },
      },
    })),
  };
});

const S = await import("@/lib/services/scholarships");
const E = await import("@/lib/services/eligibility");
const A = await import("@/lib/services/applications");
const D = await import("@/lib/services/documents");
const ES = await import("@/lib/services/essays");
const R = await import("@/lib/services/referees");
const N = await import("@/lib/services/notifications");
const P = await import("@/lib/services/planner");
const AU = await import("@/lib/services/auth");
const ACC = await import("@/lib/services/access");
const ADM = await import("@/lib/services/admin");
const PRIV = await import("@/lib/services/privacy");
const JOBS = await import("@/lib/services/jobs");

let admin: Awaited<ReturnType<typeof makeUser>>;
let scholarshipId: string;

async function publishedScholarship(daysToDeadline = 90) {
  const s = await S.createScholarship(
    { name: `Test Scholarship ${Math.random().toString(36).slice(2, 7)}`, partnerUniversity: "Test University", country: "Ghana", programmeLevel: "undergraduate", scholarshipType: "Fully funded", programmes: ["CS"], description: "x", timezone: "Africa/Lagos", isFeatured: false, deadline: new Date(Date.now() + daysToDeadline * 86_400_000), applicationUrl: "https://example.org/apply" } as never,
    admin.id,
  );
  await S.addSource(s.id, { sourceName: "Official page", url: "https://example.org/official", notes: null }, admin.id);
  await S.saveCriteria(
    s.id,
    {
      groups: [{ key: "g1", name: "Priority", logic: "or" }],
      criteria: [
        { name: "Age", fieldKey: "age", operator: "lte", requiredValue: 29, severity: "absolute", isFixable: false, isRequired: true },
        { name: "Citizenship", fieldKey: "country_of_citizenship", operator: "eq", requiredValue: "Nigeria", severity: "absolute", isFixable: false, isRequired: true },
        { name: "Credits", fieldKey: "credit_passes", operator: "gte", requiredValue: 5, severity: "important", isFixable: true, isRequired: true },
        { name: "Need", fieldKey: "demonstrates_financial_need", operator: "is_true", severity: "important", isFixable: true, isRequired: true, groupKey: "g1" },
        { name: "First gen", fieldKey: "first_generation", operator: "is_true", severity: "important", isFixable: true, isRequired: true, groupKey: "g1" },
      ] as never,
    },
    admin.id,
  );
  await S.saveRequirements(s.id, [
    { category: "academic_transcript", name: "Transcript", description: null, isRequired: true },
    { category: "recommendation_letter", name: "Reference letter", description: null, isRequired: true },
  ], admin.id);
  await S.changeScholarshipStatus(s.id, "verify", admin.id);
  await S.changeScholarshipStatus(s.id, "publish", admin.id);
  return s.id;
}

beforeAll(async () => {
  admin = await makeUser(["admin", "reviewer"]);
  scholarshipId = await publishedScholarship();
});

describe("authentication", () => {
  it("registers, sends a verification link, verifies, and logs in", async () => {
    const email = `reg${Date.now()}@test.soar`;
    const { userId } = await AU.register({ firstName: "Ada", lastName: "Eze", email, password: "Blue-river-77x", confirmPassword: "Blue-river-77x", privacyConsent: true, termsConsent: true }, { ip: "1.1.1.1", userAgent: "t" });
    const link = outboxLinks(email).find((l) => l.includes("/verify-email?token="));
    expect(link).toBeTruthy();
    const token = new URL(link!).searchParams.get("token")!;
    expect(await AU.verifyEmail(token, { ip: null, userAgent: null })).toBe("verified");
    expect(await AU.verifyEmail(token, { ip: null, userAgent: null })).toBe("invalid"); // single use
    const [u] = await db.select().from(users).where(eq(users.id, userId));
    expect(u.emailVerifiedAt).not.toBeNull();
    // secret link was scrubbed from the notification record after sending
    const [n] = await db.select().from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.templateKey, "auth.verify_email")));
    expect(n.status).toBe("sent");
    expect(n.actionUrl).toBeNull();
    const res = await AU.login({ email, password: "Blue-river-77x" }, { ip: "1.1.1.1", userAgent: "t" });
    expect(res.verified).toBe(true);
    await expect(AU.login({ email, password: "wrong-password-1" }, { ip: "1.1.1.1", userAgent: "t" })).rejects.toThrow(/didn't work/);
  });

  it("rejects duplicate emails and weak passwords", async () => {
    const email = `dup${Date.now()}@test.soar`;
    await AU.register({ firstName: "A", lastName: "B", email, password: "Blue-river-77x", confirmPassword: "Blue-river-77x", privacyConsent: true, termsConsent: true }, { ip: "2.2.2.2", userAgent: null });
    await expect(AU.register({ firstName: "A", lastName: "B", email, password: "Blue-river-77x", confirmPassword: "Blue-river-77x", privacyConsent: true, termsConsent: true }, { ip: "2.2.2.2", userAgent: null })).rejects.toThrow(/already exists/);
    await expect(AU.register({ firstName: "A", lastName: "B", email: `x${email}`, password: "password12345", confirmPassword: "password12345", privacyConsent: true, termsConsent: true }, { ip: "2.2.2.2", userAgent: null })).rejects.toThrow();
  });

  it("resets a password with a single-use token", async () => {
    const u = await makeUser();
    await AU.requestPasswordReset(u.email, { ip: "3.3.3.3", userAgent: null });
    const token = new URL(outboxLinks(u.email).find((l) => l.includes("reset-password"))!).searchParams.get("token")!;
    expect(await AU.checkResetToken(token)).toBe(true);
    await AU.resetPassword(token, "New-strong-pass-9", { ip: null, userAgent: null });
    await expect(AU.resetPassword(token, "Another-pass-99", { ip: null, userAgent: null })).rejects.toThrow(/invalid or has expired/);
    expect((await AU.login({ email: u.email, password: "New-strong-pass-9" }, { ip: "3.3.3.3", userAgent: null })).userId).toBe(u.id);
  });
});

describe("scholarship administration", () => {
  it("refuses to publish without a verified source and valid setup", async () => {
    const s = await S.createScholarship({ name: "Unverified", partnerUniversity: "Uni X", country: "Kenya", programmeLevel: "undergraduate", scholarshipType: "Fully funded", programmes: [], description: "", timezone: "Africa/Lagos", isFeatured: false } as never, admin.id);
    await expect(S.changeScholarshipStatus(s.id, "publish", admin.id)).rejects.toThrow(/can't be published/);
    const problems = await S.publicationProblems(s.id);
    expect(problems.join(" ")).toMatch(/official source/);
    expect(problems.join(" ")).toMatch(/key eligibility/);
  });

  it("publishes, appears publicly, deactivates while preserving history", async () => {
    const id = await publishedScholarship();
    const list = await S.listPublicScholarships({ pageSize: 50 });
    expect(list.rows.some((r) => r.id === id)).toBe(true);
    await S.changeScholarshipStatus(id, "deactivate", admin.id);
    expect((await S.listPublicScholarships({ pageSize: 50 })).rows.some((r) => r.id === id)).toBe(false);
    expect((await S.revisions(id)).length).toBeGreaterThan(3);
    expect(await count("audit_logs", `target_id = '${id}' AND event_type = 'scholarship.publish'`)).toBe(1);
  });

  it("validates criteria before saving", async () => {
    await expect(S.saveCriteria(scholarshipId, { groups: [], criteria: [{ name: "", fieldKey: "nope", operator: "eq", requiredValue: null, severity: "important", isFixable: true, isRequired: true }] as never }, admin.id)).rejects.toThrow();
    await expect(S.saveCriteria(scholarshipId, { groups: [], criteria: [{ name: "Bad", fieldKey: "nope", operator: "eq", requiredValue: "x", severity: "important", isFixable: true, isRequired: true }] as never }, admin.id)).rejects.toThrow(AppError);
  });
});

describe("eligibility → application → submission", () => {
  it("runs the full applicant workflow with guarded transitions", async () => {
    const applicant = await makeUser(["applicant"]);
    // 1. adaptive questions: nothing known yet
    const { questions } = await E.pendingQuestions(applicant.id, scholarshipId);
    expect(questions.map((q) => q.fieldKey)).toContain("date_of_birth");
    // 2. answer → profile updated, verdict likely eligible
    const out = await E.runAssessment(applicant.id, scholarshipId, { answers: { date_of_birth: "2006-03-01", country_of_citizenship: "Nigeria", credit_passes: "7", demonstrates_financial_need: "true" } });
    expect(out.evaluation.overall).toBe("likely_eligible");
    const [p] = await db.select().from(profiles).where(eq(profiles.userId, applicant.id));
    expect(p.creditPasses).toBe(7);
    // 3. create application → screening → eligible, milestones generated
    const { id } = await A.createApplication(applicant.id, scholarshipId);
    let [app] = await db.select().from(applications).where(eq(applications.id, id));
    expect(app.status).toBe("eligible");
    const ms = await db.select().from(applicationMilestones).where(eq(applicationMilestones.applicationId, id));
    expect(ms.length).toBe(13);
    // 4. invalid transition is rejected
    await expect(A.transitionApplication(id, "submitted", { id: applicant.id, type: "applicant" })).rejects.toThrow(/can't move/);
    await A.transitionApplication(id, "in_progress", { id: applicant.id, type: "applicant" });
    // 5. submission blocked until documents + tasks complete
    await expect(A.transitionApplication(id, "submitted", { id: applicant.id, type: "applicant" })).rejects.toThrow(/Required document not ready/);
    const reqs = await A.checklistFor(id);
    const transcriptReq = reqs.documents.find((d) => d.category === "academic_transcript")!;
    await D.uploadDocument(applicant, { file: pdf("transcript.pdf"), category: "academic_transcript", applicationId: id, requirementId: transcriptReq.requirementId });
    // reference letter via referee workflow
    const rr = await R.createRefereeRequest(applicant, { applicationId: id, refereeName: "Mrs Teacher", refereeEmail: `ref${Date.now()}@school.test`, relationship: "Teacher", deadline: new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10) });
    const link = outboxLinks(rr.refereeEmail).find((l) => l.includes("/referee/"))!;
    const token = link.split("/referee/")[1];
    const opened = await R.openRefereeLink(token, { ip: "9.9.9.9", userAgent: null });
    expect(opened.state).toBe("valid");
    expect(opened.view).not.toHaveProperty("refereeEmail");
    await R.submitRefereeLetter(token, pdf("letter.pdf"), "Mrs Teacher", { ip: "9.9.9.9", userAgent: null });
    await expect(R.submitRefereeLetter(token, pdf("letter2.pdf"), "Mrs Teacher", { ip: "9.9.9.9", userAgent: null })).rejects.toThrow(/expired or has already been used/);
    expect((await R.openRefereeLink(token, { ip: null, userAgent: null })).state).toBe("used");
    // still blocked by milestones
    await expect(A.transitionApplication(id, "submitted", { id: applicant.id, type: "applicant" })).rejects.toThrow(/Required task not completed/);
    await db.update(applicationMilestones).set({ status: "completed" }).where(eq(applicationMilestones.applicationId, id));
    await A.transitionApplication(id, "submitted", { id: applicant.id, type: "applicant" }, { submissionReference: "REF-1" });
    await A.transitionApplication(id, "outcome", { id: admin.id, type: "admin" }, { outcome: "awarded" });
    [app] = await db.select().from(applications).where(eq(applications.id, id));
    expect(app.status).toBe("outcome");
    expect(app.outcome).toBe("awarded");
    expect(app.progress).toBe(100);
    expect(await count("application_state_transitions", `application_id = '${id}'`)).toBeGreaterThanOrEqual(6);
  });

  it("recalculates eligibility when the profile changes and keeps history", async () => {
    const u = await makeUser(["applicant"], ELIGIBLE_PROFILE);
    await E.runAssessment(u.id, scholarshipId);
    const { updateProfile } = await import("@/lib/services/profile");
    const changed = await updateProfile(u.id, { dateOfBirth: "1980-01-01" }, { id: u.id, role: "applicant" });
    expect(await E.recalculateForProfileChange(u.id, changed)).toBe(1);
    const cur = await E.currentAssessment(u.id, scholarshipId);
    expect(cur?.overallVerdict).toBe("not_eligible");
    expect(cur?.trigger).toBe("profile_change");
    expect((await E.assessmentHistory(u.id, scholarshipId)).length).toBe(2);
  });

  it("returns 'more information needed' rather than ineligible for missing data", async () => {
    const u = await makeUser(["applicant"], { dateOfBirth: "2005-01-01" });
    const out = await E.runAssessment(u.id, scholarshipId);
    expect(out.evaluation.overall).toBe("more_info_needed");
    expect(out.questions.length).toBeGreaterThan(0);
  });

  it("recalculates milestones when the official deadline changes", async () => {
    const u = await makeUser(["applicant"], ELIGIBLE_PROFILE);
    const sid = await publishedScholarship(60);
    await E.runAssessment(u.id, sid);
    const { id } = await A.createApplication(u.id, sid);
    const before = (await db.select().from(applicationMilestones).where(and(eq(applicationMilestones.applicationId, id), eq(applicationMilestones.templateKey, "submit"))))[0];
    const [s] = await db.select().from(scholarships).where(eq(scholarships.id, sid));
    await S.updateScholarship(sid, { ...s, deadline: new Date(Date.now() + 10 * 86_400_000), programmes: s.programmes } as never, admin.id);
    const after = (await db.select().from(applicationMilestones).where(and(eq(applicationMilestones.applicationId, id), eq(applicationMilestones.templateKey, "submit"))))[0];
    expect(after.dueDate < before.dueDate).toBe(true);
    const [app] = await db.select().from(applications).where(eq(applications.id, id));
    expect(app.scheduleCompressed).toBe(true);
    expect(JSON.parse(app.scheduleWarning!).warnings.length).toBeGreaterThan(0);
  });
});

describe("documents & access control", () => {
  it("versions documents, never overwrites, and enforces access", async () => {
    const owner = await makeUser(["applicant"], ELIGIBLE_PROFILE);
    const other = await makeUser(["applicant"]);
    const reviewer = await makeUser(["reviewer"]);
    await E.runAssessment(owner.id, scholarshipId);
    const { id: appId } = await A.createApplication(owner.id, scholarshipId);
    const first = await D.uploadDocument(owner, { file: pdf("cv.pdf", "%PDF-1.4\nVersion one text"), category: "cv", applicationId: appId });
    const second = await D.uploadDocument(owner, { file: pdf("cv2.pdf", "%PDF-1.4\nVersion two text"), category: "cv", documentId: first.documentId });
    expect(second.version.versionNumber).toBe(2);
    const versions = await db.select().from(documentVersions).where(eq(documentVersions.documentId, first.documentId));
    expect(versions).toHaveLength(2);
    expect(new Set(versions.map((v) => v.storageKey)).size).toBe(2);
    // immutability enforced in the database
    await expect(db.update(documentVersions).set({ storageKey: "x" }).where(eq(documentVersions.id, versions[0].id))).rejects.toThrow();
    await expect(db.delete(documentVersions).where(eq(documentVersions.id, versions[0].id))).rejects.toThrow();
    // access control
    await expect(D.documentAccess(other, first.documentId)).rejects.toThrow(/not found/);
    await expect(D.documentAccess(reviewer, first.documentId)).rejects.toThrow(/not found/);
    await ADM.assignReviewer(admin, appId, reviewer.id);
    expect((await D.documentAccess(reviewer, first.documentId)).access).toBe("reviewer");
    await expect(ACC.applicationAccess(other, appId)).rejects.toThrow(/not found/);
    // signed download URL is short-lived and not a permanent public path
    const url = await D.signedDownloadUrl(owner, versions[0].id);
    expect(url).toMatch(/sig=/);
    expect(url).toMatch(/exp=/);
    // invalid files rejected
    await expect(D.uploadDocument(owner, { file: new File([Buffer.from("MZ binary")], "evil.pdf", { type: "application/pdf" }), category: "cv" })).rejects.toThrow(/recognise/);
    // anchored comment must match that version's text
    await D.requestDocumentReview(owner, first.documentId);
    const v2 = versions.find((v) => v.versionNumber === 2)!;
    await expect(D.addDocumentComment(reviewer, v2.id, "Nice", { selectedText: "not in the document", startOffset: null, endOffset: null })).rejects.toThrow(/wasn't found/);
    const [v2row] = await db.select().from(documentVersions).where(eq(documentVersions.id, v2.id));
    if (v2row.extractedText) {
      await D.addDocumentComment(reviewer, v2.id, "Expand this", { selectedText: v2row.extractedText.slice(0, 5), startOffset: 0, endOffset: 5 });
    } else {
      await D.addDocumentComment(reviewer, v2.id, "General comment", null);
    }
    await D.decideReview(reviewer, v2.id, "needs_revision", "Add dates");
    const [doc] = await db.select().from(documents).where(eq(documents.id, first.documentId));
    expect(doc.reviewStatus).toBe("needs_revision");
    await expect(D.decideReview(owner, v2.id, "approved", null)).rejects.toThrow();
  });
});

describe("essays & AI critique with mandatory human approval", () => {
  it("never shows AI output until a reviewer approves it", async () => {
    const owner = await makeUser(["applicant"], ELIGIBLE_PROFILE);
    const reviewer = await makeUser(["reviewer"]);
    await E.runAssessment(owner.id, scholarshipId);
    const { id: appId } = await A.createApplication(owner.id, scholarshipId);
    await ADM.assignReviewer(admin, appId, reviewer.id);
    process.env.AI_PROVIDER = "anthropic";
    const essay = await ES.createEssay(owner, { title: "Why me", prompt: "Tell us about leadership", body: "I started a club at school and ".repeat(10), applicationId: appId });
    await ES.saveEssay(owner, essay.id, { title: "Why me", prompt: "Tell us about leadership", body: "I started a club at school and it grew. ".repeat(10), applicationId: appId });
    await ES.submitEssayForReview(owner, essay.id);
    const [e1] = await db.select().from(essays).where(eq(essays.id, essay.id));
    expect(e1.status).toBe("human_review_pending");
    expect(await count("essay_feedback", `essay_id = '${essay.id}'`)).toBe(0); // nothing published
    const queue = await ES.aiQueue(reviewer);
    const item = queue.find((q) => q.essay_id === essay.id)!;
    expect(item.decision).toBe("pending");
    // the applicant cannot approve their own critique
    await expect(ES.approveCritique(owner, item.approval_id, null, null)).rejects.toThrow();
    // reviewer edits and approves
    const edited = { overall_summary: "Edited by reviewer.", strengths: ["A"], areas_for_improvement: ["B"], specific_observations: [], evidence_gaps: [], questions_to_consider: [], rubric_evaluation: [{ dimension: "Clarity", rating: "strong", comment: "ok" }], revision_priorities: [{ priority: 1, action: "Reflect more." }], word_count_compliance: { compliant: true, note: "ok" } };
    await ES.approveCritique(reviewer, item.approval_id, edited, "fine");
    const [ap] = await db.select().from(aiCritiqueApprovals).where(eq(aiCritiqueApprovals.id, item.approval_id));
    expect(ap.decision).toBe("approved");
    expect((ap.changesMade as { fields: string[] }).fields).toContain("overall_summary");
    const fb = await db.select().from(essayFeedback).where(eq(essayFeedback.essayId, essay.id));
    expect(fb).toHaveLength(1);
    expect(fb[0].source).toBe("ai_approved");
    expect((fb[0].critique as { overall_summary: string }).overall_summary).toBe("Edited by reviewer.");
    await expect(ES.approveCritique(reviewer, item.approval_id, null, null)).rejects.toThrow(/already been decided/);
    expect(await count("audit_logs", `event_type IN ('ai.critique_generated','ai.critique_approved') AND target_id IN ('${essay.id}','${item.approval_id}')`)).toBe(2);
    await ES.completeEssayReview(reviewer, essay.id, "revision_requested", "Good start");
    expect((await db.select().from(essays).where(eq(essays.id, essay.id)))[0].status).toBe("revision_requested");
    process.env.AI_PROVIDER = "none";
  });

  it("rejected critiques are never published", async () => {
    const owner = await makeUser(["applicant"], ELIGIBLE_PROFILE);
    await E.runAssessment(owner.id, scholarshipId);
    const { id: appId } = await A.createApplication(owner.id, scholarshipId);
    const essay = await ES.createEssay(owner, { title: "Essay", prompt: "P", body: "word ".repeat(60), applicationId: appId });
    await ES.submitEssayForReview(owner, essay.id);
    const item = (await ES.aiQueue(admin)).find((q) => q.essay_id === essay.id)!;
    await expect(ES.rejectCritique(admin, item.approval_id, null)).rejects.toThrow(/note/);
    await ES.rejectCritique(admin, item.approval_id, "Off-target");
    expect(await count("essay_feedback", `essay_id = '${essay.id}'`)).toBe(0);
  });
});

describe("notifications", () => {
  it("is idempotent per key", async () => {
    const u = await makeUser();
    const key = `test:${Date.now()}`;
    const a = await N.enqueueNotification({ templateKey: "milestone.reminder_7d", channel: "in_app", userId: u.id, idempotencyKey: key, vars: { milestoneName: "X" } });
    const b = await N.enqueueNotification({ templateKey: "milestone.reminder_7d", channel: "in_app", userId: u.id, idempotencyKey: key, vars: { milestoneName: "X" } });
    expect(a).toBeTruthy();
    expect(b).toBeNull();
    expect(await count("notifications", `idempotency_key = '${key}'`)).toBe(1);
  });

  it("retries failed deliveries then marks them failed, and allows manual retry", async () => {
    const u = await makeUser();
    process.env.EMAIL_PROVIDER = "resend"; // no API key → integration not configured
    vi.resetModules();
    const N2 = await import("@/lib/services/notifications");
    const id = await N2.enqueueNotification({ templateKey: "milestone.reminder_7d", channel: "email", userId: u.id, idempotencyKey: `fail:${Date.now()}`, vars: { firstName: "A", milestoneName: "M", scholarshipName: "S", dueDate: "D" } });
    await N2.dispatchNow(id);
    const [n] = await db.select().from(notifications).where(eq(notifications.id, id!));
    expect(n.status).toBe("failed");
    expect(n.lastError).toMatch(/not configured/);
    expect(await count("notification_delivery_attempts", `notification_id = '${id}'`)).toBe(1);
    process.env.EMAIL_PROVIDER = "console";
    vi.resetModules();
    const N3 = await import("@/lib/services/notifications");
    await N3.retryNotification(id!, admin.id);
    const [n2] = await db.select().from(notifications).where(eq(notifications.id, id!));
    expect(n2.status).toBe("sent");
    const attempts = await db.select().from(notificationDeliveryAttempts).where(eq(notificationDeliveryAttempts.notificationId, id!));
    expect(attempts.map((a) => a.status).sort()).toEqual(["failed", "sent"]);
  });

  it("milestone reminder job is idempotent across runs", async () => {
    const u = await makeUser(["applicant"], ELIGIBLE_PROFILE);
    await E.runAssessment(u.id, scholarshipId);
    const { id } = await A.createApplication(u.id, scholarshipId);
    const in7 = new Date(Date.now() + 7 * 86_400_000 + 3_600_000).toISOString().slice(0, 10);
    await db.update(applicationMilestones).set({ dueDate: in7, startDate: in7 }).where(and(eq(applicationMilestones.applicationId, id), eq(applicationMilestones.templateKey, "cv")));
    await JOBS.milestoneReminders();
    const c1 = await count("notifications", `user_id = '${u.id}' AND template_key = 'milestone.reminder_7d'`);
    await JOBS.milestoneReminders();
    const c2 = await count("notifications", `user_id = '${u.id}' AND template_key = 'milestone.reminder_7d'`);
    expect(c1).toBe(2); // email + in-app
    expect(c2).toBe(c1);
  });
});

describe("referee links", () => {
  it("expire, can be revoked, and expose nothing beyond the request", async () => {
    const owner = await makeUser(["applicant"], ELIGIBLE_PROFILE);
    await E.runAssessment(owner.id, scholarshipId);
    const { id: appId } = await A.createApplication(owner.id, scholarshipId);
    const r = await R.createRefereeRequest(owner, { applicationId: appId, refereeName: "Mr Ref", refereeEmail: `r2${Date.now()}@x.test`, relationship: "Mentor", deadline: new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10) });
    const token = outboxLinks(r.refereeEmail).find((l) => l.includes("/referee/"))!.split("/referee/")[1];
    await R.cancelRefereeRequest(owner, r.id);
    expect((await R.openRefereeLink(token, { ip: null, userAgent: null })).state).toBe("revoked");
    await expect(R.submitRefereeLetter(token, pdf(), "Mr Ref", { ip: null, userAgent: null })).rejects.toThrow();
    // expiry job
    const r2 = await R.createRefereeRequest(owner, { applicationId: appId, refereeName: "Ms Two", refereeEmail: `r3${Date.now()}@x.test`, relationship: "Teacher", deadline: new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10) });
    await db.update(refereeRequests).set({ tokenExpiresAt: new Date(Date.now() - 1000) }).where(eq(refereeRequests.id, r2.id));
    expect(await R.expireRefereeLinks()).toBeGreaterThanOrEqual(1);
    expect((await db.select().from(refereeRequests).where(eq(refereeRequests.id, r2.id)))[0].status).toBe("expired");
    expect((await R.openRefereeLink("x".repeat(43), { ip: null, userAgent: null })).state).toBe("invalid");
  });
});

describe("audit trail & privacy", () => {
  it("audit logs are append-only at the database level", async () => {
    const [row] = await db.select().from(auditLogs).limit(1);
    const cause = async (p: Promise<unknown>) => {
      try {
        await p;
        return "no error";
      } catch (e) {
        return String((e as { cause?: Error }).cause?.message ?? (e as Error).message);
      }
    };
    expect(await cause(db.update(auditLogs).set({ eventType: "tampered" }).where(eq(auditLogs.id, row.id)))).toMatch(/append-only/);
    expect(await cause(db.delete(auditLogs).where(eq(auditLogs.id, row.id)))).toMatch(/append-only/);
    expect(await cause(db.execute(sql`TRUNCATE audit_logs`))).toMatch(/append-only/);
    const [still] = await db.select().from(auditLogs).where(eq(auditLogs.id, row.id));
    expect(still.eventType).toBe(row.eventType);
  });

  it("exports data and anonymises on deletion while keeping application history", async () => {
    const u = await makeUser(["applicant"], ELIGIBLE_PROFILE);
    await E.runAssessment(u.id, scholarshipId);
    const { id: appId } = await A.createApplication(u.id, scholarshipId);
    const exp = await PRIV.buildExport(u.id);
    expect(exp.account.email).toBe(u.email);
    expect(JSON.stringify(exp)).not.toMatch(/token_hash|storageKey/);
    const req = await PRIV.requestDeletion(u.id, "bye");
    await PRIV.processDeletion(req.id, admin.id, "complete", null);
    const [after] = await db.select().from(users).where(eq(users.id, u.id));
    expect(after.status).toBe("deleted");
    expect(after.email).toMatch(/deleted\+/);
    expect((await db.select().from(profiles).where(eq(profiles.userId, u.id)))[0].dateOfBirth).toBeNull();
    expect(await count("applications", `id = '${appId}'`)).toBe(1);
  });
});

describe("profile", () => {
  it("partial updates never clear fields from other sections (regression)", async () => {
    const u = await makeUser(["applicant"], { stateOfOrigin: "Kano", countryOfCitizenship: "Nigeria", currentSchool: "Old School" });
    const { updateProfile } = await import("@/lib/services/profile");
    await updateProfile(u.id, { creditPasses: 6 } as never, { id: u.id, role: "applicant" });
    const [p] = await db.select().from(profiles).where(eq(profiles.userId, u.id));
    expect(p.stateOfOrigin).toBe("Kano");
    expect(p.countryOfCitizenship).toBe("Nigeria");
    expect(p.currentSchool).toBe("Old School");
    expect(p.creditPasses).toBe(6);
    await updateProfile(u.id, { currentSchool: "" } as never, { id: u.id, role: "applicant" });
    expect((await db.select().from(profiles).where(eq(profiles.userId, u.id)))[0].currentSchool).toBeNull();
  });
});

describe("planner service", () => {
  it("applicant date adjustments are validated and kept on recalculation", async () => {
    const u = await makeUser(["applicant"], ELIGIBLE_PROFILE);
    await E.runAssessment(u.id, scholarshipId);
    const { id } = await A.createApplication(u.id, scholarshipId);
    const [m] = await db.select().from(applicationMilestones).where(and(eq(applicationMilestones.applicationId, id), eq(applicationMilestones.templateKey, "cv")));
    await expect(P.updateMilestone(m.id, u.id, { startDate: m.dueDate, dueDate: m.startDate === m.dueDate ? "2000-01-01" : m.startDate })).rejects.toThrow(/before the start date/);
    const newDue = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
    const newStart = new Date(Date.now() + 18 * 86_400_000).toISOString().slice(0, 10);
    await P.updateMilestone(m.id, u.id, { startDate: newStart, dueDate: newDue });
    await P.generateSchedule(id, u.id);
    const [kept] = await db.select().from(applicationMilestones).where(eq(applicationMilestones.id, m.id));
    expect(kept.dueDate).toBe(newDue);
    expect(kept.isCustomDate).toBe(true);
    await P.generateSchedule(id, u.id, { resetCustom: true });
    const [reset] = await db.select().from(applicationMilestones).where(eq(applicationMilestones.id, m.id));
    expect(reset.isCustomDate).toBe(false);
  });
});
