import Link from "next/link";
import { CategoryBars, TrendChart } from "@/components/admin/charts";
import { VERDICT_LABELS } from "@/components/status";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, PageHeader, Stat } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { STATUS_LABELS, type AppStatus } from "@/lib/engine/state-machine";
import { aiStatus } from "@/lib/integrations/ai";
import { emailStatus } from "@/lib/integrations/email";
import { storageStatus } from "@/lib/integrations/storage";
import { overviewStats, registrationsSeries, statusDistribution } from "@/lib/services/admin";
import { sql } from "drizzle-orm";

export const metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  const user = await requireUser();
  const [s, series, dist, verdicts] = await Promise.all([
    overviewStats(),
    registrationsSeries(30),
    statusDistribution(),
    db.execute<{ verdict: string; count: number }>(sql`SELECT overall_verdict::text AS verdict, count(*)::int AS count FROM eligibility_assessments WHERE is_current AND overall_verdict IS NOT NULL GROUP BY 1`),
  ]);
  const integrations = [["Email", emailStatus()], ["Storage", storageStatus()], ["AI critique", aiStatus()]] as const;
  const notConfigured = integrations.filter(([, st]) => !st.configured);
  return (
    <>
      <PageHeader title={`Good to see you, ${user.firstName}`} description="Live figures from the database. Click any card to act on it." />
      {notConfigured.length > 0 && <Alert tone="warning" className="mb-6" title="Integrations need configuration">{notConfigured.map(([n, st]) => `${n} (${st.missing.join(", ")})`).join(" · ")} — see <Link href="/admin/settings">Settings</Link>.</Alert>}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">People & applications</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total applicants" value={s.total_applicants} href="/admin/applicants" />
        <Stat label="Verified users" value={s.verified_users} />
        <Stat label="Active (30 days)" value={s.active_applicants} />
        <Stat label="Applications created" value={s.applications_created} href="/admin/applications" />
        <Stat label="In progress" value={s.applications_in_progress} href="/admin/applications?status=in_progress" />
        <Stat label="Submitted" value={s.applications_submitted} href="/admin/applications?status=submitted" />
        <Stat label="Shortlisted" value={s.applications_shortlisted} href="/admin/applications?status=shortlisted" />
        <Stat label="Outcomes recorded" value={s.outcomes_recorded} href="/admin/applications?status=outcome" />
      </div>
      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-muted">Scholarships & attention needed</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Scholarship records" value={s.scholarships_total} href="/admin/scholarships" />
        <Stat label="Active (published)" value={s.scholarships_active} href="/admin/scholarships?status=published" />
        <Stat label="Pending verification" value={s.scholarships_pending_verification} href="/admin/scholarships?status=pending_verification" tone={s.scholarships_pending_verification ? "warning" : "default"} />
        <Stat label="Deadlines in 30 days" value={s.upcoming_deadlines} />
        <Stat label="Overdue milestones" value={s.overdue_milestones} tone={s.overdue_milestones ? "warning" : "default"} href="/admin/applications?status=in_progress" />
        <Stat label="Pending document reviews" value={s.pending_document_reviews} href="/admin/document-reviews" tone={s.pending_document_reviews ? "warning" : "default"} />
        <Stat label="Pending AI approvals" value={s.pending_ai_approvals} href="/admin/ai-queue" tone={s.pending_ai_approvals ? "warning" : "default"} />
        <Stat label="Pending essay reviews" value={s.pending_essay_reviews} href="/admin/essay-reviews" />
        <Stat label="Pending referee requests" value={s.pending_referee_requests} href="/admin/referees" />
        <Stat label="Failed notifications" value={s.failed_notifications} href="/admin/notifications?status=failed" tone={s.failed_notifications ? "danger" : "default"} />
        <Stat label="Privacy requests" value={s.pending_data_requests} href="/admin/data-requests" tone={s.pending_data_requests ? "warning" : "default"} />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-2"><CardHeader><CardTitle>New registrations — last 30 days</CardTitle></CardHeader><CardBody><TrendChart data={series} label="Registrations" /></CardBody></Card>
        <Card><CardHeader><CardTitle>Applications by status</CardTitle></CardHeader><CardBody><CategoryBars label="Applications" data={dist.map((d) => ({ label: STATUS_LABELS[d.status as AppStatus] ?? d.status, value: d.count }))} /></CardBody></Card>
        <Card><CardHeader><CardTitle>Current eligibility verdicts</CardTitle></CardHeader><CardBody><CategoryBars label="Assessments" data={[...verdicts].map((v) => ({ label: v.verdict === "more_info_needed" ? "More info needed" : VERDICT_LABELS[v.verdict as keyof typeof VERDICT_LABELS], value: v.count }))} /></CardBody></Card>
      </div>
    </>
  );
}
