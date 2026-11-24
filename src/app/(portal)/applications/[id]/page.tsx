import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { Check, CheckCircle2, Circle, FileWarning } from "lucide-react";
import { attachDocumentAction, transitionAction, withdrawApplicationAction } from "@/app/actions/portal";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms/action-form";
import { AppStatusBadge, EssayStatusBadge, RefereeStatusBadge, ReviewStatusBadge, VerdictBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/form";
import { Alert, Progress } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { documents, eligibilityAssessments, essays, reviewerAssignments, users } from "@/lib/db/schema";
import { allowedTransitions, OUTCOME_LABELS, PIPELINE, STATUS_LABELS } from "@/lib/engine/state-machine";
import { applicationDetail } from "@/lib/services/applications";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Application" };
export const dynamic = "force-dynamic";

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const d = await applicationDetail(id).catch(() => null);
  if (!d || d.app.userId !== user.id || d.app.deletedAt) notFound();
  const { app, sch, checklist, transitions, referees } = d;
  const [assessment] = app.assessmentId ? await db.select().from(eligibilityAssessments).where(eq(eligibilityAssessments.id, app.assessmentId)).limit(1) : [];
  const appEssays = await db.select().from(essays).where(and(eq(essays.applicationId, id), isNull(essays.deletedAt)));
  const myDocs = await db.select().from(documents).where(and(eq(documents.userId, user.id), isNull(documents.deletedAt)));
  const reviewers = await db.select({ firstName: users.firstName, lastName: users.lastName }).from(reviewerAssignments).innerJoin(users, eq(users.id, reviewerAssignments.reviewerId)).where(and(eq(reviewerAssignments.applicationId, id), eq(reviewerAssignments.isActive, true)));
  const allowed = allowedTransitions(app.status, "applicant");
  const pipeIdx = PIPELINE.indexOf(app.status === "ineligible" ? "screening" : app.status);
  const locked = ["submitted", "shortlisted", "outcome"].includes(app.status);
  const readyToSubmit = checklist.missingDocuments.length === 0 && checklist.incompleteMilestones.length === 0;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/applications" className="text-sm font-medium text-royal-700 hover:underline">← My applications</Link>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-3xl">{sch.name}</h1>
            <p className="mt-1 text-muted">{sch.partnerUniversity} · Deadline {formatDateTime(sch.deadline, sch.timezone)}</p>
          </div>
          <AppStatusBadge status={app.status} outcome={app.outcome} />
        </div>
      </div>

      {sch.isDemo && <Alert tone="warning">This application is linked to a demonstration scholarship record.</Alert>}

      <Card>
        <CardBody>
          <ol className="flex flex-wrap gap-y-3" aria-label="Application stages">
            {PIPELINE.map((s, i) => (
              <li key={s} className="flex items-center">
                <span className={cn("flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold", i < pipeIdx ? "bg-success-100 text-success-700" : i === pipeIdx ? "bg-navy-900 text-ivory" : "bg-ivory-200 text-muted")} aria-current={i === pipeIdx ? "step" : undefined}>
                  {i < pipeIdx ? <Check className="size-3.5" aria-hidden /> : <Circle className="size-3" aria-hidden />}
                  {app.status === "ineligible" && s === "screening" ? "Ineligible" : STATUS_LABELS[s]}
                </span>
                {i < PIPELINE.length - 1 && <span className="mx-1 h-px w-4 bg-line" aria-hidden />}
              </li>
            ))}
          </ol>
          <div className="mt-5 flex items-center gap-3"><Progress value={app.progress} label="Application progress" /><span className="font-semibold">{app.progress}%</span></div>
          {app.status === "outcome" && app.outcome && <p className="mt-4 text-sm">Outcome recorded: <strong>{OUTCOME_LABELS[app.outcome]}</strong> on {formatDate(app.outcomeAt)}{app.outcomeNotes ? ` — ${app.outcomeNotes}` : ""}</p>}
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          {/* Next action */}
          <Card>
            <CardHeader><CardTitle>Next step</CardTitle></CardHeader>
            <CardBody className="space-y-4">
              {app.status === "screening" && (
                <Alert tone="info">Your eligibility is being assessed. <Link href={`/eligibility/${sch.id}`} className="font-semibold">Complete your eligibility check</Link> to continue.</Alert>
              )}
              {app.status === "ineligible" && (
                <Alert tone="warning" title="Your latest assessment shows a requirement isn't met">
                  If your information was wrong or has changed, <Link href="/profile">update your profile</Link> — your eligibility is recalculated automatically. <Link href={`/eligibility/${sch.id}`}>See why</Link>.
                </Alert>
              )}
              {allowed.includes("in_progress") && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm">You&apos;re likely eligible. Start working through your plan and checklist.</p>
                  <ActionButton action={transitionAction} fields={{ applicationId: app.id, to: "in_progress" }}>Start preparing</ActionButton>
                </div>
              )}
              {app.status === "in_progress" && (
                <div className="space-y-3">
                  {!readyToSubmit && (
                    <Alert tone="warning" title="Before you can mark this as submitted">
                      <ul className="list-disc pl-5">
                        {checklist.missingDocuments.map((m) => <li key={m}>Document: {m}</li>)}
                        {checklist.incompleteMilestones.map((m) => <li key={m}>Task: {m}</li>)}
                      </ul>
                    </Alert>
                  )}
                  <details className="rounded-xl border border-line p-4" open={readyToSubmit}>
                    <summary className="cursor-pointer font-semibold">I&apos;ve submitted on the official portal</summary>
                    <ActionForm action={transitionAction} className="mt-4 space-y-3">
                      <input type="hidden" name="applicationId" value={app.id} />
                      <input type="hidden" name="to" value="submitted" />
                      <div className="space-y-1.5">
                        <Label htmlFor="submissionReference">Confirmation or reference number (optional)</Label>
                        <Input id="submissionReference" name="submissionReference" />
                      </div>
                      <p className="text-xs text-muted">SOAR Hub doesn&apos;t submit for you. Only mark this once you have submitted on {sch.applicationUrl ? <a className="underline" href={sch.applicationUrl} target="_blank" rel="noopener noreferrer">the official portal</a> : "the official portal"}.</p>
                      <SubmitButton disabled={!readyToSubmit}>Mark application as submitted</SubmitButton>
                    </ActionForm>
                  </details>
                </div>
              )}
              {(allowed.includes("shortlisted") || allowed.includes("outcome")) && (
                <div className="space-y-4">
                  <p className="text-sm">Submitted {formatDate(app.submittedAt)}{app.submissionReference ? ` · ref ${app.submissionReference}` : ""}. Heard back? Record it here.</p>
                  <div className="flex flex-wrap gap-3">
                    {allowed.includes("shortlisted") && <ActionButton action={transitionAction} fields={{ applicationId: app.id, to: "shortlisted" }} variant="secondary">I&apos;ve been shortlisted</ActionButton>}
                  </div>
                  <ActionForm action={transitionAction} className="grid gap-3 rounded-xl border border-line p-4 sm:grid-cols-[1fr_auto] sm:items-end">
                    <input type="hidden" name="applicationId" value={app.id} />
                    <input type="hidden" name="to" value="outcome" />
                    <div className="space-y-1.5">
                      <Label htmlFor="outcome">Outcome</Label>
                      <Select id="outcome" name="outcome" defaultValue="">
                        <option value="" disabled>Choose…</option>
                        {Object.entries(OUTCOME_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </Select>
                    </div>
                    <SubmitButton variant="secondary">Record outcome</SubmitButton>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="outcomeNotes">Notes (optional)</Label>
                      <Textarea id="outcomeNotes" name="outcomeNotes" className="min-h-16" />
                    </div>
                  </ActionForm>
                </div>
              )}
              {app.status === "outcome" && <p className="text-sm text-muted">This application is complete. Whatever the result, the preparation you did carries forward to your next opportunity.</p>}
            </CardBody>
          </Card>

          {/* Checklist */}
          <Card>
            <CardHeader>
              <CardTitle>Required document checklist</CardTitle>
              <Link href={`/documents?application=${app.id}`} className="text-sm font-semibold text-royal-700 hover:underline">Documents workspace</Link>
            </CardHeader>
            <CardBody>
              {(["admission", "scholarship"] as const).map((section) => {
                const items = checklist.documents.filter((c) => c.section === section);
                if (!items.length) return null;
                return (
              <div key={section} className="mb-5 last:mb-0">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{section === "admission" ? "Admission application" : "Scholarship application"} · {items.filter((c) => c.ready).length}/{items.length} ready</h3>
              <ul className="space-y-3">
                {items.map((c) => (
                  <li key={c.requirementId} className="rounded-xl border border-line p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="flex items-center gap-2 font-medium">
                        {c.ready ? <CheckCircle2 className="size-5 text-success-700" aria-hidden /> : <FileWarning className="size-5 text-warning-700" aria-hidden />}
                        {c.name} {!c.isRequired && <span className="text-xs font-normal text-muted">(optional)</span>}
                      </p>
                      {c.reviewStatus ? <ReviewStatusBadge status={c.reviewStatus} /> : <span className="text-xs text-muted">{c.problem}</span>}
                    </div>
                    {!locked && (
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        {c.documentId ? (
                          <Link href={`/documents/${c.documentId}`} className="text-sm font-semibold text-royal-700 hover:underline">View / upload new version</Link>
                        ) : c.category === "recommendation_letter" ? (
                          <>
                            <Link href={`/referees?application=${app.id}`} className="text-sm font-semibold text-royal-700 hover:underline">Request from a referee</Link>
                            <Link href={`/documents?application=${app.id}&requirement=${c.requirementId}&category=${c.category}`} className="text-sm font-semibold text-royal-700 hover:underline">Upload a letter I already have</Link>
                          </>
                        ) : (
                          <Link href={`/documents?application=${app.id}&requirement=${c.requirementId}&category=${c.category}`} className="text-sm font-semibold text-royal-700 hover:underline">Upload</Link>
                        )}
                        {!c.documentId && myDocs.some((dd) => dd.category === c.category && dd.applicationId !== app.id) && (
                          <ActionForm action={attachDocumentAction} className="flex flex-wrap items-center gap-2" showSuccess={false}>
                            <input type="hidden" name="applicationId" value={app.id} />
                            <input type="hidden" name="requirementId" value={c.requirementId} />
                            <Select name="documentId" aria-label={`Attach an existing document for ${c.name}`} className="h-9 w-auto text-sm">
                              {myDocs.filter((dd) => dd.category === c.category).map((dd) => <option key={dd.id} value={dd.id}>{dd.title}</option>)}
                            </Select>
                            <SubmitButton size="sm" variant="secondary">Attach existing</SubmitButton>
                          </ActionForm>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              </div>
                );
              })}
              <p className="mt-4 rounded-lg bg-royal-50 p-3 text-sm text-royal-700">Visit the official page for full and up-to-date information on the application documents{sch.applicationUrl ? <>: <a href={sch.applicationUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline">official application</a></> : "."}</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Essays</CardTitle>
              <Link href={`/essays/new?application=${app.id}`} className="text-sm font-semibold text-royal-700 hover:underline">New essay</Link>
            </CardHeader>
            <CardBody>
              {appEssays.length === 0 ? <p className="text-sm text-muted">No essays linked yet. Create one to get reviewer and AI-assisted feedback.</p> : (
                <ul className="space-y-2">
                  {appEssays.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <Link href={`/essays/${e.id}`} className="font-medium hover:underline">{e.title}</Link>
                      <EssayStatusBadge status={e.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Eligibility</CardTitle></CardHeader>
            <CardBody className="space-y-2">
              <VerdictBadge verdict={assessment?.overallVerdict} />
              <p className="text-xs text-muted">{assessment ? `Assessed ${formatDateTime(assessment.createdAt)}` : "Not yet assessed"}</p>
              <Link href={`/eligibility/${sch.id}`} className="text-sm font-semibold text-royal-700 hover:underline">View explanation</Link>
            </CardBody>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Plan</CardTitle>
              <Link href={`/planner?application=${app.id}`} className="text-sm font-semibold text-royal-700 hover:underline">Open planner</Link>
            </CardHeader>
            <CardBody className="text-sm">
              {checklist.incompleteMilestones.length ? <p>{checklist.incompleteMilestones.length} required task(s) remaining.</p> : <p>All required tasks are complete.</p>}
              {app.scheduleCompressed && <p className="mt-2 font-medium text-warning-700">Your schedule is compressed — see the planner for a priority plan.</p>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Referees</CardTitle>
              <Link href={`/referees?application=${app.id}`} className="text-sm font-semibold text-royal-700 hover:underline">Request</Link>
            </CardHeader>
            <CardBody>
              {referees.length === 0 ? <p className="text-sm text-muted">No reference requests yet.</p> : (
                <ul className="space-y-2 text-sm">{referees.map((r) => <li key={r.id} className="flex items-center justify-between gap-2"><span>{r.refereeName}</span><RefereeStatusBadge status={r.status} /></li>)}</ul>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader><CardTitle>Your support team</CardTitle></CardHeader>
            <CardBody className="text-sm">
              {reviewers.length ? reviewers.map((r) => <p key={r.firstName + r.lastName}>{r.firstName} {r.lastName} <span className="text-muted">· Reviewer</span></p>) : <p className="text-muted">A reviewer will be assigned to support you.</p>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader><CardTitle>History</CardTitle></CardHeader>
            <CardBody>
              <ol className="space-y-3 border-l-2 border-line pl-4 text-sm">
                {transitions.map((t) => (
                  <li key={t.id}>
                    <p className="font-medium">{t.fromStatus ? `${STATUS_LABELS[t.fromStatus]} → ` : ""}{STATUS_LABELS[t.toStatus]}</p>
                    <p className="text-xs text-muted">{formatDateTime(t.createdAt)}{t.reason ? ` · ${t.reason}` : ""}</p>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
          {!locked && (
            <ActionButton action={withdrawApplicationAction} fields={{ applicationId: app.id }} variant="ghost" className="text-danger-700" confirm="Withdraw this application? Open referee links will be cancelled. This can't be undone.">Withdraw application</ActionButton>
          )}
          {locked && <Button asChild variant="secondary" className="w-full"><Link href={`/scholarships/${sch.slug}`}>View scholarship</Link></Button>}
        </div>
      </div>
    </div>
  );
}
