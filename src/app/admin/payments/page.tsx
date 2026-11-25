import Link from "next/link";
import { recheckPaymentAction } from "@/app/actions/admin";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/form";
import { Badge, PageHeader, Stat, Table, Td, Th } from "@/components/ui/misc";
import { requirePermissionPage } from "@/lib/auth/session";
import { flutterwaveStatus } from "@/lib/integrations/flutterwave";
import { listPayments } from "@/lib/services/membership";
import { getSettings } from "@/lib/services/settings";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Payments & members" };
export const dynamic = "force-dynamic";

const naira = (n: number) => `₦${n.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;

export default async function PaymentsAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermissionPage("settings.manage");
  const sp = await searchParams;
  const [res, s] = await Promise.all([listPayments({ status: sp.status, q: sp.q, page: Number(sp.page ?? 1) || 1 }), getSettings()]);
  const flw = flutterwaveStatus();
  return (
    <>
      <PageHeader title="Payments & members" description={`Membership: ${naira(Number(s.membership_price_ngn))} ${Number(s.membership_duration_months) === 0 ? "one-time (lifetime)" : `for ${s.membership_duration_months} months`} · ${s.membership_required ? "paywall on" : "paywall OFF (everyone has access)"} · ${flw.provider}${flw.configured ? "" : " not configured"}`} actions={<Button asChild variant="secondary"><Link href="/admin/settings">Price & settings</Link></Button>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Active members" value={res.activeMembers} />
        <Stat label="Successful payments" value={res.successful} />
        <Stat label="Revenue (successful)" value={naira(res.revenue)} />
      </div>
      <form className="mb-4 flex flex-wrap items-end gap-3" method="get">
        <div className="space-y-1"><Label htmlFor="q">Search</Label><Input id="q" name="q" defaultValue={sp.q} placeholder="Email, reference or member ID" className="w-72" /></div>
        <div className="space-y-1"><Label htmlFor="status">Status</Label><Select id="status" name="status" defaultValue={sp.status ?? ""}><option value="">Any</option>{["successful", "pending", "failed", "cancelled"].map((x) => <option key={x}>{x}</option>)}</Select></div>
        <Button type="submit">Filter</Button>
      </form>
      <Table caption="Payments">
        <thead><tr><Th>Member</Th><Th>Amount</Th><Th>Status</Th><Th>Reference</Th><Th>Method</Th><Th>Date</Th><Th>Action</Th></tr></thead>
        <tbody>
          {res.rows.map(({ p, u }) => (
            <tr key={p.id}>
              <Td><Link href={`/admin/applicants/${u.id}`} className="font-semibold hover:underline">{u.firstName} {u.lastName}</Link><span className="block text-xs text-muted">{u.email}{u.memberCode ? ` · ${u.memberCode}` : ""}</span></Td>
              <Td className="whitespace-nowrap">{naira(Number(p.amount))}</Td>
              <Td><Badge tone={p.status === "successful" ? "success" : p.status === "pending" ? "warning" : "neutral"}>{p.status}</Badge>{p.failureReason && <span className="mt-1 block max-w-56 text-xs text-muted">{p.failureReason}</span>}</Td>
              <Td className="font-mono text-xs">{p.txRef}{p.providerTransactionId && <span className="block text-muted">FLW {p.providerTransactionId}</span>}</Td>
              <Td className="text-xs">{p.paymentMethod ?? "—"}</Td>
              <Td className="whitespace-nowrap text-xs">{formatDateTime(p.paidAt ?? p.createdAt)}</Td>
              <Td>
                {p.status === "pending" && (
                  <ActionForm action={recheckPaymentAction} className="flex items-start gap-2">
                    <input type="hidden" name="txRef" value={p.txRef} />
                    <div><Input name="transactionId" aria-label="Flutterwave transaction ID" placeholder="FLW transaction ID" className="h-9 w-40 text-sm" /><FieldError name="transactionId" /></div>
                    <SubmitButton size="sm" variant="secondary">Re-check</SubmitButton>
                  </ActionForm>
                )}
              </Td>
            </tr>
          ))}
          {res.rows.length === 0 && <tr><Td colSpan={7} className="py-8 text-center text-muted">No payments yet.</Td></tr>}
        </tbody>
      </Table>
      <p className="mt-3 text-xs text-muted">Showing {res.rows.length} of {res.total}. To give someone access without paying (e.g. a sponsored student), open their applicant page and use “Grant membership”.</p>
    </>
  );
}
