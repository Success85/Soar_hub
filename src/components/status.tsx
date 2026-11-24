import { Badge } from "@/components/ui/misc";
import { OUTCOME_LABELS, STATUS_LABELS, type AppStatus, type Outcome } from "@/lib/engine/state-machine";

type Tone = React.ComponentProps<typeof Badge>["tone"];

export function AppStatusBadge({ status, outcome }: { status: AppStatus; outcome?: Outcome | null }) {
  const tone: Record<AppStatus, Tone> = { draft: "neutral", screening: "info", eligible: "success", ineligible: "danger", in_progress: "gold", submitted: "navy", shortlisted: "success", outcome: "navy" };
  return <Badge tone={tone[status]}>{status === "outcome" && outcome ? OUTCOME_LABELS[outcome] : STATUS_LABELS[status]}</Badge>;
}

export const VERDICT_LABELS = { likely_eligible: "Likely eligible", more_info_needed: "Potentially eligible — more information needed", not_eligible: "Not eligible" } as const;
export function VerdictBadge({ verdict, short }: { verdict: keyof typeof VERDICT_LABELS | null | undefined; short?: boolean }) {
  if (!verdict) return <Badge>Not checked</Badge>;
  const tone = { likely_eligible: "success", more_info_needed: "warning", not_eligible: "danger" } as const;
  return <Badge tone={tone[verdict]}>{short && verdict === "more_info_needed" ? "More info needed" : VERDICT_LABELS[verdict]}</Badge>;
}

export function CriterionVerdictBadge({ verdict }: { verdict: "eligible" | "ineligible" | "undetermined" }) {
  const map = { eligible: ["success", "Meets requirement"], ineligible: ["danger", "Does not meet"], undetermined: ["warning", "Undetermined"] } as const;
  return <Badge tone={map[verdict][0]}>{map[verdict][1]}</Badge>;
}

export const REVIEW_LABELS = { uploaded: "Uploaded", pending_review: "Pending review", under_review: "Under review", approved: "Approved", needs_revision: "Needs revision", rejected: "Rejected" } as const;
export function ReviewStatusBadge({ status }: { status: keyof typeof REVIEW_LABELS }) {
  const tone = { uploaded: "neutral", pending_review: "info", under_review: "gold", approved: "success", needs_revision: "warning", rejected: "danger" } as const;
  return <Badge tone={tone[status]}>{REVIEW_LABELS[status]}</Badge>;
}

export const MILESTONE_LABELS = { upcoming: "Upcoming", in_progress: "In progress", completed: "Completed", due_today: "Due today", overdue: "Overdue", blocked: "Blocked" } as const;
export function MilestoneBadge({ status }: { status: keyof typeof MILESTONE_LABELS }) {
  const tone = { upcoming: "neutral", in_progress: "info", completed: "success", due_today: "gold", overdue: "danger", blocked: "warning" } as const;
  return <Badge tone={tone[status]}>{MILESTONE_LABELS[status]}</Badge>;
}

export const SCHOLARSHIP_STATUS_LABELS = { draft: "Draft", pending_verification: "Pending verification", verified: "Verified", published: "Published", expired: "Expired", archived: "Archived", deactivated: "Deactivated" } as const;
export function ScholarshipStatusBadge({ status }: { status: keyof typeof SCHOLARSHIP_STATUS_LABELS }) {
  const tone = { draft: "neutral", pending_verification: "warning", verified: "info", published: "success", expired: "neutral", archived: "neutral", deactivated: "danger" } as const;
  return <Badge tone={tone[status]}>{SCHOLARSHIP_STATUS_LABELS[status]}</Badge>;
}

export const ESSAY_STATUS_LABELS = { draft: "Draft", submitted_for_review: "Submitted for review", ai_review_pending: "AI review pending", human_review_pending: "Human review pending", feedback_approved: "Feedback ready", revision_requested: "Revision requested", finalized: "Finalised" } as const;
export function EssayStatusBadge({ status }: { status: keyof typeof ESSAY_STATUS_LABELS }) {
  const tone = { draft: "neutral", submitted_for_review: "info", ai_review_pending: "info", human_review_pending: "gold", feedback_approved: "success", revision_requested: "warning", finalized: "navy" } as const;
  return <Badge tone={tone[status]}>{ESSAY_STATUS_LABELS[status]}</Badge>;
}

export function RefereeStatusBadge({ status }: { status: "sent" | "opened" | "submitted" | "expired" | "cancelled" }) {
  const map = { sent: ["info", "Sent"], opened: ["gold", "Opened"], submitted: ["success", "Submitted"], expired: ["neutral", "Expired"], cancelled: ["danger", "Cancelled"] } as const;
  return <Badge tone={map[status][0]}>{map[status][1]}</Badge>;
}

export function NotificationStatusBadge({ status }: { status: "pending" | "queued" | "sending" | "sent" | "delivered" | "failed" | "cancelled" }) {
  const tone = { pending: "neutral", queued: "info", sending: "gold", sent: "success", delivered: "success", failed: "danger", cancelled: "neutral" } as const;
  return <Badge tone={tone[status]}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
}
