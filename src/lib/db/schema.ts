/**
 * SOAR Hub — PostgreSQL schema (Drizzle ORM).
 *
 * Conventions
 * - UUID primary keys (gen_random_uuid()) except append-only/high-volume logs (bigserial).
 * - created_at / updated_at on every mutable table.
 * - Soft deletion (deleted_at) on applicant-owned records so audit/legal retention survives.
 * - Foreign keys use RESTRICT for history-bearing parents (scholarships, applications) and
 *   CASCADE only for pure child rows that are meaningless without their parent.
 * - JSONB only for genuinely schemaless payloads (rule values, structured AI output,
 *   notification data, audit snapshots, settings values).
 */
import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Custom types                                                        */
/* ------------------------------------------------------------------ */

/** pgvector column without fixed dimension (per-user corpora are small; exact search). */
export const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector";
  },
  toDriver(value: number[]) {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string) {
    return value.slice(1, -1).split(",").map(Number);
  },
});

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () => ts("updated_at").notNull().defaultNow();

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const roleEnum = pgEnum("role", ["applicant", "reviewer", "admin", "super_admin"]);
export const userStatusEnum = pgEnum("user_status", ["active", "suspended", "deletion_requested", "deleted"]);
export const authTokenTypeEnum = pgEnum("auth_token_type", ["email_verification", "password_reset"]);
export const consentTypeEnum = pgEnum("consent_type", ["privacy", "terms", "data_processing", "sms"]);

export const educationLevelEnum = pgEnum("education_level", [
  "secondary_in_progress",
  "secondary_completed",
  "undergraduate_in_progress",
  "undergraduate_completed",
  "postgraduate",
  "other",
]);
export const incomeBandEnum = pgEnum("income_band", ["very_low", "low", "lower_middle", "middle", "upper", "prefer_not_to_say"]);
export const employmentStatusEnum = pgEnum("employment_status", ["student", "unemployed", "employed_part_time", "employed_full_time", "self_employed", "other"]);

export const scholarshipStatusEnum = pgEnum("scholarship_status", [
  "draft",
  "pending_verification",
  "verified",
  "published",
  "expired",
  "archived",
  "deactivated",
]);
export const windowStatusEnum = pgEnum("window_status", ["open", "opens_soon", "closed", "not_announced", "paused"]);
export const scholarshipCategoryEnum = pgEnum("scholarship_category", ["ug_africa", "ug_outside_africa", "ug_extra_africa", "pg_africa", "pg_outside_africa"]);
export const programmeLevelEnum = pgEnum("programme_level", ["undergraduate", "masters", "doctoral", "other"]);
export const sourceVerificationEnum = pgEnum("source_verification", ["unverified", "verified", "outdated"]);

export const criterionOperatorEnum = pgEnum("criterion_operator", [
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "not_in",
  "contains",
  "exists",
  "not_exists",
  "is_true",
  "is_false",
  "between",
  "age_between",
  "matches",
]);
export const criterionSeverityEnum = pgEnum("criterion_severity", ["absolute", "important", "advisory"]);
export const groupLogicEnum = pgEnum("group_logic", ["and", "or"]);

export const documentCategoryEnum = pgEnum("document_category", [
  "academic_transcript",
  "certificate",
  "cv",
  "passport",
  "identification",
  "essay",
  "recommendation_letter",
  "financial_documentation",
  "other",
]);

export const verdictEnum = pgEnum("verdict", ["eligible", "ineligible", "undetermined"]);
export const overallVerdictEnum = pgEnum("overall_verdict", ["likely_eligible", "more_info_needed", "not_eligible"]);
export const assessmentStatusEnum = pgEnum("assessment_status", ["in_progress", "completed"]);
export const assessmentTriggerEnum = pgEnum("assessment_trigger", ["manual", "profile_change", "criteria_change"]);

export const applicationStatusEnum = pgEnum("application_status", [
  "draft",
  "screening",
  "eligible",
  "ineligible",
  "in_progress",
  "submitted",
  "shortlisted",
  "outcome",
]);
export const outcomeEnum = pgEnum("application_outcome", ["awarded", "declined", "waitlisted", "not_selected", "pending", "unknown"]);

export const milestoneStatusEnum = pgEnum("milestone_status", ["upcoming", "in_progress", "completed", "blocked"]);
export const priorityEnum = pgEnum("priority", ["low", "medium", "high", "critical"]);

export const reviewStatusEnum = pgEnum("review_status", ["uploaded", "pending_review", "under_review", "approved", "needs_revision", "rejected"]);
export const scanStatusEnum = pgEnum("scan_status", ["not_scanned", "pending", "clean", "infected", "error"]);
export const uploadedViaEnum = pgEnum("uploaded_via", ["applicant", "referee", "admin", "reviewer"]);
export const commentStatusEnum = pgEnum("comment_status", ["outstanding", "resolved"]);

export const essayStatusEnum = pgEnum("essay_status", [
  "draft",
  "submitted_for_review",
  "ai_review_pending",
  "human_review_pending",
  "feedback_approved",
  "revision_requested",
  "finalized",
]);
export const feedbackSourceEnum = pgEnum("feedback_source", ["human", "ai_approved"]);
export const aiRequestStatusEnum = pgEnum("ai_request_status", ["queued", "generating", "completed", "failed"]);
export const aiDecisionEnum = pgEnum("ai_decision", ["pending", "approved", "rejected", "needs_more_review"]);

