import Link from "next/link";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/form";
import { Badge, PageHeader, Pagination, Table, Td, Th } from "@/components/ui/misc";
import { requirePermissionPage } from "@/lib/auth/session";
import { STATUS_LABELS } from "@/lib/engine/state-machine";
import { listApplicants, listReviewers } from "@/lib/services/admin";
import { adminListScholarships } from "@/lib/services/scholarships";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Applicants" };
export const dynamic = "force-dynamic";

export default async function ApplicantsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePermissionPage("applicants.view");
  const sp = await searchParams;
  const f = { ...sp, page: Number(sp.page ?? 1) || 1, completion: sp.completion as never };
  const [res, schs, reviewers] = await Promise.all([listApplicants(f), adminListScholarships({}), listReviewers()]);
  const qs = (o: Record<string, string>) => new URLSearchParams(Object.entries({ ...sp, ...o }).filter(([, v]) => v) as [string, string][]).toString();
  return (
    <>
      <PageHeader title="Applicants" description={`${res.total} applicant${res.total === 1 ? "" : "s"}`} actions={user.permissions.has("exports.basic") && <Button asChild variant="secondary"><a href={`/api/admin/export/applicants?${qs({})}`}><Download aria-hidden /> Export CSV</a></Button>} />
      <form method="get" className="mb-6 grid gap-3 rounded-[var(--radius-card)] border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1"><Label htmlFor="q">Search</Label><Input id="q" name="q" defaultValue={sp.q} placeholder="Name or email" /></div>
        <div className="space-y-1"><Label htmlFor="scholarshipId">Scholarship</Label><Select id="scholarshipId" name="scholarshipId" defaultValue={sp.scholarshipId ?? ""}><option value="">Any</option>{schs.rows.map(({ s }) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></div>
        <div className="space-y-1"><Label htmlFor="status">Application status</Label><Select id="status" name="status" defaultValue={sp.status ?? ""}><option value="">Any</option>{Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></div>
        <div className="space-y-1"><Label htmlFor="verdict">Eligibility verdict</Label><Select id="verdict" name="verdict" defaultValue={sp.verdict ?? ""}><option value="">Any</option><option value="likely_eligible">Likely eligible</option><option value="more_info_needed">More info needed</option><option value="not_eligible">Not eligible</option></Select></div>
        <div className="space-y-1"><Label htmlFor="completion">Profile completion</Label><Select id="completion" name="completion" defaultValue={sp.completion ?? ""}><option value="">Any</option><option value="low">Under 40%</option><option value="mid">40–79%</option><option value="high">80%+</option></Select></div>
        <div className="space-y-1"><Label htmlFor="reviewerId">Reviewer</Label><Select id="reviewerId" name="reviewerId" defaultValue={sp.reviewerId ?? ""}><option value="">Any</option>{reviewers.map((r) => <option key={r.id} value={r.id}>{r.firstName} {r.lastName}</option>)}</Select></div>
        <div className="space-y-1"><Label htmlFor="from">Registered from</Label><Input id="from" name="from" type="date" defaultValue={sp.from} /></div>
        <div className="space-y-1"><Label htmlFor="to">Registered to</Label><Input id="to" name="to" type="date" defaultValue={sp.to} /></div>
        <div className="space-y-1"><Label htmlFor="deadlineBefore">Deadline before</Label><Input id="deadlineBefore" name="deadlineBefore" type="date" defaultValue={sp.deadlineBefore} /></div>
        <div className="flex items-end gap-2"><Button type="submit">Filter</Button><Link href="/admin/applicants" className="pb-2 text-sm font-semibold text-royal-700">Reset</Link></div>
      </form>
      <Table caption="Applicants">
        <thead><tr><Th>Applicant</Th><Th>Registered</Th><Th>Profile</Th><Th>Applications</Th><Th>Latest status</Th><Th>State</Th></tr></thead>
        <tbody>
          {res.rows.map((r) => (
            <tr key={r.id}>
              <Td><Link href={`/admin/applicants/${r.id}`} className="font-semibold hover:underline">{r.first_name} {r.last_name}</Link><span className="block text-xs text-muted">{r.email}</span>{!r.email_verified_at && <Badge tone="warning">Unverified</Badge>}{r.status !== "active" && <Badge tone="danger">{r.status}</Badge>}</Td>
              <Td className="whitespace-nowrap">{formatDate(r.created_at)}</Td>
              <Td>{r.completion}%</Td>
              <Td>{r.applications} <span className="text-xs text-muted">({r.submitted} submitted)</span></Td>
              <Td>{r.latest_status ? STATUS_LABELS[r.latest_status as keyof typeof STATUS_LABELS] : "—"}</Td>
              <Td>{r.state_of_origin ?? "—"}</Td>
            </tr>
          ))}
          {res.rows.length === 0 && <tr><Td colSpan={6} className="py-8 text-center text-muted">No applicants match these filters.</Td></tr>}
        </tbody>
      </Table>
      <Pagination page={res.page} total={res.total} pageSize={res.pageSize} hrefFor={(p) => `/admin/applicants?${qs({ page: String(p) })}`} />
    </>
  );
}
