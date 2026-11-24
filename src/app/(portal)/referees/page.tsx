import type { Metadata } from "next";
import Link from "next/link";
import { UserRoundCheck } from "lucide-react";
import { cancelRefereeAction, createRefereeAction, resendRefereeAction } from "@/app/actions/workspace";
import { ActionButton, ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { RefereeStatusBadge } from "@/components/status";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/form";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { listApplicationsForUser } from "@/lib/services/applications";
import { refereesForUser } from "@/lib/services/referees";
import { getSettings } from "@/lib/services/settings";
import { formatDate, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Referees" };
export const dynamic = "force-dynamic";

export default async function RefereesPage({ searchParams }: { searchParams: Promise<{ application?: string }> }) {
  const user = await requireUser();
  const { application } = await searchParams;
  const [requests, apps, settings] = await Promise.all([refereesForUser(user.id), listApplicationsForUser(user.id), getSettings()]);
  const open = apps.filter((a) => ["eligible", "in_progress", "screening", "draft"].includes(a.app.status));
  const minDate = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  return (
    <>
      <PageHeader title="Referees" description={`Ask referees for a letter. They get a secure link — no account needed — valid for ${settings.referee_link_days} days and usable once. They can't see anything else in your account.`} />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <Card className="lg:self-start">
          <CardHeader><CardTitle>Request a reference letter</CardTitle></CardHeader>
          <CardBody>
            {open.length === 0 ? (
              <p className="text-sm text-muted">Start an application first — reference requests are linked to a specific application. <Link href="/scholarships" className="font-semibold text-royal-700">Find a scholarship</Link></p>
            ) : (
              <ActionForm action={createRefereeAction} className="space-y-4" resetOnSuccess>
                <div className="space-y-1.5"><Label htmlFor="applicationId">Application</Label><Select id="applicationId" name="applicationId" defaultValue={application ?? open[0].app.id}>{open.map((a) => <option key={a.app.id} value={a.app.id}>{a.sch.name}</option>)}</Select></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label htmlFor="refereeName">Referee&apos;s full name</Label><Input id="refereeName" name="refereeName" /><FieldError name="refereeName" /></div>
                  <div className="space-y-1.5"><Label htmlFor="refereeEmail">Referee&apos;s email</Label><Input id="refereeEmail" name="refereeEmail" type="email" /><FieldError name="refereeEmail" /></div>
                  <div className="space-y-1.5"><Label htmlFor="relationship">Relationship to you</Label><Input id="relationship" name="relationship" placeholder="e.g. Mathematics teacher" /><FieldError name="relationship" /></div>
                  <div className="space-y-1.5"><Label htmlFor="organization">Institution / organisation</Label><Input id="organization" name="organization" /></div>
                </div>
                <div className="space-y-1.5"><Label htmlFor="deadline">Please submit by</Label><Input id="deadline" name="deadline" type="date" min={minDate} /><FieldError name="deadline" /></div>
                <div className="space-y-1.5"><Label htmlFor="message">Personal message (optional)</Label><Textarea id="message" name="message" placeholder="Thank them and share what you'd like them to highlight." /></div>
                <SubmitButton pendingLabel="Sending…">Send secure request</SubmitButton>
              </ActionForm>
            )}
          </CardBody>
        </Card>
        <div>
          {requests.length === 0 ? (
            <EmptyState icon={UserRoundCheck} title="No requests yet" description="Ask early — referees are busy. Four weeks before the deadline is a good rule." />
          ) : (
            <ul className="space-y-3">
              {requests.map(({ r, scholarshipName }) => (
                <li key={r.id} className="rounded-[var(--radius-card)] border border-line bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div><p className="font-semibold">{r.refereeName}</p><p className="text-sm text-muted">{r.relationship}{r.organization ? `, ${r.organization}` : ""} · {r.refereeEmail}</p></div>
                    <RefereeStatusBadge status={r.status} />
                  </div>
                  <dl className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-3">
                    <div><dt>For</dt><dd className="font-medium text-navy-900">{scholarshipName}</dd></div>
                    <div><dt>Requested by</dt><dd className="font-medium text-navy-900">{formatDate(r.deadline)}</dd></div>
                    <div><dt>{r.status === "submitted" ? "Submitted" : "Link expires"}</dt><dd className="font-medium text-navy-900">{r.status === "submitted" ? formatDateTime(r.submittedAt) : formatDateTime(r.tokenExpiresAt)}</dd></div>
                  </dl>
                  {r.openedAt && r.status !== "submitted" && <p className="mt-2 text-xs text-muted">Opened {formatDateTime(r.openedAt)}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.status === "submitted" && r.documentId && <Link href={`/documents/${r.documentId}`} className="text-sm font-semibold text-royal-700 hover:underline">View letter</Link>}
                    {["sent", "opened", "expired"].includes(r.status) && <ActionButton action={resendRefereeAction} fields={{ requestId: r.id }} size="sm" variant="secondary">Send a fresh link</ActionButton>}
                    {["sent", "opened"].includes(r.status) && <ActionButton action={cancelRefereeAction} fields={{ requestId: r.id }} size="sm" variant="ghost" className="text-danger-700" confirm="Revoke this link? The referee will no longer be able to upload.">Revoke link</ActionButton>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