export const answerCategoryEnum = pgEnum("answer_category", [
  "personal_experience",
  "achievement",
  "leadership",
  "community_impact",
  "challenge_overcome",
  "career_goals",
  "motivation",
  "personal_statement",
  "previous_essay",
  "other",
]);

export const refereeStatusEnum = pgEnum("referee_status", ["sent", "opened", "submitted", "expired", "cancelled"]);

export const notificationChannelEnum = pgEnum("notification_channel", ["email", "sms", "in_app"]);
export const notificationStatusEnum = pgEnum("notification_status", ["pending", "queued", "sending", "sent", "delivered", "failed", "cancelled"]);

export const contentStatusEnum = pgEnum("content_status", ["draft", "published", "archived"]);
export const contentTypeEnum = pgEnum("content_type", ["article", "guide", "essay_guide", "cv_guide", "interview_guide", "faq", "video", "download", "webinar", "announcement"]);
export const contentVisibilityEnum = pgEnum("content_visibility", ["public", "applicants"]);

export const dataRequestTypeEnum = pgEnum("data_request_type", ["export", "deletion"]);
export const dataRequestStatusEnum = pgEnum("data_request_status", ["pending", "processing", "completed", "rejected"]);

/* ------------------------------------------------------------------ */
/* Identity & access                                                   */
/* ------------------------------------------------------------------ */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 320 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    emailVerifiedAt: ts("email_verified_at"),
    status: userStatusEnum("status").notNull().default("active"),
    lastLoginAt: ts("last_login_at"),
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lockedUntil: ts("locked_until"),
    isDemo: boolean("is_demo").notNull().default(false),
    /** Permanent member ID (e.g. SOAR-26-7K4QXM), assigned when the email is verified. */
    memberCode: varchar("member_code", { length: 20 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [uniqueIndex("users_email_lower_uq").on(sql`lower(${t.email})`), uniqueIndex("users_member_code_uq").on(t.memberCode), index("users_created_idx").on(t.createdAt)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    createdAt: createdAt(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
    expiresAt: ts("expires_at").notNull(),
    revokedAt: ts("revoked_at"),
    ip: varchar("ip", { length: 64 }),
    userAgent: text("user_agent"),
  },
  (t) => [uniqueIndex("sessions_token_uq").on(t.tokenHash), index("sessions_user_idx").on(t.userId)],
);

export const authTokens = pgTable(
  "auth_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: authTokenTypeEnum("type").notNull(),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    expiresAt: ts("expires_at").notNull(),
    usedAt: ts("used_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("auth_tokens_hash_uq").on(t.tokenHash), index("auth_tokens_user_idx").on(t.userId, t.type)],
);

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull(),
    grantedBy: uuid("granted_by").references(() => users.id, { onDelete: "set null" }),
    grantedAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.role] })],
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    role: roleEnum("role").notNull(),
    permission: varchar("permission", { length: 100 }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.role, t.permission] })],
);

export const consents = pgTable(
  "consents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: consentTypeEnum("type").notNull(),
    version: varchar("version", { length: 20 }).notNull(),
    grantedAt: ts("granted_at").notNull().defaultNow(),
    revokedAt: ts("revoked_at"),
    ip: varchar("ip", { length: 64 }),
  },
  (t) => [index("consents_user_idx").on(t.userId, t.type)],
);

