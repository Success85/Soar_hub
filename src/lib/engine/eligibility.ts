/**
 * Data-driven eligibility rule engine with three-valued (Kleene) logic.
 *
 * Pure module — no database access — so it can be unit-tested exhaustively and reused
 * for admin "preview against sample profile" without side effects.
 */
import { FIELD_MAP, fieldLabel, getField, isCustomField, optionLabel } from "./fields";

export type Verdict = "eligible" | "ineligible" | "undetermined";
export type OverallVerdict = "likely_eligible" | "more_info_needed" | "not_eligible";
export type Operator =
  | "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "not_in" | "contains"
  | "exists" | "not_exists" | "is_true" | "is_false" | "between" | "age_between" | "matches";
export type Severity = "absolute" | "important" | "advisory";

export const OPERATORS: { value: Operator; label: string; needsValue: "none" | "single" | "list" | "range" }[] = [
  { value: "eq", label: "Equals", needsValue: "single" },
  { value: "neq", label: "Does not equal", needsValue: "single" },
  { value: "gt", label: "Greater than", needsValue: "single" },
  { value: "gte", label: "Greater than or equal to", needsValue: "single" },
  { value: "lt", label: "Less than", needsValue: "single" },
  { value: "lte", label: "Less than or equal to", needsValue: "single" },
  { value: "in", label: "Is one of", needsValue: "list" },
  { value: "not_in", label: "Is not one of", needsValue: "list" },
  { value: "contains", label: "Contains", needsValue: "list" },
  { value: "exists", label: "Has been provided", needsValue: "none" },
  { value: "not_exists", label: "Has not been provided", needsValue: "none" },
  { value: "is_true", label: "Is yes / true", needsValue: "none" },
  { value: "is_false", label: "Is no / false", needsValue: "none" },
  { value: "between", label: "Is between (inclusive)", needsValue: "range" },
  { value: "age_between", label: "Age is between (inclusive)", needsValue: "range" },
  { value: "matches", label: "Matches pattern (advanced)", needsValue: "single" },
];

export interface Criterion {
  id: string;
  name: string;
  description?: string | null;
  fieldKey: string;
  operator: Operator;
  requiredValue: unknown;
  severity: Severity;
  isFixable: boolean;
  isRequired: boolean;
  groupId?: string | null;
  passExplanation?: string | null;
  failExplanation?: string | null;
  recommendedAction?: string | null;
  sourceReference?: string | null;
  questionText?: string | null;
  answerType?: string | null;
  answerOptions?: unknown;
  sortOrder?: number;
}

export interface CriteriaGroup {
  id: string;
  name: string;
  logic: "and" | "or";
}

export interface CriterionResult {
  criterionId: string;
  criterionName: string;
  criterionDescription: string | null;
  fieldKey: string;
  applicantValue: unknown;
  requiredValue: unknown;
  verdict: Verdict;
  explanation: string;
  isFixable: boolean;
  isAbsolute: boolean;
  isRequired: boolean;
  recommendedAction: string | null;
  source: string | null;
  groupId: string | null;
}

export interface EvaluationResult {
  overall: OverallVerdict;
  topLevel: Verdict;
  results: CriterionResult[];
  groupVerdicts: Record<string, Verdict>;
  counts: Record<Verdict, number>;
  summary: string;
}

/** Applicant facts keyed by field key (registry keys and "custom.*" keys). */
export type Facts = Record<string, unknown>;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function isMissing(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
}

const norm = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : v);

function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return Date.parse(v);
  return null;
}

function toList(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (v === null || v === undefined) return [];
  if (typeof v === "string" && v.includes(",")) return v.split(",").map((s) => s.trim()).filter(Boolean);
  return [v];
}

function toBool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === "yes") return true;
  if (v === "false" || v === "no") return false;
  return null;
}

function looseEq(a: unknown, b: unknown): boolean {
  const na = toNumber(a);
  const nb = toNumber(b);
  if (na !== null && nb !== null && typeof a !== "boolean" && typeof b !== "boolean") return na === nb;
  if (typeof a === "boolean" || typeof b === "boolean") return toBool(a) === toBool(b);
  return norm(a) === norm(b);
}

