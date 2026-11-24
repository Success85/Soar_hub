import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Bot } from "lucide-react";
import { completeEssayReviewAction, essayFeedbackAction, requestAiAction } from "@/app/actions/review";
import { AnchorCommentPanel } from "@/components/anchor-comment";
import { CritiqueEditor } from "@/components/critique-editor";
import { CritiqueView } from "@/components/critique-view";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms/action-form";
import { EssayStatusBadge } from "@/components/status";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Label, Select, Textarea } from "@/components/ui/form";
import { Alert, Badge, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { aiStatus, CritiqueSchema } from "@/lib/integrations/ai";
import { critiquesForEssay, essayAccess, essayBundle } from "@/lib/services/essays";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ReviewEssayPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const access = await essayAccess(user, id).catch(() => null);
  if (!access || access.access === "owner") notFound();
  const { essay, versions, feedback, scholarship } = await essayBundle(id);
  const [owner] = await db.select({ firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, essay.userId)).limit(1);
  const current = versions[0];
  const critiques = await critiquesForEssay(id);
  const canGenerate = user.permissions.has("ai.generate");
  const ai = aiStatus();
  const vFeedback = feedback.filter((f) => f.f.essayVersionId === current.id);
  const reviewOpen = ["human_review_pending", "ai_review_pending", "submitted_for_review"].includes(essay.status);

  return (
    <>
      <PageHeader back={{ href: "/reviewer/essays", label: "Essay queue" }} title={essay.title} description={`${owner.firstName} ${owner.lastName}${scholarship ? ` · ${scholarship.name}` : ""} · v${current.versionNumber} · ${current.wordCount}${essay.wordLimit ? ` / ${essay.wordLimit}` : ""} words`} actions={<EssayStatusBadge status={essay.status} />} />
      <Card className="mb-6">
        <CardHeader><div><CardTitle>Prompt</CardTitle><p className="mt-1 whitespace-pre-wrap text-sm text-muted">{current.prompt || "No prompt provided."}</p></div></CardHeader>
        <CardBody>
          <AnchorCommentPanel text={current.body} anchors={vFeedback.filter((f) => f.f.selectedText).map((f) => ({ id: f.f.id, start: f.f.startOffset ?? -1, end: f.f.endOffset ?? -1, resolved: f.f.status === "resolved" }))} action={essayFeedbackAction} hidden={{ essayId: essay.id, versionId: current.id }} placeholder="Ask a question or suggest what to develop — don't rewrite their words." />
        </CardBody>
      </Card>

      <section id="ai" className="mb-6 scroll-mt-24">
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2"><Bot className="size-4" aria-hidden /> AI-assisted critique</CardTitle>
              <p className="mt-1 text-sm text-muted">Drafts are hidden from the applicant until you approve them. You can edit anything before publishing.</p>
            </div>
            {canGenerate && ai.configured && <ActionButton action={requestAiAction} fields={{ essayId: essay.id }} variant="secondary" pendingLabel="Generating…">Generate critique for v{current.versionNumber}</ActionButton>}
          </CardHeader>
          <CardBody className="space-y-6">
            {!ai.configured && <Alert tone="info">AI critique is not configured on this platform ({ai.missing.join(", ")} missing). Human review works as normal.</Alert>}
            {critiques.length === 0 && ai.configured && <p className="text-sm text-muted">No AI critique has been generated for this essay.</p>}
            {critiques.map(({ request, result, approval }) => {
              const parsed = result ? CritiqueSchema.safeParse(approval?.editedOutput ?? result.output) : null;
              const v = versions.find((x) => x.id === request.essayVersionId);
              return (
                <div key={request.id} className="rounded-xl border border-line p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                    <span>v{v?.versionNumber} · {request.provider ?? "—"} {request.model ?? ""} · prompt {request.promptVersion}{request.rubricVersion ? ` · rubric v${request.rubricVersion}` : " · default rubric"} · {formatDateTime(result?.generatedAt ?? request.createdAt)}</span>
                    <Badge tone={request.status === "failed" ? "danger" : approval?.decision === "approved" ? "success" : approval?.decision === "rejected" ? "neutral" : "warning"}>
                      {request.status !== "completed" ? `Generation ${request.status}` : approval?.decision === "pending" ? "Awaiting your approval" : approval?.decision === "needs_more_review" ? "Needs more review" : approval?.decision}
                    </Badge>
                  </div>
                  {request.status === "failed" && <Alert tone="danger">{request.error}</Alert>}
                  {request.status === "completed" && parsed?.success && approval && (approval.decision === "pending" || approval.decision === "needs_more_review") ? (
                    <>
                      {approval.notes && <Alert tone="warning" className="mb-4">Flag note: {approval.notes}</Alert>}
                      <CritiqueEditor approvalId={approval.id} c={parsed.data} />
                    </>
                  ) : parsed?.success ? (
                    <>
                      <CritiqueView c={parsed.data} />
                      {approval?.decidedAt && <p className="mt-3 text-xs text-muted">{approval.decision} {formatDateTime(approval.decidedAt)}{(approval.changesMade as { fields?: string[] } | null)?.fields?.length ? ` · edited: ${(approval.changesMade as { fields: string[] }).fields.join(", ")}` : ""}{approval.notes ? ` · “${approval.notes}”` : ""}</p>}
                    </>
                  ) : null}
                </div>
              );
            })}
          </CardBody>
        </Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Feedback on this version</CardTitle></CardHeader>
          <CardBody>
            {vFeedback.length === 0 ? <p className="text-sm text-muted">No feedback yet.</p> : (
              <ul className="space-y-3">
                {vFeedback.map(({ f, author }) => (
                  <li key={f.id} className="rounded-lg border border-line p-3 text-sm">
                    {f.selectedText && <blockquote className="mb-1 border-l-4 border-gold-500 pl-2 italic text-muted">“{f.selectedText}”</blockquote>}
                    <p>{f.source === "ai_approved" ? "Approved AI-assisted critique" : f.body}</p>
                    <p className="mt-1 text-xs text-muted">{author?.firstName} · {formatDateTime(f.publishedAt)} · {f.status}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Complete review</CardTitle></CardHeader>
          <CardBody>
            {reviewOpen ? (
              <ActionForm action={completeEssayReviewAction} className="space-y-3">
                <input type="hidden" name="essayId" value={essay.id} />
                <div className="space-y-1.5"><Label htmlFor="decision">Outcome</Label><Select id="decision" name="decision" defaultValue="revision_requested"><option value="revision_requested">Request revision</option><option value="feedback_approved">Feedback complete — ready</option></Select></div>
                <div className="space-y-1.5"><Label htmlFor="summary">Summary message (optional)</Label><Textarea id="summary" name="summary" placeholder="Encouraging summary with the top priority." /></div>
                <SubmitButton>Complete review & notify applicant</SubmitButton>
              </ActionForm>
            ) : (
              <p className="text-sm text-muted">This essay isn&apos;t currently waiting for review. You can still add comments above.</p>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