export const profiles = pgTable("profiles", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  dateOfBirth: date("date_of_birth", { mode: "string" }),
  gender: varchar("gender", { length: 30 }),
  stateOfOrigin: varchar("state_of_origin", { length: 60 }),
  countryOfCitizenship: varchar("country_of_citizenship", { length: 60 }),
  countryOfResidence: varchar("country_of_residence", { length: 60 }),
  phone: varchar("phone", { length: 30 }),
  educationLevel: educationLevelEnum("education_level"),
  currentSchool: varchar("current_school", { length: 200 }),
  graduationYear: integer("graduation_year"),
  qualifications: text("qualifications").array(),
  creditPasses: integer("credit_passes"),
  gradeAverage: numeric("grade_average", { precision: 5, scale: 2 }),
  academicResultsSummary: text("academic_results_summary"),
  firstGeneration: boolean("first_generation"),
  householdIncomeBand: incomeBandEnum("household_income_band"),
  demonstratesFinancialNeed: boolean("demonstrates_financial_need"),
  hasDisability: boolean("has_disability"),
  isRefugeeOrDisplaced: boolean("is_refugee_or_displaced"),
  employmentStatus: employmentStatusEnum("employment_status"),
  preferredProgramme: varchar("preferred_programme", { length: 200 }),
  careerInterests: text("career_interests"),
  personalBackground: text("personal_background"),
  onboardingCompletedAt: ts("onboarding_completed_at"),
  welcomeSeenAt: ts("welcome_seen_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/* ------------------------------------------------------------------ */
/* Scholarships                                                        */
/* ------------------------------------------------------------------ */

export const scholarships = pgTable(
  "scholarships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 250 }).notNull(),
    slug: varchar("slug", { length: 250 }).notNull(),
    partnerUniversity: varchar("partner_university", { length: 250 }).notNull(),
    country: varchar("country", { length: 80 }).notNull(),
    city: varchar("city", { length: 120 }),
    programmeLevel: programmeLevelEnum("programme_level").notNull().default("undergraduate"),
    scholarshipType: varchar("scholarship_type", { length: 120 }).notNull().default("Fully funded"),
    programmes: text("programmes").array().notNull().default(sql`'{}'::text[]`),
    summary: varchar("summary", { length: 500 }),
    description: text("description").notNull().default(""),
    tuitionCoverage: text("tuition_coverage"),
    livingAllowance: text("living_allowance"),
    accommodationBenefits: text("accommodation_benefits"),
    travelBenefits: text("travel_benefits"),
    otherBenefits: text("other_benefits"),
    openingDate: ts("opening_date"),
    deadline: ts("deadline"),
    timezone: varchar("timezone", { length: 60 }).notNull().default("Africa/Lagos"),
    applicationUrl: text("application_url"),
    /** Application window, independent of publication: published records stay visible between rounds. */
    windowStatus: windowStatusEnum("window_status").notNull().default("open"),
    category: scholarshipCategoryEnum("category"),
    currentWindow: text("current_window"),
    nextWindow: text("next_window"),
    keyEligibility: text("key_eligibility"),
    logoUrl: text("logo_url"),
    howToApply: text("how_to_apply"),
    contactEmail: varchar("contact_email", { length: 320 }),
    researchSources: text("research_sources"),
    status: scholarshipStatusEnum("status").notNull().default("draft"),
    isActive: boolean("is_active").notNull().default(true),
    isFeatured: boolean("is_featured").notNull().default(false),
    isDemo: boolean("is_demo").notNull().default(false),
    lastVerifiedAt: ts("last_verified_at"),
    verifiedBy: uuid("verified_by").references(() => users.id, { onDelete: "set null" }),
    publishedAt: ts("published_at"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("scholarships_slug_uq").on(t.slug),
    index("scholarships_status_idx").on(t.status, t.isActive),
    index("scholarships_deadline_idx").on(t.deadline),
  ],
);

export const scholarshipRevisions = pgTable(
  "scholarship_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scholarshipId: uuid("scholarship_id").notNull().references(() => scholarships.id, { onDelete: "cascade" }),
    snapshot: jsonb("snapshot").notNull(),
    changedBy: uuid("changed_by").references(() => users.id, { onDelete: "set null" }),
    reason: varchar("reason", { length: 200 }),
    createdAt: createdAt(),
  },
  (t) => [index("scholarship_revisions_sch_idx").on(t.scholarshipId, t.createdAt)],
);

export const scholarshipSources = pgTable(
  "scholarship_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scholarshipId: uuid("scholarship_id").notNull().references(() => scholarships.id, { onDelete: "cascade" }),
    sourceName: varchar("source_name", { length: 250 }).notNull(),
    url: text("url").notNull(),
    isPrimary: boolean("is_primary").notNull().default(true),
    verificationStatus: sourceVerificationEnum("verification_status").notNull().default("unverified"),
    verifiedBy: uuid("verified_by").references(() => users.id, { onDelete: "set null" }),
    verifiedAt: ts("verified_at"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("scholarship_sources_sch_idx").on(t.scholarshipId)],
);

export const scholarshipCriteriaGroups = pgTable(
  "scholarship_criteria_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scholarshipId: uuid("scholarship_id").notNull().references(() => scholarships.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 150 }).notNull(),
    logic: groupLogicEnum("logic").notNull().default("and"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("criteria_groups_sch_idx").on(t.scholarshipId)],
);

export const scholarshipCriteria = pgTable(
  "scholarship_criteria",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scholarshipId: uuid("scholarship_id").notNull().references(() => scholarships.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").references(() => scholarshipCriteriaGroups.id, { onDelete: "set null" }),
    name: varchar("name", { length: 150 }).notNull(),
    description: text("description"),
    fieldKey: varchar("field_key", { length: 100 }).notNull(),
    operator: criterionOperatorEnum("operator").notNull(),
    requiredValue: jsonb("required_value"),
    severity: criterionSeverityEnum("severity").notNull().default("important"),
    isFixable: boolean("is_fixable").notNull().default(true),
    isRequired: boolean("is_required").notNull().default(true),
    passExplanation: text("pass_explanation"),
    failExplanation: text("fail_explanation"),
    recommendedAction: text("recommended_action"),
    sourceReference: text("source_reference"),
    /** For custom criteria (field_key = "custom.*"): the question shown to applicants. */
    questionText: text("question_text"),
    answerType: varchar("answer_type", { length: 20 }),
    answerOptions: jsonb("answer_options"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("criteria_sch_idx").on(t.scholarshipId, t.sortOrder)],
);

export const scholarshipDocumentRequirements = pgTable(
  "scholarship_document_requirements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scholarshipId: uuid("scholarship_id").notNull().references(() => scholarships.id, { onDelete: "cascade" }),
    category: documentCategoryEnum("category").notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    /** "admission" (university application) or "scholarship" (MCF scholarship application) */
    section: varchar("section", { length: 30 }).notNull().default("admission"),
    isRequired: boolean("is_required").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("doc_req_sch_idx").on(t.scholarshipId)],
);

/** scholarship_id NULL = platform default template set. */
export const scholarshipMilestoneTemplates = pgTable(
  "scholarship_milestone_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scholarshipId: uuid("scholarship_id").references(() => scholarships.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 80 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    durationDays: integer("duration_days").notNull(),
    dependsOn: text("depends_on").array().notNull().default(sql`'{}'::text[]`),
    priority: priorityEnum("priority").notNull().default("medium"),
    isRequired: boolean("is_required").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("milestone_tpl_key_uq").on(t.scholarshipId, t.key),
    uniqueIndex("milestone_tpl_global_key_uq").on(t.key).where(sql`scholarship_id IS NULL`),
  ],
);

