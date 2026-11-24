import { Download } from "lucide-react";
import { CategoryBars, TrendChart } from "@/components/admin/charts";
import { VERDICT_LABELS } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/form";
import { PageHeader, Stat, Table, Td, Th } from "@/components/ui/misc";
import { requirePermissionPage } from "@/lib/auth/session";
import { STATUS_LABELS, type AppStatus } from "@/lib/engine/state-machine";
import { analytics } from "@/lib/services/analytics";
import { adminListScholarships, publicFacets } from "@/lib/services/scholarships";

export const metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

const pct = (a: number | null | undefined, b: number | null | undefined) => (b ? `${Math.round(((a ?? 0) / b) * 100)}%` : "—");

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePermissionPage("analytics.view");
  const sp = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const f = { from: sp.from || new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10), to: sp.to || today, scholarshipId: sp.scholarshipId || undefined, institution: sp.institution || undefined, status: sp.status || undefined, cohort: sp.cohort || undefined };
  const [a, schs, facets] = await Promise.all([analytics(f), adminListScholarships({}), publicFacets()]);
  const s = a.summary;
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();
  return (
    <>
      <PageHeader title="Analytics & reports" description="Live aggregates of real platform records for the selected period. Nothing is estimated." actions={user.permissions.has("exports.basic") && <Button asChild variant="secondary"><a href={`/api/admin/export/analytics?${qs}`}><Download aria-hidden /> Export CSV</a></Button>} />
      <form method="get" className="mb-6 grid gap-3 rounded-[var(--radius-card)] border border-line bg-white p-4 sm:grid-cols-3 lg:grid-cols-7 lg:items-end">
        <div className="space-y-1"><Label htmlFor="from">From</Label><Input id="from" name="from" type="date" defaultValue={f.from} /></div>
        <div className="space-y-1"><Label htmlFor="to">To</Label><Input id="to" name="to" type="date" defaultValue={f.to} /></div>
        <div className="space-y-1"><Label htmlFor="scholarshipId">Scholarship</Label><Select id="scholarshipId" name="scholarshipId" defaultValue={f.scholarshipId ?? ""}><option value="">All</option>{schs.rows.map(({ s: x }) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></div>
        <div className="space-y-1"><Label htmlFor="institution">Institution</Label><Select id="institution" name="institution" defaultValue={f.institution ?? ""}><option value="">All</option>{facets.institutions.map((i) => <option key={i}>{i}</option>)}</Select></div>
        <div className="space-y-1"><Label htmlFor="status">Application status</Label><Select id="status" name="status" defaultValue={f.status ?? ""}><option value="">All</option>{Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></div>
        <div className="space-y-1"><Label htmlFor="cohort">Cohort (month)</Label><Input id="cohort" name="cohort" type="month" defaultValue={f.cohort} /></div>
        <Button type="submit">Apply</Button>
      </form>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Registrations" value={s.registrations ?? 0} />
        <Stat label="Profile completion rate" value={s.profile_completion_rate !== null ? `${s.profile_completion_rate}%` : "—"} hint="Onboarding completed" />
        <Stat label="Eligibility screenings completed" value={s.screenings_completed ?? 0} hint={`${s.assessments_run ?? 0} assessments run`} />
        <Stat label="Scholarship views / saves" value={`${s.scholarship_views ?? 0} / ${s.scholarship_saves ?? 0}`} />
        <Stat label="Applications created" value={s.applications_created ?? 0} hint={`${s.applications_started ?? 0} started`} />
        <Stat label="Submitted" value={s.applications_submitted ?? 0} hint={`Completion rate ${pct(s.applications_submitted, s.applications_created)}`} />
        <Stat label="Abandoned (21+ days inactive)" value={s.applications_abandoned ?? 0} hint={`${pct(s.applications_abandoned, s.applications_created)} of created`} />
        <Stat label="Milestone completion" value={s.milestone_completion_rate !== null ? `${s.milestone_completion_rate}%` : "—"} hint="Milestones due in period" />
        <Stat label="Document review turnaround" value={s.doc_review_hours !== null ? `${s.doc_review_hours} h` : "—"} />
        <Stat label="Essay review turnaround" value={s.essay_review_hours !== null ? `${s.essay_review_hours} h` : "—"} />
        <Stat label="Referee submission rate" value={pct(s.referee_submitted, s.referee_requests)} hint={`${s.referee_submitted ?? 0} of ${s.referee_requests ?? 0}`} />
        <Stat label="Notification delivery rate" value={pct(s.notifications_delivered, s.notifications_total)} hint={`${s.notifications_failed ?? 0} failed`} />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-2"><CardHeader><CardTitle>Registrations over time</CardTitle></CardHeader><CardBody><TrendChart data={a.registrations} label="Registrations" /></CardBody></Card>
        <Card><CardHeader><CardTitle>Eligibility verdict distribution</CardTitle></CardHeader><CardBody><CategoryBars label="Current assessments" data={a.verdicts.map((v) => ({ label: v.verdict === "more_info_needed" ? "More info needed" : VERDICT_LABELS[v.verdict as keyof typeof VERDICT_LABELS], value: v.count }))} /></CardBody></Card>
        <Card><CardHeader><CardTitle>Application funnel</CardTitle></CardHeader><CardBody><CategoryBars label="Applications" data={a.funnel.map((x) => ({ label: STATUS_LABELS[x.status as AppStatus], value: x.count }))} /></CardBody></Card>
      </div>
      <h2 className="mb-3 mt-8 text-lg font-semibold">Scholarship engagement</h2>
      <Table caption="Scholarship engagement">
        <thead><tr><Th>Scholarship</Th><Th>Views</Th><Th>Saves</Th><Th>Applications</Th><Th>Submitted</Th></tr></thead>
        <tbody>{a.engagement.map((e) => <tr key={e.id}><Td>{e.name}</Td><Td>{e.views}</Td><Td>{e.saves}</Td><Td>{e.applications}</Td><Td>{e.submitted}</Td></tr>)}</tbody>
      </Table>
    </>
  );
}
