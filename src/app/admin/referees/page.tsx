import { adminCancelRefereeAction } from "@/app/actions/admin";
import { ActionButton } from "@/components/forms/action-form";
import { RefereeStatusBadge } from "@/components/status";
import { Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { PageHeader, Table, Td, Th } from "@/components/ui/misc";
import { requirePermissionPage } from "@/lib/auth/session";
import { adminReferees } from "@/lib/services/referees";
import { formatDate, formatDateTime } from "@/lib/utils";

export const metadata = { title: "Referees" };
export const dynamic = "force-dynamic";

export default async function AdminReferees({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requirePermissionPage("referees.manage");
  const { status } = await searchParams;
  const rows = await adminReferees(status);
  return (
    <>
      <PageHeader title="Referee requests" description="Referee links are hashed at rest; administrators can revoke but never view the secret link." />
      <form method="get" className="mb-4 flex gap-2"><Select name="status" defaultValue={status ?? ""} aria-label="Status" className="w-48"><option value="">All</option>{["sent", "opened", "submitted", "expired", "cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}</Select><Button type="submit" variant="secondary">Filter</Button></form>
      <Table caption="Referee requests">
        <thead><tr><Th>Applicant</Th><Th>Referee</Th><Th>Scholarship</Th><Th>Deadline</Th><Th>Expires</Th><Th>Status</Th><Th /></tr></thead>
        <tbody>{rows.map(({ r, scholarshipName, applicant }) => (
          <tr key={r.id}>
            <Td>{applicant.firstName} {applicant.lastName}</Td>
            <Td>{r.refereeName}<span className="block text-xs text-muted">{r.refereeEmail} · {r.relationship}</span></Td>
            <Td>{scholarshipName}</Td>
            <Td>{formatDate(r.deadline)}</Td>
            <Td className="whitespace-nowrap">{formatDateTime(r.tokenExpiresAt)}</Td>
            <Td><RefereeStatusBadge status={r.status} /></Td>
            <Td>{["sent", "opened"].includes(r.status) && <ActionButton action={adminCancelRefereeAction} fields={{ requestId: r.id }} size="sm" variant="ghost" confirm="Revoke this referee link?">Revoke</ActionButton>}</Td>
          </tr>
        ))}{rows.length === 0 && <tr><Td colSpan={7} className="py-8 text-center text-muted">No requests.</Td></tr>}</tbody>
      </Table>
    </>
  );
}