export function calculateAge(dateOfBirth: string | null | undefined, at: Date = new Date()): number | null {
  if (!dateOfBirth) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateOfBirth);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let age = at.getUTCFullYear() - y;
  const beforeBirthday = at.getUTCMonth() + 1 < mo || (at.getUTCMonth() + 1 === mo && at.getUTCDate() < d);
  if (beforeBirthday) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

/* ------------------------------------------------------------------ */
/* Operator evaluation                                                 */
/* ------------------------------------------------------------------ */

/** Evaluates one operator. Missing applicant data ⇒ "undetermined" (never forced to ineligible). */
export function evaluateOperator(operator: Operator, value: unknown, required: unknown): Verdict {
  const yes = (b: boolean): Verdict => (b ? "eligible" : "ineligible");

  if (operator === "exists") return isMissing(value) ? "undetermined" : "eligible";
  if (operator === "not_exists") return isMissing(value) ? "eligible" : "ineligible";
  if (isMissing(value)) return "undetermined";

  switch (operator) {
    case "eq":
      return yes(looseEq(value, required));
    case "neq":
      return yes(!looseEq(value, required));
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const a = toNumber(value);
      const b = toNumber(required);
      if (a === null || b === null) return "undetermined";
      if (operator === "gt") return yes(a > b);
      if (operator === "gte") return yes(a >= b);
      if (operator === "lt") return yes(a < b);
      return yes(a <= b);
    }
    case "between":
    case "age_between": {
      const range = Array.isArray(required) ? required : [(required as { min?: unknown })?.min, (required as { max?: unknown })?.max];
      const a = toNumber(value);
      const min = range[0] === null || range[0] === undefined || range[0] === "" ? -Infinity : toNumber(range[0]);
      const max = range[1] === null || range[1] === undefined || range[1] === "" ? Infinity : toNumber(range[1]);
      if (a === null || min === null || max === null) return "undetermined";
      return yes(a >= min && a <= max);
    }
    case "in": {
      const allowed = toList(required);
      const vals = toList(value);
      return yes(vals.some((v) => allowed.some((r) => looseEq(v, r))));
    }
    case "not_in": {
      const banned = toList(required);
      const vals = toList(value);
      return yes(!vals.some((v) => banned.some((r) => looseEq(v, r))));
    }
    case "contains": {
      if (typeof value === "string" && !Array.isArray(required)) {
        return yes(value.toLowerCase().includes(String(required).toLowerCase()));
      }
      const have = toList(value);
      const need = toList(required);
      return yes(need.every((n) => have.some((h) => looseEq(h, n))));
    }
    case "is_true": {
      const b = toBool(value);
      return b === null ? "undetermined" : yes(b === true);
    }
    case "is_false": {
      const b = toBool(value);
      return b === null ? "undetermined" : yes(b === false);
    }
    case "matches": {
      const pattern = String(required ?? "");
      if (pattern.length > 200) return "undetermined";
      try {
        return yes(new RegExp(pattern, "i").test(String(value)));
      } catch {
        return "undetermined";
      }
    }
    default:
      return "undetermined";
  }
}

/* ------------------------------------------------------------------ */
/* Kleene logic                                                        */
/* ------------------------------------------------------------------ */

export function and3(verdicts: Verdict[]): Verdict {
  if (verdicts.some((v) => v === "ineligible")) return "ineligible";
  if (verdicts.some((v) => v === "undetermined")) return "undetermined";
  return "eligible";
}

export function or3(verdicts: Verdict[]): Verdict {
  if (verdicts.length === 0) return "eligible";
  if (verdicts.some((v) => v === "eligible")) return "eligible";
  if (verdicts.some((v) => v === "undetermined")) return "undetermined";
  return "ineligible";
}

/* ------------------------------------------------------------------ */
/* Explanations                                                        */
/* ------------------------------------------------------------------ */

