import { dataRequestAction } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Input } from "@/components/ui/form";
import { Badge, PageHeader, Table, Td, Th } from "@/components/ui/misc";
import { requirePermissionPage } from "@/lib/auth/session";
import { listDataRequests } from "@/lib/services/privacy";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Privacy requests" };
export const dynamic = "force-dynamic";

export default async function DataRequestsPage() {
  await requirePermissionPage("data_requests.manage");
  const rows = await listDataRequests();
  return (
    <>
      <PageHeader title="Privacy requests" description="NDPR requests. Exports are generated automatically. Deletion requests must be completed within 30 days: personal data is erased or anonymised; audit records and de-identified application history are retained." />
      <Table caption="Data requests">
        <thead><tr><Th>Requested</Th><Th>User</Th><Th>Type</Th><Th>Status</Th><Th>Reason / notes</Th><Th>Action</Th></tr></thead>
        <tbody>{rows.map(({ r, u }) => (
          <tr key={r.id}>
            <Td className="whitespace-nowrap text-xs">{formatDateTime(r.requestedAt)}</Td>
            <Td>{u.firstName} {u.lastName}<span className="block text-xs text-muted">{u.email}</span></Td>
            <Td>{r.type}</Td>
            <Td><Badge tone={r.status === "pending" ? "warning" : r.status === "completed" ? "success" : "neutral"}>{r.status}</Badge></Td>
            <Td className="text-xs">{r.reason ?? ""}{r.notes ? ` · ${r.notes}` : ""}</Td>
            <Td>{r.type === "deletion" && r.status === "pending" && (
              <ActionForm action={dataRequestAction} className="flex flex-wrap gap-2">
                <input type="hidden" name="id" value={r.id} />
                <Input name="notes" placeholder="Notes" aria-label="Notes" className="h-9 w-40" />
                <SubmitButton size="sm" variant="danger" name="decision" value="complete">Erase data</SubmitButton>
                <SubmitButton size="sm" variant="ghost" name="decision" value="reject">Reject</SubmitButton>
              </ActionForm>
            )}</Td>
          </tr>
        ))}{rows.length === 0 && <tr><Td colSpan={6} className="py-8 text-center text-muted">No requests.</Td></tr>}</tbody>
      </Table>
    </>
  );
}
