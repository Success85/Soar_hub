import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";
import { PageHeader, Pagination, Table, Td, Th } from "@/components/ui/misc";
import { requirePermissionPage } from "@/lib/auth/session";
import { searchAudit } from "@/lib/services/admin";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Audit logs" };
export const dynamic = "force-dynamic";

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermissionPage("audit.view");
  const sp = await searchParams;
  const res = await searchAudit({ ...sp, page: Number(sp.page ?? 1) || 1 });
  return (
    <>
      <PageHeader title="Audit logs" description="Append-only. The database rejects any update, delete or truncate on this table — for every role, including administrators." />
      <form method="get" className="mb-4 grid gap-3 rounded-[var(--radius-card)] border border-line bg-white p-4 sm:grid-cols-3 lg:grid-cols-6 lg:items-end">
        <div className="space-y-1"><Label htmlFor="q">Search</Label><Input id="q" name="q" defaultValue={sp.q} /></div>
        <div className="space-y-1"><Label htmlFor="eventType">Event prefix</Label><Input id="eventType" name="eventType" defaultValue={sp.eventType} placeholder="e.g. scholarship." /></div>
        <div className="space-y-1"><Label htmlFor="targetId">Target ID</Label><Input id="targetId" name="targetId" defaultValue={sp.targetId} /></div>
        <div className="space-y-1"><Label htmlFor="from">From</Label><Input id="from" name="from" type="date" defaultValue={sp.from} /></div>
        <div className="space-y-1"><Label htmlFor="to">To</Label><Input id="to" name="to" type="date" defaultValue={sp.to} /></div>
        <Button type="submit">Search</Button>
      </form>
      <Table caption="Audit events">
        <thead><tr><Th>When</Th><Th>Event</Th><Th>Actor</Th><Th>Target</Th><Th>Details</Th></tr></thead>
        <tbody>{res.rows.map(({ log, actor }) => (
          <tr key={log.id}>
            <Td className="whitespace-nowrap text-xs">{formatDateTime(log.createdAt)}</Td>
            <Td><code className="text-xs font-semibold">{log.eventType}</code></Td>
            <Td className="text-xs">{actor?.email ? `${actor.firstName} ${actor.lastName}` : log.actorRole ?? "system"}<span className="block text-muted">{log.actorRole}{log.ip ? ` · ${log.ip}` : ""}</span></Td>
            <Td className="text-xs">{log.targetType}<span className="block break-all text-muted">{log.targetId}</span></Td>
            <Td className="text-xs">{(log.metadata || log.previousState || log.newState) ? <details><summary className="cursor-pointer text-royal-700">View</summary><pre className="mt-1 max-w-md overflow-auto whitespace-pre-wrap rounded bg-ivory-200/60 p-2">{JSON.stringify({ metadata: log.metadata, previous: log.previousState, next: log.newState }, null, 2)}</pre></details> : "—"}</Td>
          </tr>
        ))}</tbody>
      </Table>
      <Pagination page={res.page} total={res.total} pageSize={50} hrefFor={(p) => `/admin/audit?${new URLSearchParams(Object.entries({ ...sp, page: String(p) }).filter(([, v]) => v) as [string, string][])}`} />
    </>
  );
}