export const scholarshipFiles = pgTable("scholarship_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  scholarshipId: uuid("scholarship_id").notNull().references(() => scholarships.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 250 }).notNull(),
  storageKey: text("storage_key").notNull(),
  mimeType: varchar("mime_type", { length: 120 }).notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

export const essayRubrics = pgTable("essay_rubrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  scholarshipId: uuid("scholarship_id").references(() => scholarships.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(1),
  values: text("values"),
  /** [{ key, label, guidance }] */
  dimensions: jsonb("dimensions").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

export const savedScholarships = pgTable(
  "saved_scholarships",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    scholarshipId: uuid("scholarship_id").notNull().references(() => scholarships.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.scholarshipId] })],
);

/* ------------------------------------------------------------------ */
/* Eligibility                                                         */
/* ------------------------------------------------------------------ */

export const eligibilityAssessments = pgTable(
  "eligibility_assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    scholarshipId: uuid("scholarship_id").notNull().references(() => scholarships.id, { onDelete: "restrict" }),
    status: assessmentStatusEnum("status").notNull().default("in_progress"),
    overallVerdict: overallVerdictEnum("overall_verdict"),
    trigger: assessmentTriggerEnum("trigger").notNull().default("manual"),
    isCurrent: boolean("is_current").notNull().default(true),
    profileSnapshot: jsonb("profile_snapshot"),
    eligibleCount: integer("eligible_count").notNull().default(0),
    ineligibleCount: integer("ineligible_count").notNull().default(0),
    undeterminedCount: integer("undetermined_count").notNull().default(0),
    createdAt: createdAt(),
    completedAt: ts("completed_at"),
  },
  (t) => [index("assessments_user_sch_idx").on(t.userId, t.scholarshipId, t.createdAt)],
);

export const eligibilityAssessmentAnswers = pgTable(
  "eligibility_assessment_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assessmentId: uuid("assessment_id").notNull().references(() => eligibilityAssessments.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    scholarshipId: uuid("scholarship_id").notNull().references(() => scholarships.id, { onDelete: "cascade" }),
    fieldKey: varchar("field_key", { length: 100 }).notNull(),
    value: jsonb("value"),
    answeredAt: createdAt(),
  },
  (t) => [index("assessment_answers_user_idx").on(t.userId, t.scholarshipId, t.fieldKey)],
);

export const eligibilityResults = pgTable(
  "eligibility_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assessmentId: uuid("assessment_id").notNull().references(() => eligibilityAssessments.id, { onDelete: "cascade" }),
    criterionId: uuid("criterion_id").references(() => scholarshipCriteria.id, { onDelete: "set null" }),
    criterionName: varchar("criterion_name", { length: 150 }).notNull(),
    criterionDescription: text("criterion_description"),
    fieldKey: varchar("field_key", { length: 100 }).notNull(),
    applicantValue: jsonb("applicant_value"),
    requiredValue: jsonb("required_value"),
    verdict: verdictEnum("verdict").notNull(),
    explanation: text("explanation").notNull(),
    isFixable: boolean("is_fixable").notNull(),
    isAbsolute: boolean("is_absolute").notNull(),
    isRequired: boolean("is_required").notNull().default(true),
    recommendedAction: text("recommended_action"),
    source: text("source"),
    evaluatedAt: createdAt(),
  },
  (t) => [index("eligibility_results_assessment_idx").on(t.assessmentId)],
);

/* ------------------------------------------------------------------ */
/* Applications                                                        */
/* ------------------------------------------------------------------ */

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    scholarshipId: uuid("scholarship_id").notNull().references(() => scholarships.id, { onDelete: "restrict" }),
    assessmentId: uuid("assessment_id").references(() => eligibilityAssessments.id, { onDelete: "set null" }),
    status: applicationStatusEnum("status").notNull().default("draft"),
    outcome: outcomeEnum("outcome"),
    outcomeAt: ts("outcome_at"),
    outcomeNotes: text("outcome_notes"),
    deadline: ts("deadline"),
    progress: integer("progress").notNull().default(0),
    scheduleCompressed: boolean("schedule_compressed").notNull().default(false),
    scheduleWarning: text("schedule_warning"),
    scheduleGeneratedAt: ts("schedule_generated_at"),
    submittedAt: ts("submitted_at"),
    submissionReference: varchar("submission_reference", { length: 200 }),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [
    uniqueIndex("applications_user_sch_uq").on(t.userId, t.scholarshipId).where(sql`deleted_at IS NULL`),
    index("applications_status_idx").on(t.status),
    index("applications_sch_idx").on(t.scholarshipId),
  ],
);

export const applicationStateTransitions = pgTable(
  "application_state_transitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
    fromStatus: applicationStatusEnum("from_status"),
    toStatus: applicationStatusEnum("to_status").notNull(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    reason: text("reason"),
    createdAt: createdAt(),
  },
  (t) => [index("app_transitions_app_idx").on(t.applicationId, t.createdAt)],
);

