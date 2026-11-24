import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bot, Sparkles } from "lucide-react";
import { deleteEssayAction, feedbackStatusAction, finalizeEssayAction, submitEssayAction } from "@/app/actions/workspace";
import { AnchoredText } from "@/components/anchored-text";
import { AnswerSuggestions } from "@/components/answer-suggestions";
import { CritiqueView } from "@/components/critique-view";
import { EssayEditor } from "@/components/essay-editor";
import { ActionButton } from "@/components/forms/action-form";
import { EssayStatusBadge } from "@/components/status";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, Badge, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { diffWords } from "@/lib/diff";
import { CritiqueSchema } from "@/lib/integrations/ai";
import { listApplicationsForUser } from "@/lib/services/applications";
import { essayBundle } from "@/lib/services/essays";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Essay" };
export const dynamic = "force-dynamic";

export default async function EssayPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ compare?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const b = await essayBundle(id).catch(() => null);
  if (!b || b.essay.userId !== user.id) notFound();
  const { essay, versions, feedback, scholarship } = b;
  const apps = await listApplicationsForUser(user.id);
  const { compare } = await searchParams;
  const locked = ["ai_review_pending", "human_review_pending", "finalized"].includes(essay.status);
  const cmp = compare ? versions.find((v) => String(v.versionNumber) === compare) : null;
  const current = versions[0];
  const anchored = feedback.filter((f) => f.f.selectedText && f.f.essayVersionId === current?.id);

  return (
    <>
      <PageHeader back={{ href: "/essays", label: "Essays" }} title={essay.title} description={scholarship ? `For ${scholarship.name}` : "Not linked to a scholarship"} actions={<EssayStatusBadge status={essay.status} />} />
      {essay.status === "ai_review_pending" && <Alert tone="info" className="mb-6" title="Feedback is being prepared">An AI assistant is drafting suggestions, which a human reviewer will check before you see them. Editing is paused until review completes.</Alert>}
      {essay.status === "human_review_pending" && <Alert tone="info" className="mb-6" title="Waiting for your reviewer">A reviewer will read your essay and send feedback. Editing is paused until then.</Alert>}
      {essay.status === "finalized" && <Alert tone="success" className="mb-6" title="Finalised">This essay is marked final. Reopen it if you need to make changes.</Alert>}

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <Card><CardBody className="p-5 sm:p-8"><EssayEditor essay={essay} applications={apps.map((a) => ({ id: a.app.id, name: a.sch.name }))} locked={locked} /></CardBody></Card>

          {anchored.length > 0 && current && (
            <Card>
              <CardHeader><CardTitle>Highlighted comments on version {current.versionNumber}</CardTitle></CardHeader>
              <CardBody><AnchoredText text={current.body} anchors={anchored.map((f, i) => ({ id: f.f.id, start: f.f.startOffset ?? -1, end: f.f.endOffset ?? -1, resolved: f.f.status === "resolved", label: i + 1 }))} /></CardBody>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Feedback</CardTitle></CardHeader>
            <CardBody>
              {feedback.length === 0 ? (
                <p className="text-sm text-muted">No feedback yet. Submit your essay for review when you&apos;re ready.</p>
              ) : (
                <ul className="space-y-4">
                  {feedback.map(({ f, author }) => {
                    const v = versions.find((x) => x.id === f.essayVersionId);
                    const critique = f.critique ? CritiqueSchema.safeParse(f.critique) : null;
                    const idx = anchored.findIndex((a) => a.f.id === f.id);
                    return (
                      <li key={f.id} className={cn("rounded-xl border p-4", f.status === "resolved" ? "border-line opacity-75" : "border-gold-200 bg-gold-50/40")}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="flex items-center gap-2 text-sm font-semibold">
                            {f.source === "ai_approved" ? <><Bot className="size-4" aria-hidden /> AI-assisted critique, reviewed and approved by {author?.firstName ?? "a reviewer"}</> : <>{author?.firstName} {author?.lastName}</>}
                          </p>
                          <span className="flex items-center gap-2 text-xs text-muted">v{v?.versionNumber} · {formatDateTime(f.publishedAt)}</span>
                        </div>
                        {f.selectedText && <blockquote className="mt-2 border-l-4 border-gold-500 pl-3 text-sm italic text-muted">{idx >= 0 && <span className="not-italic font-semibold text-gold-700">[{idx + 1}] </span>}“{f.selectedText}”</blockquote>}
                        <div className="mt-2">{critique?.success ? <CritiqueView c={critique.data} /> : <p className="whitespace-pre-wrap text-sm">{f.body}</p>}</div>
                        <div className="mt-3 flex items-center gap-2">
                          <Badge tone={f.status === "resolved" ? "success" : "warning"}>{f.status === "resolved" ? "Revision done" : "Outstanding"}</Badge>
                          <ActionButton action={feedbackStatusAction} fields={{ feedbackId: f.id, status: f.status === "resolved" ? "outstanding" : "resolved" }} size="sm" variant="ghost">{f.status === "resolved" ? "Reopen" : "Mark revision completed"}</ActionButton>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>

          {cmp && current && (
            <Card>
              <CardHeader><CardTitle>Changes from v{cmp.versionNumber} to v{current.versionNumber}</CardTitle><Link href={`/essays/${essay.id}`} className="text-sm font-semibold text-royal-700">Close</Link></CardHeader>
              <CardBody>
                <div className="whitespace-pre-wrap font-serif text-[15px] leading-7">
                  {diffWords(cmp.body, current.body).map((p, i) => p.type === "same" ? <span key={i}>{p.text}</span> : p.type === "add" ? <ins key={i} className="bg-success-100 text-success-700 no-underline">{p.text}</ins> : <del key={i} className="bg-danger-100 text-danger-700">{p.text}</del>)}
                </div>
              </CardBody>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Review & finalise</CardTitle></CardHeader>
            <CardBody className="space-y-3">
              {["draft", "revision_requested", "feedback_approved"].includes(essay.status) && (
                <>
                  <ActionButton action={submitEssayAction} fields={{ essayId: essay.id }} className="w-full" pendingLabel="Submitting…">Submit version {essay.currentVersion} for review</ActionButton>
                  <p className="text-xs text-muted">A reviewer will give feedback. If enabled, an AI assistant drafts suggestions first — a human always checks them before you see anything. AI never rewrites your essay.</p>
                </>
              )}
              {essay.status !== "finalized" ? (
                !locked && <ActionButton action={finalizeEssayAction} fields={{ essayId: essay.id }} variant="secondary" className="w-full">Mark as final</ActionButton>
              ) : (
                <ActionButton action={finalizeEssayAction} fields={{ essayId: essay.id, reopen: "1" }} variant="secondary" className="w-full">Reopen for editing</ActionButton>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-gold-600" aria-hidden /> From your answer bank</CardTitle></CardHeader>
            <CardBody><AnswerSuggestions prompt={essay.prompt || essay.title} /><Link href="/answer-bank" className="mt-3 inline-block text-sm font-semibold text-royal-700 hover:underline">Manage answer bank</Link></CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle>Version history</CardTitle></CardHeader>
            <CardBody>
              <ol className="space-y-2">
                {versions.map((v) => (
                  <li key={v.id} className="rounded-lg border border-line px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2"><span className="font-semibold">v{v.versionNumber}</span><span className="text-xs text-muted">{v.wordCount} words</span></div>
                    <p className="text-xs text-muted">{formatDateTime(v.createdAt)}{v.note ? ` · ${v.note}` : ""}</p>
                    {v.versionNumber !== essay.currentVersion && <Link href={`/essays/${essay.id}?compare=${v.versionNumber}`} className="text-xs font-semibold text-royal-700 hover:underline">Compare with current</Link>}
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
          {!locked && <ActionButton action={deleteEssayAction} fields={{ essayId: essay.id }} variant="ghost" className="text-danger-700" confirm="Delete this essay?">Delete essay</ActionButton>}
        </div>
      </div>
    </>
  );
}
