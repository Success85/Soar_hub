"use server";

import { z } from "zod";
import { assertUser } from "@/lib/auth/session";
import { ForbiddenError, toActionError, type ActionResult } from "@/lib/errors";
import { addDocumentComment, decideReview, setCommentStatus, startReview } from "@/lib/services/documents";
import { addEssayFeedback, approveCritique, completeEssayReview, rejectCritique, requestAiCritique } from "@/lib/services/essays";

const uuid = z.string().uuid();
const num = (v: FormDataEntryValue | null) => (v === null || v === "" ? null : Number(v));

async function reviewer() {
  const u = await assertUser();
  if (!u.permissions.has("reviewer.access") && !u.permissions.has("admin.access")) throw new ForbiddenError();
  return u;
}

export async function startDocReviewAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await startReview(await reviewer(), uuid.parse(fd.get("versionId")));
    return { ok: true, message: "Marked as under review." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function docCommentAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const sel = String(fd.get("selectedText") ?? "");
    await addDocumentComment(await reviewer(), uuid.parse(fd.get("versionId")), String(fd.get("body") ?? ""), sel ? { selectedText: sel, startOffset: num(fd.get("startOffset")), endOffset: num(fd.get("endOffset")) } : null);
    return { ok: true, message: "Comment added." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function docDecisionAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await decideReview(await reviewer(), uuid.parse(fd.get("versionId")), z.enum(["approved", "needs_revision", "rejected"]).parse(fd.get("decision")), (fd.get("summary") as string) || null);
    return { ok: true, message: "Review recorded and the applicant has been notified." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function reviewerCommentStatusAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await setCommentStatus(await reviewer(), uuid.parse(fd.get("commentId")), fd.get("status") === "resolved" ? "resolved" : "outstanding");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function essayFeedbackAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await addEssayFeedback(await reviewer(), uuid.parse(fd.get("essayId")), {
      versionId: uuid.parse(fd.get("versionId")),
      body: String(fd.get("body") ?? ""),
      selectedText: (fd.get("selectedText") as string) || null,
      startOffset: num(fd.get("startOffset")),
      endOffset: num(fd.get("endOffset")),
    });
    return { ok: true, message: "Feedback added. It is visible to the applicant." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function completeEssayReviewAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await completeEssayReview(await reviewer(), uuid.parse(fd.get("essayId")), z.enum(["feedback_approved", "revision_requested"]).parse(fd.get("decision")), (fd.get("summary") as string) || null);
    return { ok: true, message: "Review completed and the applicant has been notified." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function requestAiAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await requestAiCritique(await reviewer(), uuid.parse(fd.get("essayId")));
    return { ok: true, message: "AI critique requested. It will appear below for your approval." };
  } catch (e) {
    return toActionError(e);
  }
}

const lines = (v: FormDataEntryValue | null) => String(v ?? "").split("\n").map((s) => s.trim()).filter(Boolean);

/** Rebuilds a structured critique from the reviewer's edit form. */
function critiqueFromForm(fd: FormData) {
  const dims = fd.getAll("rubric_dimension").map(String);
  const ratings = fd.getAll("rubric_rating").map(String);
  const comments = fd.getAll("rubric_comment").map(String);
  const quotes = fd.getAll("obs_quote").map(String);
  const obs = fd.getAll("obs_text").map(String);
  return {
    overall_summary: String(fd.get("overall_summary") ?? "").trim(),
    strengths: lines(fd.get("strengths")),
    areas_for_improvement: lines(fd.get("areas_for_improvement")),
    specific_observations: quotes.map((q, i) => ({ quote: q.trim(), observation: (obs[i] ?? "").trim() })).filter((o) => o.observation),
    evidence_gaps: lines(fd.get("evidence_gaps")),
    questions_to_consider: lines(fd.get("questions_to_consider")),
    rubric_evaluation: dims.map((d, i) => ({ dimension: d, rating: ratings[i], comment: (comments[i] ?? "").trim() })),
    revision_priorities: lines(fd.get("revision_priorities")).map((action, i) => ({ priority: i + 1, action })),
    word_count_compliance: { compliant: fd.get("wc_compliant") === "true" ? true : fd.get("wc_compliant") === "false" ? false : null, note: String(fd.get("wc_note") ?? "").trim() },
  };
}

export async function approveCritiqueAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await approveCritique(await reviewer(), uuid.parse(fd.get("approvalId")), critiqueFromForm(fd), (fd.get("notes") as string) || null);
    return { ok: true, message: "Critique approved and published to the applicant." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function rejectCritiqueAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await rejectCritique(await reviewer(), uuid.parse(fd.get("approvalId")), (fd.get("notes") as string) || null, fd.get("decision") === "needs_more_review" ? "needs_more_review" : "rejected");
    return { ok: true, message: fd.get("decision") === "needs_more_review" ? "Flagged for additional review." : "Critique rejected. It will not be shown to the applicant." };
  } catch (e) {
    return toActionError(e);
  }
}
