/**
 * Idempotent seed. Safe to run repeatedly.
 *
 *   npm run db:seed            → base data (roles/permissions, templates, rubric, milestone
 *                                templates, content categories). Always safe, including production.
 *   SEED_DEMO=true npm run db:seed → also creates demo ACCOUNTS (admin, reviewer, two applicants) and gives the
 *                                main applicant a real in-progress application on an open partner listing.
 *                                Run "npm run db:import-scholarships" first. Refused when NODE_ENV=production
 *                                unless ALLOW_DEMO_IN_PRODUCTION=true.
 *
 * No placeholder scholarships are created any more; old "[Demo] Partner University …" records from earlier
 * versions are removed (see scripts/demo-cleanup.ts).
 */
import "dotenv/config";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, sqlClient } from "@/lib/db";
import {
  applicationMilestones,
  applications,
  contentCategories,
  essayRubrics,
  notificationPreferences,
  notificationTemplates,
  profiles,
  rolePermissions,
  scholarshipMilestoneTemplates,
  scholarships,
  userRoles,
  users,
  consents,
  answerBankEntries,
  educationalResources,
  memberships,
} from "@/lib/db/schema";
import { DEFAULT_ROLE_PERMISSIONS, type Role } from "@/lib/auth/permissions";
import { hashPassword } from "@/lib/auth/password";
import { DEFAULT_RUBRIC } from "@/lib/integrations/ai";
import { DEFAULT_TEMPLATES } from "@/lib/services/notification-templates";
import { DEFAULT_MILESTONES } from "@/lib/services/planner";
import { removeDemoScholarships } from "./demo-cleanup";
import { assignMemberCode } from "@/lib/services/member-code";

const log = (...a: unknown[]) => console.log("[seed]", ...a);

