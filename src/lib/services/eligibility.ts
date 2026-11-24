import "server-only";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  documents,
  eligibilityAssessmentAnswers,
  eligibilityAssessments,
  eligibilityResults,
  profiles,
  scholarshipCriteria,
  scholarshipCriteriaGroups,
  scholarships,
} from "@/lib/db/schema";
import { buildFacts, evaluate, planQuestions, type CriteriaGroup, type Criterion, type EvaluationResult, type Facts, type Question } from "@/lib/engine/eligibility";
import { FIELD_MAP, getField, isCustomField } from "@/lib/engine/fields";
import { AppError, NotFoundError } from "@/lib/errors";
import { audit, trackActivity } from "./audit";
import { profileSchema, updateProfile } from "./profile";

export async function loadCriteriaSet(scholarshipId: string): Promise<{ criteria: Criterion[]; groups: CriteriaGroup[] }> {
  const [rows, groupRows] = await Promise.all([
    db.select().from(scholarshipCriteria).where(eq(scholarshipCriteria.scholarshipId, scholarshipId)).orderBy(asc(scholarshipCriteria.sortOrder)),
    db.select().from(scholarshipCriteriaGroups).where(eq(scholarshipCriteriaGroups.scholarshipId, scholarshipId)).orderBy(asc(scholarshipCriteriaGroups.sortOrder)),
  ]);
  return {
    criteria: rows.map((r) => ({ ...r, operator: r.operator, severity: r.severity })),
    groups: groupRows.map((g) => ({ id: g.id, name: g.name, logic: g.logic })),
  };
}

async function latestCustomAnswers(userId: string, scholarshipId: string): Promise<Record<string, unknown>> {
  const rows = await db
    .select()
    .from(eligibilityAssessmentAnswers)
    .where(and(eq(eligibilityAssessmentAnswers.userId, userId), eq(eligibilityAssessmentAnswers.scholarshipId, scholarshipId)))
    .orderBy(desc(eligibilityAssessmentAnswers.answeredAt));
  const out: Record<string, unknown> = {};
  for (const r of rows) if (isCustomField(r.fieldKey) && !(r.fieldKey in out)) out[r.fieldKey] = r.value;
  return out;
}

export async function loadFacts(userId: string, scholarship: { id: string; deadline: Date | null }): Promise<Facts> {
  const [[profile], docRows, custom] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1),
    db.selectDistinct({ category: documents.category }).from(documents).where(and(eq(documents.userId, userId), isNull(documents.deletedAt))),
    latestCustomAnswers(userId, scholarship.id),
  ]);
  return buildFacts({
    profile: (profile as unknown as Record<string, unknown>) ?? null,
    documentCategories: docRows.map((d) => d.category),
    customAnswers: custom,
    deadline: scholarship.deadline,
  });
}

function coerce(fieldKey: string, raw: unknown): unknown {
  if (raw === "" || raw === undefined) return null;
  const f = getField(fieldKey);
  const type = f?.type;
  if (type === "number") return raw === null ? null : Number(raw);
  if (type === "boolean" || (!f && (raw === "true" || raw === "false"))) return raw === true || raw === "true" ? true : raw === false || raw === "false" ? false : null;
  if (type === "string_list") return Array.isArray(raw) ? raw : String(raw).split(",").map((s) => s.trim()).filter(Boolean);
  return raw;
}

export interface AssessmentOutcome {
  assessmentId: string;
  evaluation: EvaluationResult;
  questions: Question[];
}

/**
 * Runs (or re-runs) an eligibility assessment. Profile-field answers are written to the
 * applicant's profile so they are never asked twice; custom answers are stored per scholarship.
 * Every run is stored as a new historical record; the newest is marked current.
 */
