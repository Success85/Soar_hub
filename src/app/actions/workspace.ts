"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { assertUser } from "@/lib/auth/session";
import { toActionError, type ActionResult } from "@/lib/errors";
import { createAnswer, deleteAnswer, searchAnswerBank, updateAnswer, type AnswerMatch } from "@/lib/services/answer-bank";
import { deleteDocument, renameDocument, requestDocumentReview, setCommentStatus, uploadDocument, type DocumentCategory } from "@/lib/services/documents";
import { createEssay, deleteEssay, finalizeEssay, saveEssay, setFeedbackStatus, submitEssayForReview } from "@/lib/services/essays";
import { cancelRefereeRequest, createRefereeRequest, resendRefereeRequest } from "@/lib/services/referees";
import { exportDownloadUrl, requestDeletion, requestExport } from "@/lib/services/privacy";

const uuid = z.string().uuid();
const opt = (v: FormDataEntryValue | null) => (v ? String(v) : null);

export async function uploadDocumentAction(_: unknown, fd: FormData): Promise<ActionResult<{ documentId: string }>> {
  try {
    const user = await assertUser();
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a file to upload.", fieldErrors: { file: "Required" } };
    const res = await uploadDocument(user, {
      file,
      category: z.enum(["academic_transcript", "certificate", "cv", "passport", "identification", "essay", "recommendation_letter", "financial_documentation", "other"]).parse(fd.get("category") ?? "other") as DocumentCategory,
      title: opt(fd.get("title")) ?? undefined,
      applicationId: opt(fd.get("applicationId")),
      requirementId: opt(fd.get("requirementId")),
      documentId: opt(fd.get("documentId")),
    });
    return { ok: true, data: { documentId: res.documentId }, message: `Uploaded version ${res.version.versionNumber}.` };
  } catch (e) {
    return toActionError(e);
  }
}

export async function renameDocumentAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await renameDocument(await assertUser(), uuid.parse(fd.get("documentId")), String(fd.get("title") ?? ""));
    return { ok: true, message: "Renamed." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteDocumentAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await deleteDocument(await assertUser(), uuid.parse(fd.get("documentId")));
  } catch (e) {
    return toActionError(e);
  }
  redirect("/documents?deleted=1");
}

export async function requestReviewAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await requestDocumentReview(await assertUser(), uuid.parse(fd.get("documentId")));
    return { ok: true, message: "Sent for review. Your reviewer has been notified." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function commentStatusAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await setCommentStatus(await assertUser(), uuid.parse(fd.get("commentId")), fd.get("status") === "resolved" ? "resolved" : "outstanding");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

function essayInput(fd: FormData) {
  return { title: String(fd.get("title") ?? ""), prompt: String(fd.get("prompt") ?? ""), body: String(fd.get("body") ?? ""), wordLimit: fd.get("wordLimit") ? String(fd.get("wordLimit")) : null, applicationId: opt(fd.get("applicationId")), note: opt(fd.get("note")) } as never;
}

export async function createEssayAction(_: unknown, fd: FormData): Promise<ActionResult> {
  let id: string;
  try {
    ({ id } = await createEssay(await assertUser(), essayInput(fd)));
  } catch (e) {
    return toActionError(e);
  }
  redirect(`/essays/${id}`);
}

export async function saveEssayAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const r = await saveEssay(await assertUser(), uuid.parse(fd.get("essayId")), essayInput(fd));
    return { ok: true, message: r.newVersion ? `Saved as version ${r.essay.currentVersion}.` : "No changes since your last save." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function submitEssayAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await submitEssayForReview(await assertUser(), uuid.parse(fd.get("essayId")));
    return { ok: true, message: "Submitted for review. You'll be notified when feedback is ready." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function finalizeEssayAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await finalizeEssay(await assertUser(), uuid.parse(fd.get("essayId")), fd.get("reopen") === "1");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteEssayAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await deleteEssay(await assertUser(), uuid.parse(fd.get("essayId")));
  } catch (e) {
    return toActionError(e);
  }
  redirect("/essays");
}

export async function feedbackStatusAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await setFeedbackStatus(await assertUser(), uuid.parse(fd.get("feedbackId")), fd.get("status") === "resolved" ? "resolved" : "outstanding");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

function answerInput(fd: FormData) {
  return { category: String(fd.get("category") ?? "other"), title: String(fd.get("title") ?? ""), body: String(fd.get("body") ?? ""), tags: String(fd.get("tags") ?? "").split(",").map((t) => t.trim()).filter(Boolean) };
}

export async function saveAnswerAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const user = await assertUser();
    const id = opt(fd.get("id"));
    if (id) await updateAnswer(user.id, uuid.parse(id), answerInput(fd));
    else await createAnswer(user.id, answerInput(fd));
    return { ok: true, message: "Saved to your answer bank." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteAnswerAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await deleteAnswer((await assertUser()).id, uuid.parse(fd.get("id")));
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function searchAnswersAction(_: unknown, fd: FormData): Promise<ActionResult<{ mode: string; note?: string; matches: AnswerMatch[] }>> {
  try {
    const out = await searchAnswerBank((await assertUser()).id, String(fd.get("prompt") ?? ""));
    return { ok: true, data: out };
  } catch (e) {
    return toActionError(e);
  }
}

export async function createRefereeAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await createRefereeRequest(await assertUser(), {
      applicationId: String(fd.get("applicationId") ?? ""),
      refereeName: String(fd.get("refereeName") ?? ""),
      refereeEmail: String(fd.get("refereeEmail") ?? ""),
      relationship: String(fd.get("relationship") ?? ""),
      organization: opt(fd.get("organization")),
      message: opt(fd.get("message")),
      deadline: String(fd.get("deadline") ?? ""),
    });
    return { ok: true, message: "Request sent. Your referee will receive a secure upload link by email." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function cancelRefereeAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await cancelRefereeRequest(await assertUser(), uuid.parse(fd.get("requestId")));
    return { ok: true, message: "Link revoked." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function resendRefereeAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await resendRefereeRequest(await assertUser(), uuid.parse(fd.get("requestId")));
    return { ok: true, message: "A fresh link was sent. The previous link no longer works." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function requestExportAction(): Promise<ActionResult> {
  try {
    await requestExport((await assertUser({ verified: false })).id);
    return { ok: true, message: "Your data export is ready below." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function downloadExportAction(_: unknown, fd: FormData): Promise<ActionResult> {
  let url: string;
  try {
    url = await exportDownloadUrl((await assertUser({ verified: false })).id, uuid.parse(fd.get("requestId")));
  } catch (e) {
    return toActionError(e);
  }
  redirect(url);
}

export async function requestDeletionAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const user = await assertUser({ verified: false });
    if (String(fd.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") return { ok: false, error: "Type DELETE to confirm.", fieldErrors: { confirm: "Type DELETE" } };
    await requestDeletion(user.id, opt(fd.get("reason")));
  } catch (e) {
    return toActionError(e);
  }
  redirect("/login?signedOut=1");
}