export const reviewerAssignments = pgTable(
  "reviewer_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
    reviewerId: uuid("reviewer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    assignedBy: uuid("assigned_by").references(() => users.id, { onDelete: "set null" }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    endedAt: ts("ended_at"),
  },
  (t) => [
    uniqueIndex("reviewer_assignment_active_uq").on(t.applicationId, t.reviewerId).where(sql`is_active`),
    index("reviewer_assignment_reviewer_idx").on(t.reviewerId, t.isActive),
  ],
);

export const applicationMilestones = pgTable(
  "application_milestones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
    templateKey: varchar("template_key", { length: 80 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    startDate: date("start_date", { mode: "string" }).notNull(),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    durationDays: integer("duration_days").notNull(),
    plannedDurationDays: integer("planned_duration_days").notNull(),
    status: milestoneStatusEnum("status").notNull().default("upcoming"),
    priority: priorityEnum("priority").notNull().default("medium"),
    isRequired: boolean("is_required").notNull().default(true),
    isCritical: boolean("is_critical").notNull().default(false),
    isCompressed: boolean("is_compressed").notNull().default(false),
    isCustomDate: boolean("is_custom_date").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    completedAt: ts("completed_at"),
    completionNotes: text("completion_notes"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("milestones_app_key_uq").on(t.applicationId, t.templateKey),
    index("milestones_due_idx").on(t.dueDate, t.status),
  ],
);

export const milestoneDependencies = pgTable(
  "milestone_dependencies",
  {
    milestoneId: uuid("milestone_id").notNull().references(() => applicationMilestones.id, { onDelete: "cascade" }),
    dependsOnId: uuid("depends_on_id").notNull().references(() => applicationMilestones.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.milestoneId, t.dependsOnId] })],
);

/* ------------------------------------------------------------------ */
/* Documents                                                           */
/* ------------------------------------------------------------------ */

