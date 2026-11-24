import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Eye } from "lucide-react";
import { docCommentAction, docDecisionAction, reviewerCommentStatusAction, startDocReviewAction } from "@/app/actions/review";
import { AnchorCommentPanel } from "@/components/anchor-comment";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms/action-form";
import { ReviewStatusBadge } from "@/components/status";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Label, Select, Textarea } from "@/components/ui/form";
import { Alert, Badge, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { documentAccess, documentDetail } from "@/lib/services/documents";
import { fileSize, formatDateTime } from "@/lib/utils";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function ReviewDocumentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const access = await documentAccess(user, id).catch(() => null);
  if (!access || access.access === "owner") notFound();
  const { doc, versions, comments, reviews, app } = await documentDetail(id);
  const [owner] = await db.select({ firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, doc.userId)).limit(1);
  const { v } = await searchParams;
  const shown = versions.find((x) => String(x.versionNumber) === v) ?? versions[0];
  if (!shown) notFound();
  const vComments = comments.filter((c) => c.c.documentVersionId === shown.id);
  const isCurrent = shown.versionNumber === doc.currentVersion;
  return (
    <>
      <PageHeader back={{ href: "/reviewer/documents", label: "Review queue" }} title={doc.title} description={`${owner.firstName} ${owner.lastName}${app ? ` · ${app.scholarshipName}` : ""}`} actions={<ReviewStatusBadge status={doc.reviewStatus} />} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {versions.map((ver) => <Link key={ver.id} href={`/reviewer/documents/${doc.id}?v=${ver.versionNumber}`} className={`rounded-full border px-3 py-1 text-sm font-medium ${ver.id === shown.id ? "border-navy-900 bg-navy-900 text-ivory" : "border-line bg-white"}`}>v{ver.versionNumber}{ver.versionNumber === doc.currentVersion ? " (current)" : ""}</Link>)}
      </div>
      {!isCurrent && <Alert tone="warning" className="mb-4">You are viewing an older version. Comments you add stay attached to version {shown.versionNumber}.</Alert>}
      <Card className="mb-6">
        <CardHeader>
          <div><CardTitle>Version {shown.versionNumber}</CardTitle><p className="mt-1 text-sm text-muted">{shown.originalFilename} · {fileSize(shown.sizeBytes)} · {formatDateTime(shown.createdAt)} {shown.scanStatus !== "clean" && <Badge>{shown.scanStatus.replace("_", " ")}</Badge>}</p></div>
          <div className="flex flex-wrap gap-2">
            <a href={`/api/files/${shown.id}?inline=1`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-ivory-200"><Eye className="size-4" aria-hidden /> Open file</a>
            <a href={`/api/files/${shown.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-ivory-200"><Download className="size-4" aria-hidden /> Download</a>
            {shown.reviewStatus === "pending_review" && <ActionButton action={startDocReviewAction} fields={{ versionId: shown.id }} variant="secondary">Start review</ActionButton>}
          </div>
        </CardHeader>
        <CardBody>
          {shown.extractedText ? (
            <AnchorCommentPanel text={shown.extractedText} anchors={vComments.filter((c) => c.a).map((c) => ({ id: c.c.id, start: c.a!.startOffset ?? -1, end: c.a!.endOffset ?? -1, resolved: c.c.status === "resolved" }))} action={docCommentAction} hidden={{ versionId: shown.id }} />
          ) : (
            <ActionForm action={docCommentAction} className="space-y-3">
              <input type="hidden" name="versionId" value={shown.id} />
              <p className="text-sm text-muted">No text could be extracted from this file (e.g. an image or scanned PDF). Open the file and leave a general comment.</p>
              <Textarea name="body" aria-label="Comment" required />
              <SubmitButton variant="secondary">Add general comment</SubmitButton>
            </ActionForm>
          )}
        </CardBody>
      </Card>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Comments on v{shown.versionNumber}</CardTitle></CardHeader>
          <CardBody>
            {vComments.length === 0 ? <p className="text-sm text-muted">No comments yet.</p> : (
              <ul className="space-y-3">
                {vComments.map((c) => (
                  <li key={c.c.id} className="rounded-xl border border-line p-3">
                    {c.a && <blockquote className="mb-2 border-l-4 border-gold-500 pl-3 text-sm italic text-muted">“{c.a.selectedText}”</blockquote>}
                    <p className="text-sm">{c.c.body}</p>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                      <span>{c.author.firstName} {c.author.lastName} · {formatDateTime(c.c.createdAt)}</span>
                      <ActionButton action={reviewerCommentStatusAction} fields={{ commentId: c.c.id, status: c.c.status === "resolved" ? "outstanding" : "resolved" }} size="sm" variant="ghost">{c.c.status === "resolved" ? "Mark outstanding" : "Mark resolved"}</ActionButton>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Decision for v{shown.versionNumber}</CardTitle></CardHeader>
            <CardBody>
              <ActionForm action={docDecisionAction} className="space-y-3">
                <input type="hidden" name="versionId" value={shown.id} />
                <div className="space-y-1.5"><Label htmlFor="decision">Decision</Label><Select id="decision" name="decision" defaultValue="approved"><option value="approved">Approve</option><option value="needs_revision">Return for revision</option><option value="rejected">Reject</option></Select></div>
                <div className="space-y-1.5"><Label htmlFor="summary">Summary for the applicant</Label><Textarea id="summary" name="summary" placeholder="What's working, and the most important change to make." /></div>
                <SubmitButton>Record decision & notify applicant</SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>
          {reviews.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Review history</CardTitle></CardHeader>
              <CardBody><ul className="space-y-2 text-sm">{reviews.map((r) => <li key={r.r.id}><ReviewStatusBadge status={r.r.decision} /> v{versions.find((x) => x.id === r.r.documentVersionId)?.versionNumber} by {r.reviewer.firstName} · {formatDateTime(r.r.createdAt)}</li>)}</ul></CardBody>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