export function describeRequirement(c: Pick<Criterion, "operator" | "requiredValue" | "fieldKey">): string {
  const v = c.requiredValue;
  const show = (x: unknown) => optionLabel(c.fieldKey, x);
  switch (c.operator) {
    case "eq": return `must be ${show(v)}`;
    case "neq": return `must not be ${show(v)}`;
    case "gt": return `must be greater than ${show(v)}`;
    case "gte": return `must be at least ${show(v)}`;
    case "lt": return `must be less than ${show(v)}`;
    case "lte": return `must be ${show(v)} or less`;
    case "in": return `must be one of: ${toList(v).map(show).join(", ")}`;
    case "not_in": return `must not be any of: ${toList(v).map(show).join(", ")}`;
    case "contains": return `must include: ${toList(v).map(show).join(", ")}`;
    case "exists": return "must be provided";
    case "not_exists": return "must not apply";
    case "is_true": return "must be yes";
    case "is_false": return "must be no";
    case "between":
    case "age_between": {
      const r = Array.isArray(v) ? v : [];
      return `must be between ${r[0] ?? "any"} and ${r[1] ?? "any"}`;
    }
    case "matches": return "must match the stated format";
  }
}

function explain(c: Criterion, verdict: Verdict, value: unknown): { explanation: string; action: string | null } {
  const label = fieldLabel(c.fieldKey).toLowerCase();
  const shown = optionLabel(c.fieldKey, value);
  const req = describeRequirement(c);
  const absolute = c.severity === "absolute";

  if (verdict === "eligible") {
    return {
      explanation: c.passExplanation?.trim() || `Your ${label} meets this scholarship's requirement (${req}).`,
      action: null,
    };
  }
  if (verdict === "undetermined") {
    const field = getField(c.fieldKey);
    const how = field && !field.askable ? "Upload it in your Documents workspace" : "Answer the question below or update your profile";
    return {
      explanation: `We don't have enough information about your ${label} yet, so this criterion can't be assessed. The requirement: ${label} ${req}.`,
      action: `${how} to complete this assessment.`,
    };
  }
  const base = c.failExplanation?.trim() || `Your ${label} (${shown}) does not match this scholarship's requirement: ${label} ${req}.`;
  const tail = absolute
    ? " This requirement is an absolute criterion, so it cannot be waived."
    : c.isFixable
      ? " This is something you may be able to change."
      : "";
  const defaultAction = absolute
    ? "Explore other scholarships that match your profile — your preparation still counts."
    : c.isFixable
      ? `Check that your ${label} is entered correctly, or take steps to meet the requirement before the deadline.`
      : "Double-check that your information is correct. If it is, consider other opportunities.";
  return { explanation: base + tail, action: c.recommendedAction?.trim() || defaultAction };
}

/* ------------------------------------------------------------------ */
/* Evaluation                                                          */
/* ------------------------------------------------------------------ */

export function evaluateCriterion(c: Criterion, facts: Facts): CriterionResult {
  const value = facts[c.fieldKey];
  const verdict = evaluateOperator(c.operator, value, c.requiredValue);
  const { explanation, action } = explain(c, verdict, value);
  return {
    criterionId: c.id,
    criterionName: c.name,
    criterionDescription: c.description ?? null,
    fieldKey: c.fieldKey,
    applicantValue: value === undefined ? null : value,
    requiredValue: c.requiredValue ?? null,
    verdict,
    explanation,
    isFixable: verdict === "undetermined" ? true : c.severity === "absolute" ? false : c.isFixable,
    isAbsolute: c.severity === "absolute",
    isRequired: c.isRequired,
    recommendedAction: action,
    source: c.sourceReference ?? null,
    groupId: c.groupId ?? null,
  };
}

export function evaluate(criteria: Criterion[], facts: Facts, groups: CriteriaGroup[] = []): EvaluationResult {
  const sorted = [...criteria].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const results = sorted.map((c) => evaluateCriterion(c, facts));
  const groupMap = new Map(groups.map((g) => [g.id, g]));

  const groupVerdicts: Record<string, Verdict> = {};
  const topInputs: Verdict[] = [];
  const byGroup = new Map<string, Verdict[]>();

  for (const r of results) {
    if (!r.isRequired) continue;
    if (r.groupId && groupMap.has(r.groupId)) {
      const arr = byGroup.get(r.groupId) ?? [];
      arr.push(r.verdict);
      byGroup.set(r.groupId, arr);
    } else {
      topInputs.push(r.verdict);
    }
  }
  for (const [gid, verdicts] of byGroup) {
    const g = groupMap.get(gid)!;
    const v = g.logic === "or" ? or3(verdicts) : and3(verdicts);
    groupVerdicts[gid] = v;
    topInputs.push(v);
  }
  const topLevel = and3(topInputs);
  const overall: OverallVerdict = topLevel === "ineligible" ? "not_eligible" : topLevel === "undetermined" ? "more_info_needed" : "likely_eligible";

  const counts = { eligible: 0, ineligible: 0, undetermined: 0 } as Record<Verdict, number>;
  for (const r of results) counts[r.verdict]++;

  return { overall, topLevel, results, groupVerdicts, counts, summary: summarise(overall, results) };
}