async function seedBase() {
  for (const [role, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    for (const permission of perms) await db.insert(rolePermissions).values({ role: role as Role, permission }).onConflictDoNothing();
  }
  log("role permissions ok");

  for (const t of DEFAULT_TEMPLATES) {
    await db.insert(notificationTemplates).values({ key: t.key, channel: t.channel, subject: t.subject ?? null, body: t.body, description: t.description }).onConflictDoNothing();
  }
  log("notification templates ok");

  const existingGlobal = await db.select({ id: scholarshipMilestoneTemplates.id }).from(scholarshipMilestoneTemplates).where(isNull(scholarshipMilestoneTemplates.scholarshipId)).limit(1);
  if (!existingGlobal[0]) {
    for (const m of DEFAULT_MILESTONES) {
      await db.insert(scholarshipMilestoneTemplates).values({ scholarshipId: null, key: m.key, name: m.name, description: m.description ?? null, durationDays: m.durationDays, dependsOn: m.dependsOn, priority: m.priority ?? "medium", isRequired: m.isRequired !== false, sortOrder: m.sortOrder ?? 0 });
    }
  }
  log("default milestone templates ok");

  const rubric = await db.select({ id: essayRubrics.id }).from(essayRubrics).where(isNull(essayRubrics.scholarshipId)).limit(1);
  if (!rubric[0]) {
    await db.insert(essayRubrics).values({ scholarshipId: null, version: 1, values: "Leadership, community impact, academic potential, resilience and a commitment to giving back.", dimensions: DEFAULT_RUBRIC });
  }
  log("default rubric ok");

  for (const c of [
    { name: "Scholarship application guides", slug: "application-guides", description: "Step-by-step guidance on applying." },
    { name: "Essay writing", slug: "essay-writing", description: "Write personal statements that sound like you." },
    { name: "CV & documents", slug: "cv-documents", description: "CVs, transcripts and supporting documents." },
    { name: "Interview preparation", slug: "interviews", description: "Prepare confidently for interviews." },
    { name: "Reference letters", slug: "reference-letters", description: "Choosing and supporting your referees." },
    { name: "Announcements", slug: "announcements", description: "News from SOAR Hub." },
  ]) {
    await db.insert(contentCategories).values(c).onConflictDoNothing();
  }
  log("content categories ok");
}

/* ------------------------------------------------------------------ */
/* Demo data                                                           */
/* ------------------------------------------------------------------ */

async function upsertUser(email: string, firstName: string, lastName: string, password: string, roles: Role[]) {
  const [existing] = await db.select().from(users).where(sql`lower(${users.email}) = ${email.toLowerCase()}`).limit(1);
  let id = existing?.id;
  if (!id) {
    const [u] = await db.insert(users).values({ email, firstName, lastName, passwordHash: await hashPassword(password), emailVerifiedAt: new Date(), isDemo: true }).returning();
    id = u.id;
    await db.insert(profiles).values({ userId: id }).onConflictDoNothing();
    await db.insert(notificationPreferences).values({ userId: id }).onConflictDoNothing();
    await db.insert(consents).values([
      { userId: id, type: "privacy", version: "2026-11" },
      { userId: id, type: "terms", version: "2026-11" },
    ]);
  }
  for (const role of roles) await db.insert(userRoles).values({ userId: id, role }).onConflictDoNothing();
  await assignMemberCode(id);
  return id;
}

/** Real partner listings to start the sample applicant's application on, in order of preference. */
const DEMO_APPLICATION_TARGETS: { slug: string; answers?: Record<string, unknown> }[] = [
  { slug: "mcf-earth-university-costa-rica", answers: { "custom.english_requirement": true } }, // open until 31 Jan 2027
  { slug: "mcf-alu-rwanda" }, // open until 30 Nov 2026
];

async function seedDemo() {
  const PASSWORD = process.env.DEMO_PASSWORD ?? "Soar-demo-2026!";
  const superAdmin = await upsertUser("superadmin@demo.soarhub.ng", "Ngozi", "Adeyemi", PASSWORD, ["super_admin", "admin", "reviewer"]);
  const admin = await upsertUser("admin@demo.soarhub.ng", "Tunde", "Bakare", PASSWORD, ["admin", "reviewer"]);
  const reviewer = await upsertUser("reviewer@demo.soarhub.ng", "Halima", "Musa", PASSWORD, ["reviewer"]);
  const applicant = await upsertUser("applicant@demo.soarhub.ng", "Chiamaka", "Okafor", PASSWORD, ["applicant"]);
  const applicant2 = await upsertUser("applicant2@demo.soarhub.ng", "Ibrahim", "Lawal", PASSWORD, ["applicant"]);
  void superAdmin;

  await db
    .update(profiles)
    .set({ dateOfBirth: "2007-04-12", gender: "female", stateOfOrigin: "Enugu", countryOfCitizenship: "Nigeria", countryOfResidence: "Nigeria", phone: "08031234567", educationLevel: "secondary_completed", currentSchool: "Federal Government Girls' College, Enugu", graduationYear: 2025, qualifications: ["WASSCE", "UTME"], creditPasses: 7, gradeAverage: "78.50", firstGeneration: true, householdIncomeBand: "low", demonstratesFinancialNeed: true, employmentStatus: "student", preferredProgramme: "Agricultural Sciences", careerInterests: "Climate-smart farming and simple technology that helps smallholder farmers sell their produce.", personalBackground: "I grew up in Nsukka helping my mother run a small provisions shop while studying.", onboardingCompletedAt: new Date(), welcomeSeenAt: new Date() })
    .where(eq(profiles.userId, applicant));
  await db.insert(consents).values({ userId: applicant, type: "data_processing", version: "2026-11" }).onConflictDoNothing();
  await db.update(profiles).set({ dateOfBirth: "2006-09-30", countryOfCitizenship: "Nigeria", countryOfResidence: "Nigeria", stateOfOrigin: "Kano", educationLevel: "secondary_completed", welcomeSeenAt: new Date() }).where(eq(profiles.userId, applicant2));

  // Demo applicants are members (lifetime, source "demo") so the full platform can be shown without paying.
  for (const uid of [applicant, applicant2]) {
    const has = await db.select({ id: memberships.id }).from(memberships).where(and(eq(memberships.userId, uid), isNull(memberships.revokedAt))).limit(1);
    if (!has[0]) await db.insert(memberships).values({ userId: uid, startsAt: new Date(), expiresAt: null, source: "demo", note: "Demo account" });
  }

  // Remove the old "[Demo] Partner University" placeholders (and their applications) if an earlier seed created them.
  const removed = await removeDemoScholarships();
  if (removed) log(`removed ${removed} placeholder scholarship(s) and their applications`);

  // A real in-progress application for the main applicant, on the first open partner listing she qualifies for.
  const { runAssessment } = await import("@/lib/services/eligibility");
  const { createApplication, transitionApplication } = await import("@/lib/services/applications");
  const hasApp = await db.select({ id: applications.id }).from(applications).where(eq(applications.userId, applicant)).limit(1);
  let created: string | null = null;
  for (const c of hasApp[0] ? [] : DEMO_APPLICATION_TARGETS) {
    const [target] = await db.select().from(scholarships).where(and(eq(scholarships.slug, c.slug), eq(scholarships.isActive, true))).limit(1);
    if (!target || (target.deadline && target.deadline < new Date())) continue;
    const outcome = await runAssessment(applicant, target.id, { trigger: "manual", answers: c.answers });
    if (outcome.evaluation.overall !== "likely_eligible") continue;
    const { id } = await createApplication(applicant, target.id);
    const [app] = await db.select({ status: applications.status }).from(applications).where(eq(applications.id, id)).limit(1);
    if (app.status === "eligible") await transitionApplication(id, "in_progress", { id: applicant, type: "applicant" }, { reason: "Started working on application" });
    const ms = await db.select().from(applicationMilestones).where(eq(applicationMilestones.applicationId, id));
    for (const m of ms.filter((x) => ["research", "eligibility"].includes(x.templateKey))) {
      await db.update(applicationMilestones).set({ status: "completed", completedAt: new Date() }).where(eq(applicationMilestones.id, m.id));
    }
    const { recomputeProgress } = await import("@/lib/services/planner");
    await recomputeProgress(id);
    const { assignReviewer } = await import("@/lib/services/admin");
    const { loadAccess } = await import("@/lib/auth/session");
    const access = await loadAccess(admin);
    await assignReviewer({ id: admin, email: "", firstName: "Tunde", lastName: "Bakare", emailVerified: true, status: "active", roles: access.roles, permissions: access.permissions, sessionId: "seed" }, id, reviewer);
    created = target.partnerUniversity;
    break;
  }
  if (created) log(`sample application created: ${created} (reviewer assigned)`);
  else if (!hasApp[0]) log('no sample application: run "npm run db:import-scholarships" first, then this seed again');

  const bankCount = await db.select({ c: sql<number>`count(*)::int` }).from(answerBankEntries).where(eq(answerBankEntries.userId, applicant));
  if (!bankCount[0].c) {
    await db.insert(answerBankEntries).values([
      { userId: applicant, category: "leadership", title: "Starting the school coding club", body: "In SS2 I convinced our principal to let me start a coding club using two donated laptops. We grew from 4 to 31 members and built a simple attendance app for our teachers.", tags: ["leadership", "technology", "school"] },
      { userId: applicant, category: "challenge_overcome", title: "Studying while running the family shop", body: "When my father fell ill I managed my mother's provisions shop every afternoon. I learned to study in short focused blocks and still finished WASSCE with seven credits.", tags: ["resilience", "family", "time management"] },
      { userId: applicant, category: "career_goals", title: "Technology for rural clinics", body: "I want to build low-cost software that helps rural health clinics track medicine stock so that no mother is turned away because a drug ran out.", tags: ["health", "technology", "community"] },
    ]);
  }

  // Retire the old placeholder articles; the real library comes from "npm run db:import-resources".
  await db.update(educationalResources).set({ status: "archived", updatedAt: new Date() }).where(eq(educationalResources.isDemo, true));
  log(`demo users ready (password from DEMO_PASSWORD or default): superadmin@, admin@, reviewer@, applicant@, applicant2@demo.soarhub.ng`);
}

async function main() {
  await seedBase();
  const wantDemo = process.env.SEED_DEMO === "true";
  if (wantDemo) {
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_IN_PRODUCTION !== "true") {
      throw new Error("Refusing to seed demo data in production. Demo scholarships are not real opportunities.");
    }
    await seedDemo();
  }
  log("done");
  await sqlClient.end();
}

main().catch(async (e) => {
  console.error(e);
  await sqlClient.end();
  process.exit(1);
});