export const documents = pgTable(
  "application_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    applicationId: uuid("application_id").references(() => applications.id, { onDelete: "set null" }),
    requirementId: uuid("requirement_id").references(() => scholarshipDocumentRequirements.id, { onDelete: "set null" }),
    category: documentCategoryEnum("category").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    currentVersion: integer("current_version").notNull().default(0),
    reviewStatus: reviewStatusEnum("review_status").notNull().default("uploaded"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [index("documents_user_idx").on(t.userId), index("documents_app_idx").on(t.applicationId), index("documents_review_idx").on(t.reviewStatus)],
);

export const documentVersions = pgTable(
  "document_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "restrict" }),
    versionNumber: integer("version_number").notNull(),
    storageKey: text("storage_key").notNull(),
    originalFilename: varchar("original_filename", { length: 255 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    mimeType: varchar("mime_type", { length: 120 }).notNull(),
    sha256: varchar("sha256", { length: 64 }).notNull(),
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    uploadedVia: uploadedViaEnum("uploaded_via").notNull().default("applicant"),
    scanStatus: scanStatusEnum("scan_status").notNull().default("not_scanned"),
    reviewStatus: reviewStatusEnum("review_status").notNull().default("uploaded"),
    extractedText: text("extracted_text"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("doc_versions_num_uq").on(t.documentId, t.versionNumber)],
);

export const documentReviews = pgTable(
  "document_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentVersionId: uuid("document_version_id").notNull().references(() => documentVersions.id, { onDelete: "cascade" }),
    reviewerId: uuid("reviewer_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    decision: reviewStatusEnum("decision").notNull(),
    summary: text("summary"),
    createdAt: createdAt(),
  },
  (t) => [index("doc_reviews_version_idx").on(t.documentVersionId)],
);

export const documentComments = pgTable(
  "document_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentVersionId: uuid("document_version_id").notNull().references(() => documentVersions.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    body: text("body").notNull(),
    status: commentStatusEnum("status").notNull().default("outstanding"),
    assignedTo: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),
    resolvedBy: uuid("resolved_by").references(() => users.id, { onDelete: "set null" }),
    resolvedAt: ts("resolved_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("doc_comments_version_idx").on(t.documentVersionId)],
);

export const documentCommentAnchors = pgTable("document_comment_anchors", {
  commentId: uuid("comment_id").primaryKey().references(() => documentComments.id, { onDelete: "cascade" }),
  documentVersionId: uuid("document_version_id").notNull().references(() => documentVersions.id, { onDelete: "cascade" }),
  selectedText: text("selected_text").notNull(),
  startOffset: integer("start_offset"),
  endOffset: integer("end_offset"),
  contextBefore: text("context_before"),
  contextAfter: text("context_after"),
});

/* ------------------------------------------------------------------ */
/* Essays & AI critique                                                */
/* ------------------------------------------------------------------ */

export const essays = pgTable(
  "essays",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    applicationId: uuid("application_id").references(() => applications.id, { onDelete: "set null" }),
    scholarshipId: uuid("scholarship_id").references(() => scholarships.id, { onDelete: "set null" }),
    title: varchar("title", { length: 250 }).notNull(),
    prompt: text("prompt").notNull().default(""),
    body: text("body").notNull().default(""),
    wordCount: integer("word_count").notNull().default(0),
    wordLimit: integer("word_limit"),
    currentVersion: integer("current_version").notNull().default(0),
    status: essayStatusEnum("status").notNull().default("draft"),
    submittedAt: ts("submitted_at"),
    finalizedAt: ts("finalized_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [index("essays_user_idx").on(t.userId), index("essays_status_idx").on(t.status)],
);

export const essayVersions = pgTable(
  "essay_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    essayId: uuid("essay_id").notNull().references(() => essays.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    title: varchar("title", { length: 250 }).notNull(),
    prompt: text("prompt").notNull(),
    body: text("body").notNull(),
    wordCount: integer("word_count").notNull(),
    note: varchar("note", { length: 250 }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("essay_versions_num_uq").on(t.essayId, t.versionNumber)],
);

export const essayReviews = pgTable(
  "essay_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    essayId: uuid("essay_id").notNull().references(() => essays.id, { onDelete: "cascade" }),
    essayVersionId: uuid("essay_version_id").notNull().references(() => essayVersions.id, { onDelete: "cascade" }),
    reviewerId: uuid("reviewer_id").references(() => users.id, { onDelete: "set null" }),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    decision: varchar("decision", { length: 30 }),
    summary: text("summary"),
    requestedAt: createdAt(),
    completedAt: ts("completed_at"),
  },
  (t) => [index("essay_reviews_essay_idx").on(t.essayId), index("essay_reviews_status_idx").on(t.status)],
);

export const essayFeedback = pgTable(
  "essay_feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    essayId: uuid("essay_id").notNull().references(() => essays.id, { onDelete: "cascade" }),
    essayVersionId: uuid("essay_version_id").notNull().references(() => essayVersions.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    source: feedbackSourceEnum("source").notNull().default("human"),
    body: text("body"),
    /** Structured critique (only for source = ai_approved), post human edits. */
    critique: jsonb("critique"),
    selectedText: text("selected_text"),
    startOffset: integer("start_offset"),
    endOffset: integer("end_offset"),
    status: commentStatusEnum("status").notNull().default("outstanding"),
    resolvedAt: ts("resolved_at"),
    publishedAt: ts("published_at").notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [index("essay_feedback_essay_idx").on(t.essayId)],
);

export const aiCritiqueRequests = pgTable(
  "ai_critique_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    essayId: uuid("essay_id").notNull().references(() => essays.id, { onDelete: "cascade" }),
    essayVersionId: uuid("essay_version_id").notNull().references(() => essayVersions.id, { onDelete: "cascade" }),
    requestedBy: uuid("requested_by").references(() => users.id, { onDelete: "set null" }),
    rubricId: uuid("rubric_id").references(() => essayRubrics.id, { onDelete: "set null" }),
    rubricVersion: integer("rubric_version"),
    status: aiRequestStatusEnum("status").notNull().default("queued"),
    provider: varchar("provider", { length: 40 }),
    model: varchar("model", { length: 100 }),
    promptVersion: varchar("prompt_version", { length: 20 }).notNull(),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: createdAt(),
    completedAt: ts("completed_at"),
  },
  (t) => [index("ai_requests_status_idx").on(t.status), index("ai_requests_essay_idx").on(t.essayId)],
);

export const aiCritiqueResults = pgTable("ai_critique_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: uuid("request_id").notNull().unique().references(() => aiCritiqueRequests.id, { onDelete: "cascade" }),
  output: jsonb("output").notNull(),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  generatedAt: createdAt(),
});

export const aiCritiqueApprovals = pgTable(
  "ai_critique_approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resultId: uuid("result_id").notNull().unique().references(() => aiCritiqueResults.id, { onDelete: "cascade" }),
    decision: aiDecisionEnum("decision").notNull().default("pending"),
    reviewerId: uuid("reviewer_id").references(() => users.id, { onDelete: "set null" }),
    editedOutput: jsonb("edited_output"),
    changesMade: jsonb("changes_made"),
    notes: text("notes"),
    decidedAt: ts("decided_at"),
    publishedFeedbackId: uuid("published_feedback_id").references(() => essayFeedback.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("ai_approvals_decision_idx").on(t.decision)],
);

/* ------------------------------------------------------------------ */
/* Answer bank                                                         */
/* ------------------------------------------------------------------ */

export const answerBankEntries = pgTable(
  "answer_bank_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    category: answerCategoryEnum("category").notNull(),
    title: varchar("title", { length: 250 }).notNull(),
    body: text("body").notNull(),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [
    index("answer_bank_user_idx").on(t.userId),
    index("answer_bank_fts_idx").using("gin", sql`to_tsvector('english', ${t.title} || ' ' || ${t.body})`),
  ],
);

export const answerBankEmbeddings = pgTable("answer_bank_embeddings", {
  entryId: uuid("entry_id").primaryKey().references(() => answerBankEntries.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 40 }).notNull(),
  model: varchar("model", { length: 100 }).notNull(),
  dimensions: integer("dimensions").notNull(),
  contentHash: varchar("content_hash", { length: 64 }).notNull(),
  embedding: vector("embedding").notNull(),
  createdAt: createdAt(),
});

export const promptEmbeddings = pgTable("prompt_embeddings", {
  contentHash: varchar("content_hash", { length: 64 }).primaryKey(),
  model: varchar("model", { length: 100 }).notNull(),
  embedding: vector("embedding").notNull(),
  createdAt: createdAt(),
});

/* ------------------------------------------------------------------ */
/* Referees                                                            */
/* ------------------------------------------------------------------ */

export const refereeRequests = pgTable(
  "referee_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "restrict" }),
    applicantId: uuid("applicant_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    refereeName: varchar("referee_name", { length: 200 }).notNull(),
    refereeEmail: varchar("referee_email", { length: 320 }).notNull(),
    relationship: varchar("relationship", { length: 120 }).notNull(),
    organization: varchar("organization", { length: 200 }),
    message: text("message"),
    deadline: date("deadline", { mode: "string" }).notNull(),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    tokenExpiresAt: ts("token_expires_at").notNull(),
    tokenUsedAt: ts("token_used_at"),
    status: refereeStatusEnum("status").notNull().default("sent"),
    openedAt: ts("opened_at"),
    submittedAt: ts("submitted_at"),
    cancelledAt: ts("cancelled_at"),
    cancelledBy: uuid("cancelled_by").references(() => users.id, { onDelete: "set null" }),
    reminderSentAt: ts("reminder_sent_at"),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("referee_token_uq").on(t.tokenHash), index("referee_app_idx").on(t.applicationId), index("referee_status_idx").on(t.status)],
);

export const refereeUploads = pgTable("referee_uploads", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: uuid("request_id").notNull().unique().references(() => refereeRequests.id, { onDelete: "restrict" }),
  documentVersionId: uuid("document_version_id").notNull().references(() => documentVersions.id, { onDelete: "restrict" }),
  confirmedName: varchar("confirmed_name", { length: 200 }).notNull(),
  ip: varchar("ip", { length: 64 }),
  createdAt: createdAt(),
});

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export const notificationTemplates = pgTable(
  "notification_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: varchar("key", { length: 100 }).notNull(),
    channel: notificationChannelEnum("channel").notNull(),
    subject: varchar("subject", { length: 250 }),
    body: text("body").notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("notification_templates_key_channel_uq").on(t.key, t.channel)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    channel: notificationChannelEnum("channel").notNull(),
    templateKey: varchar("template_key", { length: 100 }).notNull(),
    recipientEmail: varchar("recipient_email", { length: 320 }),
    recipientPhone: varchar("recipient_phone", { length: 30 }),
    subject: varchar("subject", { length: 250 }),
    body: text("body").notNull(),
    actionUrl: text("action_url"),
    data: jsonb("data"),
    idempotencyKey: varchar("idempotency_key", { length: 250 }).notNull(),
    status: notificationStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: ts("next_attempt_at").notNull().defaultNow(),
    lockedAt: ts("locked_at"),
    lastError: text("last_error"),
    provider: varchar("provider", { length: 40 }),
    providerMessageId: varchar("provider_message_id", { length: 250 }),
    readAt: ts("read_at"),
    sentAt: ts("sent_at"),
    deliveredAt: ts("delivered_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("notifications_idem_uq").on(t.idempotencyKey),
    index("notifications_dispatch_idx").on(t.status, t.nextAttemptAt),
    index("notifications_user_idx").on(t.userId, t.channel, t.createdAt),
    index("notifications_provider_msg_idx").on(t.providerMessageId),
  ],
);