export function summarise(overall: OverallVerdict, results: CriterionResult[]): string {
  if (overall === "likely_eligible") {
    return "Based on the information you've provided, you appear to meet this scholarship's stated criteria. This is guidance, not a guarantee of selection — the university makes all final decisions.";
  }
  if (overall === "more_info_needed") {
    const n = results.filter((r) => r.verdict === "undetermined" && r.isRequired).length;
    return `You may be eligible. We need a little more information to assess ${n} criterion${n === 1 ? "" : "a"}. Answer the remaining questions to complete your assessment.`;
  }
  const absolute = results.some((r) => r.verdict === "ineligible" && r.isAbsolute && r.isRequired);
  return absolute
    ? "Based on your current information, you don't meet at least one absolute requirement for this scholarship. Please check your details are correct — and explore other opportunities that fit you."
    : "Based on your current information, you don't yet meet one or more requirements. Some may be fixable — see the recommended actions below.";
}

/* ------------------------------------------------------------------ */
/* Facts                                                               */
/* ------------------------------------------------------------------ */

export interface ProfileLike {
  [key: string]: unknown;
  dateOfBirth?: string | null;
}

/** Builds engine facts from a profile, derived values, uploaded documents and saved answers. */
export function buildFacts(input: {
  profile: ProfileLike | null;
  documentCategories?: string[];
  customAnswers?: Record<string, unknown>;
  deadline?: Date | null;
  now?: Date;
}): Facts {
  const facts: Facts = {};
  const p = input.profile ?? {};
  for (const field of Object.values(FIELD_MAP)) {
    if (field.profileKey) {
      const raw = p[field.profileKey];
      facts[field.key] = field.type === "number" && raw !== null && raw !== undefined ? Number(raw) : raw ?? null;
    }
  }
  const dob = (p.dateOfBirth as string | null | undefined) ?? null;
  facts.age = calculateAge(dob, input.now ?? new Date());
  facts.age_at_deadline = input.deadline ? calculateAge(dob, input.deadline) : facts.age;
  facts.uploaded_document_categories = input.documentCategories ?? [];
  for (const [k, v] of Object.entries(input.customAnswers ?? {})) {
    if (isCustomField(k)) facts[k] = v;
  }
  return facts;
}

/* ------------------------------------------------------------------ */
/* Adaptive question ordering                                          */
/* ------------------------------------------------------------------ */

export interface ScholarshipCriteriaSet {
  scholarshipId: string;
  scholarshipName?: string;
  criteria: Criterion[];
  groups: CriteriaGroup[];
}

export interface Question {
  fieldKey: string; // the key the answer is stored under (e.g. date_of_birth for age)
  label: string;
  prompt: string;
  help?: string;
  why: string;
  type: string;
  options?: { value: string; label: string }[];
  sensitive: boolean;
  resolves: number;
  decidesAbsolute: boolean;
  scholarshipIds: string[];
  score: number;
}

/**
 * Picks the questions that resolve the most uncertainty first.
 *
 * - Scholarships already decided (eligible or definitively ineligible) generate no questions,
 *   which eliminates scholarships early when a definite disqualifier is known.
 * - Only decisive criteria count: within an OR group that is already satisfied, the
 *   remaining members are moot.
 * - Fields already known are never asked again.
 * - Sensitive fields are deferred: they are ranked after all non-sensitive fields.
 */
