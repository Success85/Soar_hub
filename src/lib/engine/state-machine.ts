/**
 * Application lifecycle state machine with guarded transitions.
 *
 *   draft → screening → eligible → in_progress → submitted → shortlisted → outcome
 *                    ↘ ineligible                         ↘───────────────↗
 * Re-screening is allowed from eligible/ineligible after profile changes.
 */
export type AppStatus = "draft" | "screening" | "eligible" | "ineligible" | "in_progress" | "submitted" | "shortlisted" | "outcome";
export type Actor = "applicant" | "admin" | "reviewer" | "system";
export type Outcome = "awarded" | "declined" | "waitlisted" | "not_selected" | "pending" | "unknown";

export const STATUS_LABELS: Record<AppStatus, string> = {
  draft: "Draft",
  screening: "Screening",
  eligible: "Eligible",
  ineligible: "Ineligible",
  in_progress: "In progress",
  submitted: "Submitted",
  shortlisted: "Shortlisted",
  outcome: "Outcome recorded",
};

export const OUTCOME_LABELS: Record<Outcome, string> = {
  awarded: "Awarded",
  declined: "Declined",
  waitlisted: "Waitlisted",
  not_selected: "Not selected",
  pending: "Pending",
  unknown: "Unknown",
};

export interface TransitionContext {
  actor: Actor;
  assessmentVerdict?: "likely_eligible" | "more_info_needed" | "not_eligible" | null;
  missingDocuments?: string[];
  incompleteMilestones?: string[];
  outcome?: Outcome | null;
  reason?: string | null;
}

interface Rule {
  to: AppStatus;
  actors: Actor[];
  guard?: (ctx: TransitionContext) => string[];
}

const needsReasonForAdmin = (ctx: TransitionContext) =>
  ctx.actor === "admin" && !ctx.reason?.trim() ? ["Administrators must give a reason when overriding a screening result."] : [];

export const TRANSITIONS: Record<AppStatus, Rule[]> = {
  draft: [{ to: "screening", actors: ["applicant", "admin", "system"] }],
  screening: [
    {
      to: "eligible",
      actors: ["system", "admin"],
      guard: (ctx) =>
        ctx.actor === "system" && ctx.assessmentVerdict !== "likely_eligible"
          ? ["The eligibility assessment must show “Likely eligible” first."]
          : needsReasonForAdmin(ctx),
    },
    {
      to: "ineligible",
      actors: ["system", "admin"],
      guard: (ctx) =>
        ctx.actor === "system" && ctx.assessmentVerdict !== "not_eligible" ? ["The assessment does not show an ineligible result."] : needsReasonForAdmin(ctx),
    },
  ],
  eligible: [
    { to: "in_progress", actors: ["applicant", "admin", "system"] },
    { to: "screening", actors: ["applicant", "admin", "system"] },
  ],
  ineligible: [{ to: "screening", actors: ["applicant", "admin", "system"] }],
  in_progress: [
    {
      to: "submitted",
      actors: ["applicant", "admin"],
      guard: (ctx) => {
        const errs: string[] = [];
        if (ctx.assessmentVerdict === "not_eligible") errs.push("Your latest eligibility assessment shows you don't meet a requirement.");
        for (const d of ctx.missingDocuments ?? []) errs.push(`Required document not ready: ${d}`);
        for (const m of ctx.incompleteMilestones ?? []) errs.push(`Required task not completed: ${m}`);
        return errs;
      },
    },
    { to: "screening", actors: ["applicant", "admin", "system"] },
  ],
  submitted: [
    { to: "shortlisted", actors: ["applicant", "admin"] },
    { to: "outcome", actors: ["applicant", "admin"], guard: (ctx) => (ctx.outcome ? [] : ["Choose an outcome to record."]) },
  ],
  shortlisted: [{ to: "outcome", actors: ["applicant", "admin"], guard: (ctx) => (ctx.outcome ? [] : ["Choose an outcome to record."]) }],
  outcome: [],
};

export interface TransitionCheck {
  ok: boolean;
  errors: string[];
}

export function canTransition(from: AppStatus, to: AppStatus, ctx: TransitionContext): TransitionCheck {
  const rule = TRANSITIONS[from].find((r) => r.to === to);
  if (!rule) return { ok: false, errors: [`An application can't move from “${STATUS_LABELS[from]}” to “${STATUS_LABELS[to]}”.`] };
  if (!rule.actors.includes(ctx.actor)) return { ok: false, errors: ["You don't have permission to make this change."] };
  const errors = rule.guard ? rule.guard(ctx) : [];
  return { ok: errors.length === 0, errors };
}

export function allowedTransitions(from: AppStatus, actor: Actor): AppStatus[] {
  return TRANSITIONS[from].filter((r) => r.actors.includes(actor)).map((r) => r.to);
}

/** Ordered pipeline used for progress indicators. */
export const PIPELINE: AppStatus[] = ["draft", "screening", "eligible", "in_progress", "submitted", "shortlisted", "outcome"];