export async function runAssessment(
  userId: string,
  scholarshipId: string,
  opts: { answers?: Record<string, unknown>; trigger?: "manual" | "profile_change" | "criteria_change"; actorRole?: string } = {},
): Promise<AssessmentOutcome> {
  const [sch] = await db.select().from(scholarships).where(eq(scholarships.id, scholarshipId)).limit(1);
  if (!sch) throw new NotFoundError("Scholarship");
  if (opts.trigger !== "profile_change" && opts.trigger !== "criteria_change" && (sch.status !== "published" || !sch.isActive)) {
    throw new AppError("This scholarship isn't currently open for eligibility checks.", 400);
  }
  const answers = opts.answers ?? {};

  // 1. persist profile answers through the profile service (validated + audited)
  const profileUpdate: Record<string, unknown> = {};
  let changedProfileKeys: string[] = [];
  const customAnswers: [string, unknown][] = [];
  for (const [key, raw] of Object.entries(answers)) {
    if (isCustomField(key)) customAnswers.push([key, coerce(key, raw)]);
    else {
      const f = FIELD_MAP[key];
      if (f?.profileKey) profileUpdate[f.profileKey] = coerce(key, raw);
    }
  }
  if (Object.keys(profileUpdate).length) {
    const parsed = profileSchema.safeParse(profileUpdate);
    if (!parsed.success) throw new AppError("Please check your answers.", 400, "invalid", Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
    changedProfileKeys = await updateProfile(userId, parsed.data, { id: userId, role: opts.actorRole ?? "applicant" });
  }

  const { criteria, groups } = await loadCriteriaSet(scholarshipId);
  if (criteria.length === 0) throw new AppError("This scholarship's official eligibility criteria haven't been published, so there's nothing to check yet. See the official page.", 400);

  const assessmentId = await db.transaction(async (tx) => {
    const [a] = await tx
      .insert(eligibilityAssessments)
      .values({ userId, scholarshipId, trigger: opts.trigger ?? "manual", status: "in_progress" })
      .returning({ id: eligibilityAssessments.id });
    for (const [fieldKey, value] of customAnswers) {
      await tx.insert(eligibilityAssessmentAnswers).values({ assessmentId: a.id, userId, scholarshipId, fieldKey, value: value as object });
    }
    for (const [key, raw] of Object.entries(answers)) {
      if (!isCustomField(key)) await tx.insert(eligibilityAssessmentAnswers).values({ assessmentId: a.id, userId, scholarshipId, fieldKey: key, value: coerce(key, raw) as object });
    }
    return a.id;
  });

  const facts = await loadFacts(userId, sch);
  const evaluation = evaluate(criteria, facts, groups);
  const questions = planQuestions([{ scholarshipId, criteria, groups }], facts);

  await db.transaction(async (tx) => {
    await tx
      .update(eligibilityAssessments)
      .set({ isCurrent: false })
      .where(and(eq(eligibilityAssessments.userId, userId), eq(eligibilityAssessments.scholarshipId, scholarshipId), eq(eligibilityAssessments.isCurrent, true)));
    await tx
      .update(eligibilityAssessments)
      .set({
        isCurrent: true,
        status: evaluation.overall === "more_info_needed" && questions.length > 0 ? "in_progress" : "completed",
        overallVerdict: evaluation.overall,
        profileSnapshot: Object.fromEntries(Object.entries(facts).filter(([k]) => !getField(k)?.sensitive)),
        eligibleCount: evaluation.counts.eligible,
        ineligibleCount: evaluation.counts.ineligible,
        undeterminedCount: evaluation.counts.undetermined,
        completedAt: new Date(),
      })
      .where(eq(eligibilityAssessments.id, assessmentId));
    if (evaluation.results.length) {
      await tx.insert(eligibilityResults).values(
        evaluation.results.map((r) => ({
          assessmentId,
          criterionId: r.criterionId,
          criterionName: r.criterionName,
          criterionDescription: r.criterionDescription,
          fieldKey: r.fieldKey,
          applicantValue: getField(r.fieldKey)?.sensitive ? (r.applicantValue === null ? null : "[provided]") : (r.applicantValue as object),
          requiredValue: r.requiredValue as object,
          verdict: r.verdict,
          explanation: r.explanation,
          isFixable: r.isFixable,
          isAbsolute: r.isAbsolute,
          isRequired: r.isRequired,
          recommendedAction: r.recommendedAction,
          source: r.source,
        })),
      );
    }
    await audit(
      {
        eventType: "eligibility.assessed",
        actorId: opts.trigger === "manual" || !opts.trigger ? userId : null,
        actorRole: opts.trigger === "manual" || !opts.trigger ? (opts.actorRole ?? "applicant") : "system",
        targetType: "eligibility_assessment",
        targetId: assessmentId,
        metadata: { scholarshipId, trigger: opts.trigger ?? "manual", verdict: evaluation.overall, counts: evaluation.counts },
      },
      tx,
    );
  });

  // keep any linked application in step with the new verdict
  const { syncApplicationWithAssessment } = await import("./applications");
  await syncApplicationWithAssessment(userId, scholarshipId, assessmentId, evaluation.overall);
  if (changedProfileKeys.length) await recalculateForProfileChange(userId, changedProfileKeys, scholarshipId);
  await trackActivity("eligibility.assessed", { userId, entityType: "scholarship", entityId: scholarshipId, metadata: { verdict: evaluation.overall } });

  return { assessmentId, evaluation, questions };
}

/** Questions still needed for a scholarship (without running a stored assessment). */
export async function pendingQuestions(userId: string, scholarshipId: string): Promise<{ questions: Question[]; preview: EvaluationResult }> {
  const [sch] = await db.select().from(scholarships).where(eq(scholarships.id, scholarshipId)).limit(1);
  if (!sch) throw new NotFoundError("Scholarship");
  const { criteria, groups } = await loadCriteriaSet(scholarshipId);
  const facts = await loadFacts(userId, sch);
  return { questions: planQuestions([{ scholarshipId, criteria, groups }], facts), preview: evaluate(criteria, facts, groups) };
}

export async function getAssessment(assessmentId: string) {
  const [a] = await db.select().from(eligibilityAssessments).where(eq(eligibilityAssessments.id, assessmentId)).limit(1);
  if (!a) return null;
  const results = await db.select().from(eligibilityResults).where(eq(eligibilityResults.assessmentId, assessmentId));
  return { assessment: a, results };
}

export async function currentAssessment(userId: string, scholarshipId: string) {
  const [a] = await db
    .select()
    .from(eligibilityAssessments)
    .where(and(eq(eligibilityAssessments.userId, userId), eq(eligibilityAssessments.scholarshipId, scholarshipId), eq(eligibilityAssessments.isCurrent, true)))
    .orderBy(desc(eligibilityAssessments.createdAt))
    .limit(1);
  return a ?? null;
}

export async function assessmentHistory(userId: string, scholarshipId?: string) {
  return db
    .select({ a: eligibilityAssessments, s: { name: scholarships.name, slug: scholarships.slug } })
    .from(eligibilityAssessments)
    .innerJoin(scholarships, eq(scholarships.id, eligibilityAssessments.scholarshipId))
    .where(scholarshipId ? and(eq(eligibilityAssessments.userId, userId), eq(eligibilityAssessments.scholarshipId, scholarshipId)) : eq(eligibilityAssessments.userId, userId))
    .orderBy(desc(eligibilityAssessments.createdAt))
    .limit(50);
}

const PROFILE_TO_FIELDS: Record<string, string[]> = {};
for (const f of Object.values(FIELD_MAP)) if (f.profileKey) PROFILE_TO_FIELDS[f.profileKey] = [f.key];
PROFILE_TO_FIELDS.dateOfBirth = ["date_of_birth", "age", "age_at_deadline"];

/** Re-runs current assessments whose criteria depend on changed profile fields. */
export async function recalculateForProfileChange(userId: string, changedProfileKeys: string[], excludeScholarshipId?: string): Promise<number> {
  const affectedFields = new Set(changedProfileKeys.flatMap((k) => PROFILE_TO_FIELDS[k] ?? []));
  if (changedProfileKeys.includes("__documents__")) affectedFields.add("uploaded_document_categories");
  if (affectedFields.size === 0) return 0;
  const current = await db
    .select({ scholarshipId: eligibilityAssessments.scholarshipId })
    .from(eligibilityAssessments)
    .where(and(eq(eligibilityAssessments.userId, userId), eq(eligibilityAssessments.isCurrent, true)));
  if (current.length === 0) return 0;
  const ids = [...new Set(current.map((c) => c.scholarshipId))].filter((id) => id !== excludeScholarshipId);
  if (ids.length === 0) return 0;
  const crit = await db.select({ scholarshipId: scholarshipCriteria.scholarshipId, fieldKey: scholarshipCriteria.fieldKey }).from(scholarshipCriteria).where(inArray(scholarshipCriteria.scholarshipId, ids));
  const toRun = [...new Set(crit.filter((c) => affectedFields.has(c.fieldKey)).map((c) => c.scholarshipId))];
  for (const sid of toRun) await runAssessment(userId, sid, { trigger: "profile_change" });
  return toRun.length;
}

/** Re-runs every current assessment for a scholarship after its criteria change. */
export async function recalculateForScholarship(scholarshipId: string): Promise<number> {
  const rows = await db
    .select({ userId: eligibilityAssessments.userId })
    .from(eligibilityAssessments)
    .where(and(eq(eligibilityAssessments.scholarshipId, scholarshipId), eq(eligibilityAssessments.isCurrent, true)));
  for (const r of rows) await runAssessment(r.userId, scholarshipId, { trigger: "criteria_change" });
  return rows.length;
}

/** Live (non-persisted) screening across all published scholarships, for recommendations. */
export async function screenPublished(userId: string) {
  const list = await db
    .select()
    .from(scholarships)
    .where(and(eq(scholarships.status, "published"), eq(scholarships.isActive, true)));
  const out: { scholarship: typeof scholarships.$inferSelect; verdict: EvaluationResult["overall"]; eligibleCount: number; total: number }[] = [];
  for (const s of list) {
    const { criteria, groups } = await loadCriteriaSet(s.id);
    if (!criteria.length) continue;
    const facts = await loadFacts(userId, s);
    const ev = evaluate(criteria, facts, groups);
    out.push({ scholarship: s, verdict: ev.overall, eligibleCount: ev.counts.eligible, total: criteria.length });
  }
  const rank = { likely_eligible: 0, more_info_needed: 1, not_eligible: 2 } as const;
  return out.sort((a, b) => rank[a.verdict] - rank[b.verdict] || (a.scholarship.deadline?.getTime() ?? Infinity) - (b.scholarship.deadline?.getTime() ?? Infinity));
}

/** Admin preview: evaluate criteria against a sample profile without persistence. */
export function previewAgainstSample(criteria: Criterion[], groups: CriteriaGroup[], sample: Record<string, unknown>, deadline: Date | null) {
  const facts = buildFacts({ profile: sample, documentCategories: (sample.uploadedDocumentCategories as string[]) ?? [], customAnswers: (sample.custom as Record<string, unknown>) ?? {}, deadline });
  return evaluate(criteria, facts, groups);
}
