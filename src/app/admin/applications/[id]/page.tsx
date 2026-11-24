import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { adminTransitionAction, assignReviewerAction } from "@/app/actions/admin";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms/action-form";
import { AppStatusBadge, ReviewStatusBadge } from "@/components/status";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/form";
import { PageHeader, Progress } from "@/components/ui/misc";
import { requirePermissionPage } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { reviewerAssignments, users } from "@/lib/db/schema";
import { allowedTransitions, OUTCOME_LABELS, STATUS_LABELS } from "@/lib/engine/state-machine";
import { listReviewers } from "@/lib/services/admin";
import { applicationDetail } from "@/lib/services/applications";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Application" };
export const dynamic = "force-dynamic";

export default async function AdminApplication({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermissionPage("applicants.view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const d = await applicationDetail(id).catch(() => null);
  if (!d) notFound();
  const [applicant] = await db.select().from(users).where(eq(users.id, d.app.userId)).limit(1);
  const assigned = await db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, since: reviewerAssignments.createdAt }).from(reviewerAssignments).innerJoin(users, eq(users.id, reviewerAssignments.reviewerId)).where(and(eq(reviewerAssignments.applicationId, id), eq(reviewerAssignments.isActive, true)));
  const reviewers = await listReviewers();
  const next = allowedTransitions(d.app.status, "admin");
  const canManage = user.permissions.has("applications.manage");
  return (
    <>
      <PageHeader back={{ href: "/admin/applications", label: "Applications" }} title={`${applicant.firstName} ${applicant.lastName}`} description={d.sch.name} actions={<AppStatusBadge status={d.app.status} outcome={d.app.outcome} />} />
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Progress & checklist</CardTitle><Link href={`/reviewer/applications/${id}`} className="text-sm font-semibold text-royal-700">Reviewer view</Link></CardHeader>
            <CardBody>
              <div className="flex items-center gap-3"><Progress value={d.app.progress} label="Progress" /><span className="font-semibold">{d.app.progress}%</span></div>
              <ul className="mt-4 space-y-2 text-sm">{d.checklist.documents.map((c) => <li key={c.requirementId} className="flex flex-wrap items-center justify-between gap-2"><span>{c.ready ? "✓" : "○"} {c.name}</span>{c.reviewStatus ? <ReviewStatusBadge status={c.reviewStatus} /> : <span className="text-xs text-muted">{c.isRequired ? "missing" : "optional"}</span>}</li>)}</ul>
              {d.checklist.incompleteMilestones.length > 0 && <p className="mt-3 text-xs text-muted">Incomplete required tasks: {d.checklist.incompleteMilestones.join(", ")}</p>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader><CardTitle>Status history</CardTitle></CardHeader>
            <CardBody><ol className="space-y-3 border-l-2 border-line pl-4 text-sm">{d.transitions.map((t) => <li key={t.id}><p className="font-medium">{t.fromStatus ? `${STATUS_LABELS[t.fromStatus]} → ` : ""}{STATUS_LABELS[t.toStatus]}</p><p className="text-xs text-muted">{formatDateTime(t.createdAt)}{t.reason ? ` · ${t.reason}` : ""}</p></li>)}</ol></CardBody>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Reviewers</CardTitle></CardHeader>
            <CardBody className="space-y-4">
              <ul className="space-y-2 text-sm">{assigned.map((r) => <li key={r.id} className="flex items-center justify-between gap-2"><span>{r.firstName} {r.lastName} <span className="text-xs text-muted">since {formatDateTime(r.since)}</span></span>{user.permissions.has("reviewers.assign") && <ActionButton action={assignReviewerAction} fields={{ applicationId: id, reviewerId: r.id, op: "remove" }} size="sm" variant="ghost">Remove</ActionButton>}</li>)}{assigned.length === 0 && <li className="text-muted">No reviewer assigned.</li>}</ul>
              {user.permissions.has("reviewers.assign") && (
                <ActionForm action={assignReviewerAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="applicationId" value={id} />
                  <div className="min-w-48 flex-1 space-y-1"><Label htmlFor="reviewerId">Assign reviewer</Label><Select id="reviewerId" name="reviewerId">{reviewers.filter((r) => r.id !== applicant.id).map((r) => <option key={r.id} value={r.id}>{r.firstName} {r.lastName} ({r.active} active)</option>)}</Select></div>
                  <SubmitButton>Assign</SubmitButton>
                </ActionForm>
              )}
            </CardBody>
          </Card>
          {canManage && next.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Change status</CardTitle></CardHeader>
              <CardBody>
                <ActionForm action={adminTransitionAction} className="space-y-3">
                  <input type="hidden" name="applicationId" value={id} />
                  <div className="space-y-1"><Label htmlFor="to">Move to</Label><Select id="to" name="to">{next.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</Select></div>
                  {next.includes("outcome") && <div className="space-y-1"><Label htmlFor="outcome">Outcome (when recording an outcome)</Label><Select id="outcome" name="outcome" defaultValue=""><option value="">—</option>{Object.entries(OUTCOME_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></div>}
                  {next.includes("outcome") && <div className="space-y-1"><Label htmlFor="outcomeNotes">Outcome notes</Label><Input id="outcomeNotes" name="outcomeNotes" /></div>}
                  <div className="space-y-1"><Label htmlFor="reason">Reason (required for screening overrides; recorded in the audit log)</Label><Textarea id="reason" name="reason" className="min-h-16" /></div>
                  <SubmitButton>Update status</SubmitButton>
                </ActionForm>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
