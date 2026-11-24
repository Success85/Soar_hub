import Link from "next/link";
import { notFound } from "next/navigation";
import { AppStatusBadge, MilestoneBadge, NotificationStatusBadge, RefereeStatusBadge, ReviewStatusBadge, VerdictBadge } from "@/components/status";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, PageHeader } from "@/components/ui/misc";
import { redactProfile } from "@/lib/auth/permissions";
import { requirePermissionPage } from "@/lib/auth/session";
import { EDUCATION_LEVELS, optionLabel } from "@/lib/engine/fields";
import { dayInTimezone, effectiveStatus } from "@/lib/engine/scheduler";
import { applicantDetail } from "@/lib/services/admin";
import { audit } from "@/lib/services/audit";
import { profileCompletion } from "@/lib/services/profile";
import { formatDate, formatDateTime } from "@/lib/utils";

export const metadata = { title: "Applicant" };
export const dynamic = "force-dynamic";

export default async function ApplicantDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermissionPage("applicants.view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const d = await applicantDetail(id).catch(() => null);
  if (!d) notFound();
  const canSensitive = user.permissions.has("applicants.view_sensitive");
  await audit({ eventType: "applicant.viewed", actorId: user.id, actorRole: "admin", targetType: "user", targetId: id, metadata: { sensitive: canSensitive } });
  const p = d.profile ? redactProfile(d.profile as unknown as Record<string, unknown>, canSensitive) : null;
  const completion = profileCompletion(d.profile, true);
  const today = dayInTimezone(new Date(), "Africa/Lagos");
  const row = (k: string, v: unknown) => <div className="grid grid-cols-[150px_1fr] gap-2 py-1.5 text-sm"><dt className="text-muted">{k}</dt><dd className="font-medium">{v === null || v === undefined || v === "" ? "—" : String(v)}</dd></div>;
  return (
    <>
      <PageHeader back={{ href: "/admin/applicants", label: "Applicants" }} title={`${d.user.firstName} ${d.user.lastName}`} description={`${d.user.email} · registered ${formatDate(d.user.createdAt)} · last login ${formatDateTime(d.user.lastLoginAt)}`} actions={<>{d.user.emailVerifiedAt ? <Badge tone="success">Verified</Badge> : <Badge tone="warning">Unverified</Badge>}<Badge>{d.user.status}</Badge>{d.user.isDemo && <Badge>Demo</Badge>}</>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Profile · {completion.percent}% complete</CardTitle>{!canSensitive && <Badge tone="info">Sensitive fields restricted</Badge>}</CardHeader>
            <CardBody>
              <dl className="divide-y divide-line">
                {row("Date of birth", p?.dateOfBirth)}
                {row("Gender", p?.gender)}
                {row("Phone", p?.phone)}
                {row("Citizenship", p?.countryOfCitizenship)}
                {row("Residence", p?.countryOfResidence)}
                {row("State of origin", p?.stateOfOrigin)}
                {row("Education", EDUCATION_LEVELS.find((e) => e.value === p?.educationLevel)?.label)}
                {row("School", p?.currentSchool)}
                {row("Graduation year", p?.graduationYear)}
                {row("Qualifications", Array.isArray(p?.qualifications) ? (p?.qualifications as string[]).join(", ") : null)}
                {row("Credit passes", p?.creditPasses)}
                {row("First generation", p?.firstGeneration === null || p?.firstGeneration === undefined ? null : optionLabel("first_generation", p?.firstGeneration))}
                {row("Income band", p?.householdIncomeBand)}
                {row("Financial need", p?.demonstratesFinancialNeed)}
                {row("Disability", p?.hasDisability)}
                {row("Refugee/displaced", p?.isRefugeeOrDisplaced)}
                {row("Programme", p?.preferredProgramme)}
              </dl>
            </CardBody>
          </Card>
          <Card>
            <CardHeader><CardTitle>Eligibility assessments</CardTitle></CardHeader>
            <CardBody><ul className="space-y-2 text-sm">{d.assessments.map(({ e, name }) => <li key={e.id} className="flex flex-wrap items-center justify-between gap-2"><span>{name}<span className="block text-xs text-muted">{formatDateTime(e.createdAt)} · {e.trigger}{e.isCurrent ? " · current" : ""}</span></span><VerdictBadge verdict={e.overallVerdict} short /></li>)}{d.assessments.length === 0 && <li className="text-muted">None yet.</li>}</ul></CardBody>
          </Card>
          <Card>
            <CardHeader><CardTitle>Notification history</CardTitle></CardHeader>
            <CardBody><ul className="space-y-2 text-sm">{d.notifications.slice(0, 15).map((n) => <li key={n.id} className="flex flex-wrap items-center justify-between gap-2"><span className="min-w-0 truncate">{n.channel} · {n.subject ?? n.templateKey}<span className="block text-xs text-muted">{formatDateTime(n.createdAt)}</span></span><NotificationStatusBadge status={n.status} /></li>)}{d.notifications.length === 0 && <li className="text-muted">None.</li>}</ul></CardBody>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Applications</CardTitle></CardHeader>
            <CardBody>
              <ul className="space-y-4">
                {d.apps.map(({ a, s }) => {
                  const reviewers = d.assignments.filter((x) => x.ra.applicationId === a.id);
                  const ms = d.milestones.filter((m) => m.applicationId === a.id);
                  return (
                    <li key={a.id} className="rounded-xl border border-line p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2"><Link href={`/admin/applications/${a.id}`} className="font-semibold hover:underline">{s.name}</Link><AppStatusBadge status={a.status} outcome={a.outcome} /></div>
                      <p className="mt-1 text-xs text-muted">Progress {a.progress}% · reviewer: {reviewers.map((r) => `${r.reviewer.firstName} ${r.reviewer.lastName}`).join(", ") || "unassigned"}</p>
                      <div className="mt-2 flex flex-wrap gap-1">{ms.slice(0, 13).map((m) => <span key={m.id} title={`${m.name} · ${m.dueDate}`}><MilestoneBadge status={effectiveStatus(m, today)} /></span>)}</div>
                    </li>
                  );
                })}
                {d.apps.length === 0 && <li className="text-sm text-muted">No applications.</li>}
              </ul>
            </CardBody>
          </Card>
          <Card>
            <CardHeader><CardTitle>Documents</CardTitle></CardHeader>
            <CardBody><ul className="space-y-2 text-sm">{d.docs.map((doc) => <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2"><Link href={`/reviewer/documents/${doc.id}`} className="hover:underline">{doc.title} <span className="text-xs text-muted">v{doc.currentVersion}</span></Link><ReviewStatusBadge status={doc.reviewStatus} /></li>)}{d.docs.length === 0 && <li className="text-muted">None.</li>}</ul></CardBody>
          </Card>
          <Card>
            <CardHeader><CardTitle>Referee requests</CardTitle></CardHeader>
            <CardBody><ul className="space-y-2 text-sm">{d.referees.map((r) => <li key={r.id} className="flex flex-wrap items-center justify-between gap-2"><span>{r.refereeName} <span className="text-xs text-muted">· {r.refereeEmail}</span></span><RefereeStatusBadge status={r.status} /></li>)}{d.referees.length === 0 && <li className="text-muted">None.</li>}</ul></CardBody>
          </Card>
          <p className="text-sm"><Link href={`/admin/audit?targetId=${d.user.id}`} className="font-semibold text-royal-700 hover:underline">View audit trail for this account</Link></p>
        </div>
      </div>
    </>
  );
}
