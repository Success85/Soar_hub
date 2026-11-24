/**
 * Idempotent seed. Safe to run repeatedly.
 *
 *   npm run db:seed            → base data (roles/permissions, templates, rubric, milestone
 *                                templates, content categories). Always safe, including production.
 *   SEED_DEMO=true npm run db:seed → also creates DEMO users, scholarships, applications etc.
 *                                Refused when NODE_ENV=production unless ALLOW_DEMO_IN_PRODUCTION=true.
 *
 * Demo scholarships are flagged is_demo, named "[Demo] …", and use example.org sources.
 * They are NOT real opportunities and the UI labels them as demonstration records.
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
  scholarshipCriteria,
  scholarshipCriteriaGroups,
  scholarshipDocumentRequirements,
  scholarshipMilestoneTemplates,
  scholarships,
  scholarshipSources,
  userRoles,
  users,
  consents,
  answerBankEntries,
  educationalResources,
} from "@/lib/db/schema";
import { DEFAULT_ROLE_PERMISSIONS, type Role } from "@/lib/auth/permissions";
import { hashPassword } from "@/lib/auth/password";
import { DEFAULT_RUBRIC } from "@/lib/integrations/ai";
import { DEFAULT_TEMPLATES } from "@/lib/services/notification-templates";
import { DEFAULT_MILESTONES } from "@/lib/services/planner";

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
  return id;
}

interface DemoCriterion {
  name: string;
  description?: string;
  fieldKey: string;
  operator: (typeof scholarshipCriteria.$inferInsert)["operator"];
  requiredValue?: unknown;
  severity?: "absolute" | "important" | "advisory";
  isFixable?: boolean;
  isRequired?: boolean;
  group?: string;
  passExplanation?: string;
  recommendedAction?: string;
  questionText?: string;
  answerType?: string;
}

async function upsertScholarship(spec: {
  slug: string;
  name: string;
  university: string;
  country: string;
  city: string;
  daysToDeadline: number;
  programmes: string[];
  summary: string;
  criteria: DemoCriterion[];
  groups?: { key: string; name: string; logic: "and" | "or" }[];
  featured?: boolean;
  status?: "published" | "draft" | "pending_verification";
}, adminId: string) {
  const [existing] = await db.select().from(scholarships).where(eq(scholarships.slug, spec.slug)).limit(1);
  if (existing) return existing;
  const deadline = new Date(Date.now() + spec.daysToDeadline * 86_400_000);
  deadline.setUTCHours(22, 59, 0, 0); // 23:59 Lagos time
  const status = spec.status ?? "published";
  const [s] = await db
    .insert(scholarships)
    .values({
      slug: spec.slug,
      name: spec.name,
      partnerUniversity: spec.university,
      country: spec.country,
      city: spec.city,
      programmeLevel: "undergraduate",
      scholarshipType: "Fully funded",
      programmes: spec.programmes,
      summary: spec.summary,
      description:
        "**This is a demonstration record created by the SOAR Hub seed script.** It shows how a verified, published partner-university opportunity appears on the platform. It is not a real scholarship and must not be used to apply.\n\nThe programme supports academically talented young people who face financial barriers, with a focus on leadership potential and a commitment to giving back to their communities.",
      tuitionCoverage: "Full tuition and fees",
      livingAllowance: "Monthly stipend for living costs",
      accommodationBenefits: "On-campus accommodation",
      travelBenefits: "Return economy flights and visa costs",
      otherBenefits: "Laptop, mentorship, leadership development and transition support",
      openingDate: new Date(Date.now() - 30 * 86_400_000),
      deadline,
      timezone: "Africa/Lagos",
      applicationUrl: "https://example.org/apply",
      status,
      isActive: true,
      isFeatured: !!spec.featured,
      isDemo: true,
      lastVerifiedAt: status === "published" ? new Date() : null,
      verifiedBy: status === "published" ? adminId : null,
      publishedAt: status === "published" ? new Date() : null,
      createdBy: adminId,
      updatedBy: adminId,
    })
    .returning();
  await db.insert(scholarshipSources).values({ scholarshipId: s.id, sourceName: `${spec.university} — official scholarship page (demo)`, url: `https://example.org/${spec.slug}`, isPrimary: true, verificationStatus: status === "published" ? "verified" : "unverified", verifiedBy: status === "published" ? adminId : null, verifiedAt: status === "published" ? new Date() : null });
  const gmap = new Map<string, string>();
  for (const [i, g] of (spec.groups ?? []).entries()) {
    const [row] = await db.insert(scholarshipCriteriaGroups).values({ scholarshipId: s.id, name: g.name, logic: g.logic, sortOrder: i }).returning();
    gmap.set(g.key, row.id);
  }
  for (const [i, c] of spec.criteria.entries()) {
    await db.insert(scholarshipCriteria).values({
      scholarshipId: s.id,
      groupId: c.group ? gmap.get(c.group) ?? null : null,
      name: c.name,
      description: c.description ?? null,
      fieldKey: c.fieldKey,
      operator: c.operator,
      requiredValue: (c.requiredValue ?? null) as object,
      severity: c.severity ?? "important",
      isFixable: c.isFixable ?? true,
      isRequired: c.isRequired ?? true,
      passExplanation: c.passExplanation ?? null,
      recommendedAction: c.recommendedAction ?? null,
      sourceReference: `${spec.university} eligibility page (demo)`,
      questionText: c.questionText ?? null,
      answerType: c.answerType ?? null,
      sortOrder: i,
    });
  }
  const reqs: [typeof scholarshipDocumentRequirements.$inferInsert.category, string, boolean][] = [
    ["academic_transcript", "Secondary school transcript / WAEC result", true],
    ["cv", "CV", true],
    ["passport", "International passport (data page)", true],
    ["recommendation_letter", "Reference letter from a teacher or mentor", true],
    ["financial_documentation", "Evidence of financial need", false],
  ];
  for (const [i, [category, name, isRequired]] of reqs.entries()) await db.insert(scholarshipDocumentRequirements).values({ scholarshipId: s.id, category, name, isRequired, sortOrder: i });
  log(`demo scholarship: ${s.name}`);
  return s;
}

const BASE_CRITERIA: DemoCriterion[] = [
  { name: "Age limit", description: "Applicants must be 29 or younger.", fieldKey: "age", operator: "lte", requiredValue: 29, severity: "absolute", isFixable: false, passExplanation: "Your age meets this scholarship's requirements." },
  { name: "Nigerian citizenship", fieldKey: "country_of_citizenship", operator: "in", requiredValue: ["Nigeria", "Nigerian"], severity: "absolute", isFixable: false },
  { name: "Completed or completing secondary school", fieldKey: "education_level", operator: "in", requiredValue: ["secondary_in_progress", "secondary_completed"], severity: "important" },
  { name: "WASSCE, NECO or GCE", fieldKey: "qualifications", operator: "in", requiredValue: ["WASSCE", "NECO", "GCE"], severity: "important", recommendedAction: "Add the secondary qualification you have taken or will take." },
  { name: "At least five credit passes", fieldKey: "credit_passes", operator: "gte", requiredValue: 5, severity: "important", recommendedAction: "If you're re-sitting exams, update your credit passes when results are out." },
  { name: "Demonstrated financial need", fieldKey: "demonstrates_financial_need", operator: "is_true", severity: "important" },
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
    .set({ dateOfBirth: "2007-04-12", gender: "female", stateOfOrigin: "Enugu", countryOfCitizenship: "Nigeria", countryOfResidence: "Nigeria", phone: "08031234567", educationLevel: "secondary_completed", currentSchool: "Federal Government Girls' College, Enugu (demo)", graduationYear: 2025, qualifications: ["WASSCE", "UTME"], creditPasses: 7, gradeAverage: "78.50", firstGeneration: true, householdIncomeBand: "low", demonstratesFinancialNeed: true, employmentStatus: "student", preferredProgramme: "Computer Science", careerInterests: "Building technology that helps rural health clinics.", personalBackground: "I grew up in Nsukka helping my mother run a small provisions shop while studying.", onboardingCompletedAt: new Date(), welcomeSeenAt: new Date() })
    .where(eq(profiles.userId, applicant));
  await db.insert(consents).values({ userId: applicant, type: "data_processing", version: "2026-11" }).onConflictDoNothing();
  await db.update(profiles).set({ dateOfBirth: "2006-09-30", countryOfCitizenship: "Nigeria", countryOfResidence: "Nigeria", stateOfOrigin: "Kano", educationLevel: "secondary_completed", welcomeSeenAt: new Date() }).where(eq(profiles.userId, applicant2));

  const s1 = await upsertScholarship(
    { slug: "demo-mcf-scholars-partner-university-a", name: "[Demo] Mastercard Foundation Scholars Program — Partner University A", university: "Demo Partner University A", country: "Ghana", city: "Accra", daysToDeadline: 75, programmes: ["Computer Science", "Engineering", "Business Administration", "Public Health"], summary: "Fully funded undergraduate study for young Africans with financial need and leadership potential. (Demonstration record.)", criteria: BASE_CRITERIA, featured: true },
    admin,
  );
  await upsertScholarship(
    {
      slug: "demo-mcf-scholars-partner-university-b",
      name: "[Demo] Mastercard Foundation Scholars Program — Partner University B",
      university: "Demo Partner University B",
      country: "Rwanda",
      city: "Kigali",
      daysToDeadline: 21,
      programmes: ["Agriculture", "Economics", "Software Engineering"],
      summary: "Undergraduate scholarship emphasising community leadership. (Demonstration record.)",
      groups: [{ key: "priority", name: "Priority background (any one)", logic: "or" }],
      criteria: [
        ...BASE_CRITERIA.slice(0, 5),
        { name: "First-generation university student", fieldKey: "first_generation", operator: "is_true", group: "priority" },
        { name: "Refugee or displaced background", fieldKey: "is_refugee_or_displaced", operator: "is_true", group: "priority" },
        { name: "Household income level", fieldKey: "household_income_band", operator: "in", requiredValue: ["very_low", "low"], group: "priority" },
        { name: "Community service experience", fieldKey: "custom.community_service", operator: "is_true", questionText: "Have you volunteered or led a community project in the last two years?", answerType: "boolean" },
      ],
    },
    admin,
  );
  await upsertScholarship({ slug: "demo-partner-university-c-draft", name: "[Demo] Partner University C Undergraduate Scholarship (draft)", university: "Demo Partner University C", country: "Kenya", city: "Nairobi", daysToDeadline: 120, programmes: ["Medicine"], summary: "Draft record awaiting verification. (Demonstration record.)", criteria: BASE_CRITERIA.slice(0, 2), status: "pending_verification" }, admin);

  // demo application for the main applicant, built with the real services
  const existingApp = await db.select().from(applications).where(and(eq(applications.userId, applicant), eq(applications.scholarshipId, s1.id))).limit(1);
  if (!existingApp[0]) {
    const { runAssessment } = await import("@/lib/services/eligibility");
    const { createApplication, transitionApplication } = await import("@/lib/services/applications");
    const { assignReviewer } = await import("@/lib/services/admin");
    const { loadAccess } = await import("@/lib/auth/session");
    await runAssessment(applicant, s1.id, { trigger: "manual" });
    const { id } = await createApplication(applicant, s1.id);
    await transitionApplication(id, "in_progress", { id: applicant, type: "applicant" }, { reason: "Started working on application" });
    const ms = await db.select().from(applicationMilestones).where(eq(applicationMilestones.applicationId, id));
    for (const m of ms.filter((x) => ["research", "eligibility"].includes(x.templateKey))) {
      await db.update(applicationMilestones).set({ status: "completed", completedAt: new Date() }).where(eq(applicationMilestones.id, m.id));
    }
    const { recomputeProgress } = await import("@/lib/services/planner");
    await recomputeProgress(id);
    const access = await loadAccess(admin);
    await assignReviewer({ id: admin, email: "", firstName: "Tunde", lastName: "Bakare", emailVerified: true, status: "active", roles: access.roles, permissions: access.permissions, sessionId: "seed" }, id, reviewer);
    log("demo application created and reviewer assigned");
  }

  const bankCount = await db.select({ c: sql<number>`count(*)::int` }).from(answerBankEntries).where(eq(answerBankEntries.userId, applicant));
  if (!bankCount[0].c) {
    await db.insert(answerBankEntries).values([
      { userId: applicant, category: "leadership", title: "Starting the school coding club", body: "In SS2 I convinced our principal to let me start a coding club using two donated laptops. We grew from 4 to 31 members and built a simple attendance app for our teachers.", tags: ["leadership", "technology", "school"] },
      { userId: applicant, category: "challenge_overcome", title: "Studying while running the family shop", body: "When my father fell ill I managed my mother's provisions shop every afternoon. I learned to study in short focused blocks and still finished WASSCE with seven credits.", tags: ["resilience", "family", "time management"] },
      { userId: applicant, category: "career_goals", title: "Technology for rural clinics", body: "I want to build low-cost software that helps rural health clinics track medicine stock so that no mother is turned away because a drug ran out.", tags: ["health", "technology", "community"] },
    ]);
  }

  const res = await db.select({ id: educationalResources.id }).from(educationalResources).where(eq(educationalResources.isDemo, true)).limit(1);
  if (!res[0]) {
    const [cat] = await db.select().from(contentCategories).where(eq(contentCategories.slug, "essay-writing")).limit(1);
    const [cat2] = await db.select().from(contentCategories).where(eq(contentCategories.slug, "application-guides")).limit(1);
    await db.insert(educationalResources).values([
      { title: "How to write a personal statement that sounds like you", slug: "personal-statement-that-sounds-like-you", categoryId: cat?.id, type: "essay_guide", description: "A practical, step-by-step approach to telling your own story with evidence and reflection.", body: "## Start with a moment, not a summary\n\nStrong essays open with a specific moment. Instead of “I am passionate about technology”, describe the afternoon you fixed your school's printer.\n\n## Show evidence\n\nFor every claim, ask: *how would a stranger know this is true?* Add a number, a result, or a short example.\n\n## Reflect\n\nAdmissions readers want to know what you learned and how you changed. End paragraphs with what the experience taught you.\n\n## Keep your voice\n\nRead your essay aloud. If a sentence doesn't sound like you, rewrite it in your own words.", authorName: "SOAR Hub team", status: "published", visibility: "public", publishedAt: new Date(), isDemo: true },
      { title: "Your scholarship application checklist", slug: "scholarship-application-checklist", categoryId: cat2?.id, type: "guide", description: "Everything to gather before you submit — and how early to start.", body: "## Three months before\n\n- Read the official scholarship page carefully\n- Check eligibility on SOAR Hub\n- Ask two referees\n\n## Six weeks before\n\n- Finalise your CV\n- Draft and revise your essay\n- Request your transcript\n\n## Final week\n\n- Proofread everything\n- Submit on the official portal — never through a third party\n- Save your confirmation", authorName: "SOAR Hub team", status: "published", visibility: "public", publishedAt: new Date(), isDemo: true },
      { title: "Choosing the right referee", slug: "choosing-the-right-referee", categoryId: (await db.select().from(contentCategories).where(eq(contentCategories.slug, "reference-letters")).limit(1))[0]?.id, type: "guide", description: "Who to ask, when to ask, and how to make it easy for them.", body: "Pick someone who knows your work well — a teacher, mentor or supervisor. Ask at least four weeks before the deadline, share your CV and the scholarship's values, and send a polite reminder a week before.", authorName: "SOAR Hub team", status: "published", visibility: "applicants", publishedAt: new Date(), isDemo: true },
    ]);
  }
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