export const notificationDeliveryAttempts = pgTable(
  "notification_delivery_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    notificationId: uuid("notification_id").notNull().references(() => notifications.id, { onDelete: "cascade" }),
    attemptNumber: integer("attempt_number").notNull(),
    status: varchar("status", { length: 20 }).notNull(),
    provider: varchar("provider", { length: 40 }),
    response: jsonb("response"),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [index("delivery_attempts_notif_idx").on(t.notificationId)],
);

export const notificationPreferences = pgTable("notification_preferences", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  emailEnabled: boolean("email_enabled").notNull().default(true),
  smsEnabled: boolean("sms_enabled").notNull().default(false),
  inAppEnabled: boolean("in_app_enabled").notNull().default(true),
  milestoneReminders: boolean("milestone_reminders").notNull().default(true),
  overdueReminders: boolean("overdue_reminders").notNull().default(true),
  refereeUpdates: boolean("referee_updates").notNull().default(true),
  feedbackUpdates: boolean("feedback_updates").notNull().default(true),
  updatedAt: updatedAt(),
});

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */

export const contentCategories = pgTable(
  "content_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    description: text("description"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("content_categories_slug_uq").on(t.slug)],
);

export const contentTags = pgTable(
  "content_tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 80 }).notNull(),
    slug: varchar("slug", { length: 80 }).notNull(),
  },
  (t) => [uniqueIndex("content_tags_slug_uq").on(t.slug)],
);

export const educationalResources = pgTable(
  "educational_resources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: varchar("title", { length: 250 }).notNull(),
    slug: varchar("slug", { length: 250 }).notNull(),
    categoryId: uuid("category_id").references(() => contentCategories.id, { onDelete: "set null" }),
    type: contentTypeEnum("type").notNull().default("article"),
    description: varchar("description", { length: 500 }),
    body: text("body").notNull().default(""),
    featuredImageUrl: text("featured_image_url"),
    externalUrl: text("external_url"),
    authorName: varchar("author_name", { length: 150 }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    status: contentStatusEnum("status").notNull().default("draft"),
    visibility: contentVisibilityEnum("visibility").notNull().default("public"),
    publishedAt: ts("published_at"),
    seoTitle: varchar("seo_title", { length: 250 }),
    seoDescription: varchar("seo_description", { length: 320 }),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("resources_slug_uq").on(t.slug), index("resources_status_idx").on(t.status, t.publishedAt)],
);

