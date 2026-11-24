import Link from "next/link";
import { AppStatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label, Select } from "@/components/ui/form";
import { PageHeader, Pagination, Table, Td, Th } from "@/components/ui/misc";
import { requirePermissionPage } from "@/lib/auth/session";
import { STATUS_LABELS } from "@/lib/engine/state-machine";
import { adminListApplications } from "@/lib/services/admin";
import { adminListScholarships } from "@/lib/services/scholarships";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Applications" };
export const dynamic = "force-dynamic";

export default async function AdminApplications({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermissionPage("applicants.view");
  const sp = await searchParams;
  const [res, schs] = await Promise.all([adminListApplications({ q: sp.q, status: sp.status, scholarshipId: sp.scholarshipId, unassigned: sp.unassigned === "on", page: Number(sp.page ?? 1) || 1 }), adminListScholarships({})]);
  const qs = (o: Record<string, string>) => new URLSearchParams(Object.entries({ ...sp, ...o }).filter(([, v]) => v) as [string, string][]).toString();
  return (
    <>
      <PageHeader title="Applications" description={`${res.total} application${res.total === 1 ? "" : "s"}`} />
      <form method="get" className="mb-6 grid gap-3 rounded-[var(--radius-card)] border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <div className="space-y-1"><Label htmlFor="q">Applicant</Label><Input id="q" name="q" defaultValue={sp.q} /></div>
        <div className="space-y-1"><Label htmlFor="status">Status</Label><Select id="status" name="status" defaultValue={sp.status ?? ""}><option value="">Any</option>{Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></div>
        <div className="space-y-1"><Label htmlFor="scholarshipId">Scholarship</Label><Select id="scholarshipId" name="scholarshipId" defaultValue={sp.scholarshipId ?? ""}><option value="">Any</option>{schs.rows.map(({ s }) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></div>
        <Checkbox id="unassigned" name="unassigned" defaultChecked={sp.unassigned === "on"} label="No reviewer assigned" />
        <Button type="submit">Filter</Button>
      </form>
      <Table caption="Applications">
        <thead><tr><Th>Applicant</Th><Th>Scholarship</Th><Th>Status</Th><Th>Progress</Th><Th>Deadline</Th><Th>Reviewer</Th></tr></thead>
        <tbody>
          {res.rows.map(({ a, s, u, reviewers }) => (
            <tr key={a.id}>
              <Td><Link href={`/admin/applications/${a.id}`} className="font-semibold hover:underline">{u.firstName} {u.lastName}</Link><span className="block text-xs text-muted">{u.email}</span></Td>
              <Td>{s.name}</Td>
              <Td><AppStatusBadge status={a.status} outcome={a.outcome} /></Td>
              <Td>{a.progress}%</Td>
              <Td className="whitespace-nowrap">{formatDate(a.deadline)}</Td>
              <Td className={reviewers ? "" : "text-warning-700"}>{reviewers ?? "Unassigned"}</Td>
            </tr>
          ))}
          {res.rows.length === 0 && <tr><Td colSpan={6} className="py-8 text-center text-muted">No applications match.</Td></tr>}
        </tbody>
      </Table>
      <Pagination page={res.page} total={res.total} pageSize={25} hrefFor={(p) => `/admin/applications?${qs({ page: String(p) })}`} />
    </>
  );
}