export function planQuestions(sets: ScholarshipCriteriaSet[], facts: Facts): Question[] {
  const candidates = new Map<string, Question>();

  for (const set of sets) {
    const ev = evaluate(set.criteria, facts, set.groups);
    if (ev.topLevel !== "undetermined") continue;
    const groupLogic = new Map(set.groups.map((g) => [g.id, g.logic]));

    for (const r of ev.results) {
      if (r.verdict !== "undetermined" || !r.isRequired) continue;
      if (r.groupId && groupLogic.has(r.groupId) && ev.groupVerdicts[r.groupId] !== "undetermined") continue;
      const criterion = set.criteria.find((c) => c.id === r.criterionId)!;
      const field = getField(r.fieldKey);
      let key: string;
      let q: Omit<Question, "resolves" | "decidesAbsolute" | "scholarshipIds" | "score">;
      if (isCustomField(r.fieldKey)) {
        key = r.fieldKey;
        const opts = Array.isArray(criterion.answerOptions) ? (criterion.answerOptions as unknown[]).map((o) => (typeof o === "string" ? { value: o, label: o } : (o as { value: string; label: string }))) : undefined;
        q = {
          fieldKey: key,
          label: criterion.name,
          prompt: criterion.questionText?.trim() || `${criterion.name}?`,
          why: criterion.description?.trim() || "This scholarship asks about this specifically.",
          type: criterion.answerType || (opts ? "enum" : "boolean"),
          options: opts,
          sensitive: false,
        };
      } else {
        if (!field || !field.askable) continue;
        key = field.askVia ?? field.key;
        const target = getField(key) ?? field;
        q = {
          fieldKey: key,
          label: target.label,
          prompt: target.question,
          help: target.help,
          why: target.why,
          type: target.type,
          options: target.options,
          sensitive: target.sensitive,
        };
      }
      if (facts[key] !== undefined && facts[key] !== null && facts[key] !== "") continue;
      const existing = candidates.get(key);
      const decidesAbsolute = criterion.severity === "absolute";
      if (existing) {
        existing.resolves += 1;
        existing.decidesAbsolute ||= decidesAbsolute;
        if (!existing.scholarshipIds.includes(set.scholarshipId)) existing.scholarshipIds.push(set.scholarshipId);
      } else {
        candidates.set(key, { ...q, resolves: 1, decidesAbsolute, scholarshipIds: [set.scholarshipId], score: 0 });
      }
    }
  }

  const list = [...candidates.values()];
  for (const q of list) {
    q.score = (q.sensitive ? 0 : 1000) + (q.decidesAbsolute ? 100 : 0) + q.scholarshipIds.length * 10 + q.resolves;
  }
  return list.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
}

/* ------------------------------------------------------------------ */
/* Criteria validation (before publication)                            */
/* ------------------------------------------------------------------ */

export function validateCriteria(criteria: Criterion[], groups: CriteriaGroup[] = []): string[] {
  const errors: string[] = [];
  const groupIds = new Set(groups.map((g) => g.id));
  criteria.forEach((c, i) => {
    const where = `Criterion ${i + 1} (“${c.name || "unnamed"}”)`;
    if (!c.name?.trim()) errors.push(`${where}: a name is required.`);
    if (!isCustomField(c.fieldKey) && !FIELD_MAP[c.fieldKey]) errors.push(`${where}: unknown field “${c.fieldKey}”.`);
    if (isCustomField(c.fieldKey) && !c.questionText?.trim()) errors.push(`${where}: custom criteria need a question for applicants.`);
    const op = OPERATORS.find((o) => o.value === c.operator);
    if (!op) {
      errors.push(`${where}: unknown operator.`);
      return;
    }
    if (op.needsValue === "single" && (c.requiredValue === null || c.requiredValue === undefined || c.requiredValue === "")) errors.push(`${where}: a required value is needed.`);
    if (op.needsValue === "list" && toList(c.requiredValue).length === 0) errors.push(`${where}: provide at least one allowed value.`);
    if (op.needsValue === "range") {
      const r = Array.isArray(c.requiredValue) ? c.requiredValue : [];
      if (r.length !== 2 || (r[0] === null && r[1] === null)) errors.push(`${where}: provide a minimum and/or maximum.`);
      else if (toNumber(r[0]) !== null && toNumber(r[1]) !== null && toNumber(r[0])! > toNumber(r[1])!) errors.push(`${where}: minimum is greater than maximum.`);
    }
    if (["gt", "gte", "lt", "lte"].includes(c.operator) && toNumber(c.requiredValue) === null) errors.push(`${where}: comparison value must be a number or date.`);
    if (c.operator === "matches") {
      try {
        new RegExp(String(c.requiredValue));
      } catch {
        errors.push(`${where}: invalid pattern.`);
      }
    }
    if (c.groupId && !groupIds.has(c.groupId)) errors.push(`${where}: belongs to a group that doesn't exist.`);
  });
  return errors;
}
