import Link from "next/link";
import { ScholarshipStatusBadge, SCHOLARSHIP_STATUS_LABELS } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { Badge, PageHeader, Pagination, Table, Td, Th } from "@/components/ui/misc";
import { requirePermissionPage } from "@/lib/auth/session";
import { adminListScholarships } from "@/lib/services/scholarships";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Scholarships" };
export const dynamic = "force-dynamic";

export default async function AdminScholarships({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  await requirePermissionPage("scholarships.manage");
  const sp = await searchParams;
  const res = await adminListScholarships({ q: sp.q, status: sp.status, page: Number(sp.page ?? 1) || 1 });
  return (
    <>
      <PageHeader title="Scholarships" description="Only verified scholarships from official partner university sources may be published." actions={<Button asChild><Link href="/admin/scholarships/new">New scholarship</Link></Button>} />
      <form method="get" className="mb-6 flex flex-wrap gap-2">
        <Input name="q" defaultValue={sp.q} placeholder="Search name or university" aria-label="Search" className="w-64" />
        <Select name="status" defaultValue={sp.status ?? ""} aria-label="Status" className="w-56"><option value="">All statuses</option>{Object.entries(SCHOLARSHIP_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        <Button type="submit" variant="secondary">Filter</Button>
      </form>
      <Table caption="Scholarships">
        <thead><tr><Th>Scholarship</Th><Th>Status</Th><Th>Deadline</Th><Th>Last verified</Th><Th>Applications</Th></tr></thead>
        <tbody>
          {res.rows.map(({ s, apps }) => (
            <tr key={s.id}>
              <Td><Link href={`/admin/scholarships/${s.id}`} className="font-semibold hover:underline">{s.name}</Link><span className="block text-xs text-muted">{s.partnerUniversity}</span>{s.isDemo && <Badge>Demo</Badge>} {!s.isActive && <Badge tone="danger">Inactive</Badge>}</Td>
              <Td><ScholarshipStatusBadge status={s.status} /></Td>
              <Td className="whitespace-nowrap">{formatDate(s.deadline)}</Td>
              <Td className="whitespace-nowrap">{formatDate(s.lastVerifiedAt)}</Td>
              <Td>{apps}</Td>
            </tr>
          ))}
          {res.rows.length === 0 && <tr><Td colSpan={5} className="py-8 text-center text-muted">No scholarships.</Td></tr>}
        </tbody>
      </Table>
      <Pagination page={res.page} total={res.total} pageSize={25} hrefFor={(p) => `/admin/scholarships?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.status ? { status: sp.status } : {}), page: String(p) })}`} />
    </>
  );
}
