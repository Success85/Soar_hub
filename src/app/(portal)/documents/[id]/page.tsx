import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Eye, ShieldCheck, ShieldQuestion } from "lucide-react";
import { commentStatusAction, deleteDocumentAction, renameDocumentAction, requestReviewAction } from "@/app/actions/workspace";
import { AnchoredText } from "@/components/anchored-text";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms/action-form";
import { ReviewStatusBadge } from "@/components/status";
import { UploadForm } from "@/components/upload-form";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { Alert, Badge, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { DOCUMENT_CATEGORIES } from "@/lib/engine/fields";
import { documentAccess, documentDetail, uploadLimits } from "@/lib/services/documents";
import { fileSize, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Document" };
export const dynamic = "force-dynamic";

export default async function DocumentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const access = await documentAccess(user, id).catch(() => null);
  if (!access || access.access !== "owner") notFound();
  const { doc, versions, comments, reviews, app } = await documentDetail(id);
  const { v } = await searchParams;
  const shown = versions.find((x) => String(x.versionNumber) === v) ?? versions[0];
  const shownComments = comments.filter((c) => c.c.documentVersionId === shown?.id);
  const anchors = shownComments.filter((c) => c.a).map((c, i) => ({ id: c.c.id, start: c.a!.startOffset ?? -1, end: c.a!.endOffset ?? -1, resolved: c.c.status === "resolved", label: i + 1 }));
  const limits = await uploadLimits();
  const canEdit = doc.reviewStatus !== "under_review";

  return (
    <>
      <PageHeader back={{ href: "/documents", label: "Documents" }} title={doc.title} description={`${DOCUMENT_CATEGORIES.find((c) => c.value === doc.category)?.label} · ${app ? `Linked to ${app.scholarshipName}` : "In your library"}`} actions={<ReviewStatusBadge status={doc.reviewStatus} />} />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          {shown && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Version {shown.versionNumber}{shown.versionNumber === doc.currentVersion && " (current)"}</CardTitle>
                  <p className="mt-1 text-sm text-muted">{shown.originalFilename} · {fileSize(shown.sizeBytes)} · uploaded {formatDateTime(shown.createdAt)}{shown.uploadedVia === "referee" ? " by your referee" : ""}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a href={`/api/files/${shown.id}?inline=1`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-ivory-200"><Eye className="size-4" aria-hidden /> View</a>
                  <a href={`/api/files/${shown.id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-navy-900 px-3 py-2 text-sm font-semibold text-ivory hover:bg-navy-800"><Download className="size-4" aria-hidden /> Download</a>
                </div>
              </CardHeader>
              <CardBody className="space-y-4">
                <div className="flex flex-wrap gap-2 text-xs">
                  <ReviewStatusBadge status={shown.reviewStatus} />
                  {shown.scanStatus === "clean" ? <Badge tone="success"><ShieldCheck className="size-3" aria-hidden /> Security scan passed</Badge> : <Badge><ShieldQuestion className="size-3" aria-hidden /> {shown.scanStatus === "not_scanned" ? "Not scanned (scanner not configured)" : `Scan: ${shown.scanStatus}`}</Badge>}
                </div>
                {shown.extractedText ? (
                  <details open={anchors.length > 0}>
                    <summary className="cursor-pointer text-sm font-semibold">Document text {anchors.length > 0 && `with ${anchors.length} highlighted comment${anchors.length === 1 ? "" : "s"}`}</summary>
                    <div className="mt-3 max-h-[480px] overflow-y-auto rounded-xl border border-line bg-ivory/50 p-4"><AnchoredText text={shown.extractedText} anchors={anchors} /></div>
                  </details>
                ) : (
                  <p className="text-sm text-muted">Text preview isn&apos;t available for this file type; reviewers leave general comments instead.</p>
                )}
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Reviewer feedback on version {shown?.versionNumber}</CardTitle></CardHeader>
            <CardBody>
              {shownComments.length === 0 && reviews.filter((r) => r.r.documentVersionId === shown?.id).length === 0 ? (
                <p className="text-sm text-muted">No feedback on this version yet.{doc.reviewStatus === "uploaded" && " Request a review when you're ready."}</p>
              ) : (
                <ul className="space-y-3">
                  {reviews.filter((r) => r.r.documentVersionId === shown?.id).map((r) => (
                    <li key={r.r.id} className="rounded-xl border border-line bg-ivory/50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">Review decision by {r.reviewer.firstName} {r.reviewer.lastName}</p><ReviewStatusBadge status={r.r.decision} /></div>
                      {r.r.summary && <p className="mt-2 text-sm">{r.r.summary}</p>}
                      <p className="mt-1 text-xs text-muted">{formatDateTime(r.r.createdAt)}</p>
                    </li>
                  ))}
                  {shownComments.map((c) => {
                    const label = anchors.findIndex((a) => a.id === c.c.id);
                    return (
                      <li key={c.c.id} className="rounded-xl border border-line p-4">
                        {c.a && <blockquote className="mb-2 border-l-4 border-gold-500 pl-3 text-sm italic text-muted">{label >= 0 && <span className="not-italic font-semibold text-gold-700">[{label + 1}] </span>}“{c.a.selectedText}”</blockquote>}
                        <p className="text-sm">{c.c.body}</p>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                          <span>{c.author.firstName} {c.author.lastName} · {formatDateTime(c.c.createdAt)}</span>
                          <span className="flex items-center gap-2">
                            <Badge tone={c.c.status === "resolved" ? "success" : "warning"}>{c.c.status === "resolved" ? "Resolved" : "Outstanding"}</Badge>
                            <ActionButton action={commentStatusAction} fields={{ commentId: c.c.id, status: c.c.status === "resolved" ? "outstanding" : "resolved" }} size="sm" variant="ghost">{c.c.status === "resolved" ? "Reopen" : "Mark resolved"}</ActionButton>
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {comments.length > shownComments.length && <p className="mt-3 text-xs text-muted">Feedback on other versions stays attached to those versions — switch version to see it.</p>}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Versions</CardTitle></CardHeader>
            <CardBody>
              <ol className="space-y-2">
                {versions.map((ver) => (
                  <li key={ver.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                    <Link href={`/documents/${doc.id}?v=${ver.versionNumber}`} className={ver.id === shown?.id ? "font-bold" : "font-medium hover:underline"}>v{ver.versionNumber}{ver.versionNumber === doc.currentVersion ? " · current" : ""}</Link>
                    <span className="flex items-center gap-2 text-xs text-muted">{formatDateTime(ver.createdAt)} <ReviewStatusBadge status={ver.reviewStatus} /></span>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
          {canEdit && (
            <Card>
              <CardHeader><CardTitle>Upload a new version</CardTitle></CardHeader>
              <CardBody><UploadForm allowed={limits.allowed} maxMb={limits.maxMb} documentId={doc.id} category={doc.category} /></CardBody>
            </Card>
          )}
          <Card>
            <CardHeader><CardTitle>Manage</CardTitle></CardHeader>
            <CardBody className="space-y-4">
              {["uploaded", "needs_revision", "rejected", "approved"].includes(doc.reviewStatus) && (
                <div>
                  <ActionButton action={requestReviewAction} fields={{ documentId: doc.id }} className="w-full">Request review of v{doc.currentVersion}</ActionButton>
                  {!doc.applicationId && <p className="mt-2 text-xs text-muted">Attach this document to an application first so a reviewer can be assigned.</p>}
                </div>
              )}
              {doc.reviewStatus === "pending_review" && <Alert tone="info">Waiting for a reviewer.</Alert>}
              {doc.reviewStatus === "under_review" && <Alert tone="info">A reviewer is reviewing this document now.</Alert>}
              <ActionForm action={renameDocumentAction} className="flex gap-2" showSuccess={false}>
                <input type="hidden" name="documentId" value={doc.id} />
                <Input name="title" defaultValue={doc.title} aria-label="Document name" />
                <SubmitButton variant="secondary">Rename</SubmitButton>
              </ActionForm>
              <ActionButton action={deleteDocumentAction} fields={{ documentId: doc.id }} variant="ghost" className="text-danger-700" confirm="Remove this document from your workspace? Version history is retained for audit purposes.">Delete document</ActionButton>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