export const resourceTags = pgTable(
  "resource_tags",
  {
    resourceId: uuid("resource_id").notNull().references(() => educationalResources.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id").notNull().references(() => contentTags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.resourceId, t.tagId] })],
);

export const contactMessages = pgTable("contact_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 150 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  subject: varchar("subject", { length: 200 }).notNull(),
  message: text("message").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("new"),
  createdAt: createdAt(),
});

/* ------------------------------------------------------------------ */
/* Platform, audit, analytics, privacy                                 */
/* ------------------------------------------------------------------ */

export const userActivity = pgTable(
  "user_activity",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    eventType: varchar("event_type", { length: 80 }).notNull(),
    entityType: varchar("entity_type", { length: 60 }),
    entityId: uuid("entity_id"),
    metadata: jsonb("metadata"),
    createdAt: createdAt(),
  },
  (t) => [index("user_activity_event_idx").on(t.eventType, t.createdAt), index("user_activity_entity_idx").on(t.entityType, t.entityId)],
);

/** Append-only: UPDATE/DELETE/TRUNCATE blocked by trigger (see migration 0001_audit_append_only). */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    eventType: varchar("event_type", { length: 80 }).notNull(),
    actorId: uuid("actor_id"),
    actorRole: varchar("actor_role", { length: 30 }),
    targetType: varchar("target_type", { length: 60 }),
    targetId: varchar("target_id", { length: 80 }),
    ip: varchar("ip", { length: 64 }),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata"),
    previousState: jsonb("previous_state"),
    newState: jsonb("new_state"),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_event_idx").on(t.eventType, t.createdAt),
    index("audit_actor_idx").on(t.actorId, t.createdAt),
    index("audit_target_idx").on(t.targetType, t.targetId),
  ],
);

export const platformSettings = pgTable("platform_settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: updatedAt(),
});

export const rateLimits = pgTable(
  "rate_limits",
  {
    key: varchar("key", { length: 200 }).notNull(),
    windowStart: ts("window_start").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

export const dataRequests = pgTable(
  "data_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    type: dataRequestTypeEnum("type").notNull(),
    status: dataRequestStatusEnum("status").notNull().default("pending"),
    reason: text("reason"),
    processedBy: uuid("processed_by").references(() => users.id, { onDelete: "set null" }),
    notes: text("notes"),
    exportStorageKey: text("export_storage_key"),
    requestedAt: createdAt(),
    completedAt: ts("completed_at"),
  },
  (t) => [index("data_requests_status_idx").on(t.status, t.type)],
);

export const jobRuns = pgTable(
  "job_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    job: varchar("job", { length: 80 }).notNull(),
    startedAt: createdAt(),
    finishedAt: ts("finished_at"),
    status: varchar("status", { length: 20 }).notNull().default("running"),
    result: jsonb("result"),
    error: text("error"),
  },
  (t) => [index("job_runs_job_idx").on(t.job, t.startedAt)],
);

export const analyticsDaily = pgTable(
  "analytics_daily",
  {
    day: date("day", { mode: "string" }).notNull(),
    metric: varchar("metric", { length: 80 }).notNull(),
    dimension: varchar("dimension", { length: 120 }).notNull().default(""),
    value: integer("value").notNull(),
    computedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.day, t.metric, t.dimension] })],
);

/* ------------------------------------------------------------------ */
/* Payments & memberships (Flutterwave)                                */
/* ------------------------------------------------------------------ */

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    /** Our reference, sent to Flutterwave as tx_ref. */
    txRef: varchar("tx_ref", { length: 80 }).notNull(),
    provider: varchar("provider", { length: 30 }).notNull().default("flutterwave"),
    purpose: varchar("purpose", { length: 30 }).notNull().default("membership"),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
    /** pending → successful | failed | cancelled */
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    providerTransactionId: varchar("provider_transaction_id", { length: 80 }),
    paymentMethod: varchar("payment_method", { length: 40 }),
    /** Months of membership this payment buys (0 = lifetime), fixed at checkout time. */
    membershipMonths: integer("membership_months").notNull().default(12),
    providerResponse: jsonb("provider_response"),
    failureReason: text("failure_reason"),
    createdAt: createdAt(),
    paidAt: ts("paid_at"),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("payments_tx_ref_uq").on(t.txRef), uniqueIndex("payments_provider_tx_uq").on(t.provider, t.providerTransactionId), index("payments_user_idx").on(t.userId, t.createdAt)],
);

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    plan: varchar("plan", { length: 30 }).notNull().default("standard"),
    startsAt: ts("starts_at").notNull(),
    /** null = lifetime */
    expiresAt: ts("expires_at"),
    /** flutterwave | admin_grant | demo */
    source: varchar("source", { length: 30 }).notNull(),
    paymentId: uuid("payment_id").references(() => payments.id, { onDelete: "set null" }),
    grantedBy: uuid("granted_by").references(() => users.id, { onDelete: "set null" }),
    note: text("note"),
    revokedAt: ts("revoked_at"),
    createdAt: createdAt(),
  },
  (t) => [index("memberships_user_idx").on(t.userId, t.expiresAt), uniqueIndex("memberships_payment_uq").on(t.paymentId)],
);
