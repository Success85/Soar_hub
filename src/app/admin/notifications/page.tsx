import Link from "next/link";
import { and, desc, eq, ilike, inArray, or, type SQL } from "drizzle-orm";
import { notificationOpAction } from "@/app/actions/admin";
import { ActionButton } from "@/components/forms/action-form";
import { NotificationStatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { PageHeader, Table, Td, Th } from "@/components/ui/misc";
import { requirePermissionPage } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { notificationDeliveryAttempts, notifications } from "@/lib/db/schema";
import { SECRET_LINK_TEMPLATES } from "@/lib/services/notifications";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default async function AdminNotifications({ searchParams }: { searchParams: Promise<{ status?: string; channel?: string; q?: string; type?: string }> }) {
  await requirePermissionPage("notifications.manage");
  const sp = await searchParams;
  const conds: SQL[] = [];
  if (sp.status) conds.push(eq(notifications.status, sp.status as never));
  if (sp.channel) conds.push(eq(notifications.channel, sp.channel as never));
  if (sp.type) conds.push(ilike(notifications.templateKey, `${sp.type}%`));
  if (sp.q) conds.push(or(ilike(notifications.recipientEmail, `%${sp.q}%`), ilike(notifications.idempotencyKey, `%${sp.q}%`), ilike(notifications.subject, `%${sp.q}%`))!);
  const rows = await db.select().from(notifications).where(conds.length ? and(...conds) : undefined).orderBy(desc(notifications.createdAt)).limit(100);
  const attempts = rows.length ? await db.select().from(notificationDeliveryAttempts).where(inArray(notificationDeliveryAttempts.notificationId, rows.map((r) => r.id))) : [];
  return (
    <>
      <PageHeader title="Notifications" description="Delivery monitoring. Failed messages retry automatically at 5, 15 and 60 minutes, then wait here for a manual retry." actions={<Button asChild variant="secondary"><Link href="/admin/notifications/templates">Edit templates</Link></Button>} />
      <form method="get" className="mb-4 flex flex-wrap gap-2">
        <Input name="q" defaultValue={sp.q} placeholder="Recipient, subject or idempotency key" aria-label="Search" className="w-72" />
        <Select name="status" defaultValue={sp.status ?? ""} aria-label="Status" className="w-40"><option value="">Any status</option>{["pending", "queued", "sending", "sent", "delivered", "failed", "cancelled"].map((s) => <option key={s}>{s}</option>)}</Select>
        <Select name="channel" defaultValue={sp.channel ?? ""} aria-label="Channel" className="w-36"><option value="">Any channel</option><option value="email">Email</option><option value="sms">SMS</option><option value="in_app">In-app</option></Select>
        <Select name="type" defaultValue={sp.type ?? ""} aria-label="Type" className="w-44"><option value="">Any type</option>{["auth", "milestone", "referee", "review", "application", "account", "admin"].map((t) => <option key={t}>{t}</option>)}</Select>
        <Button type="submit" variant="secondary">Filter</Button>
      </form>
      <Table caption="Notifications">
        <thead><tr><Th>Created</Th><Th>Type / channel</Th><Th>Recipient</Th><Th>Status</Th><Th>Attempts</Th><Th>Actions</Th></tr></thead>
        <tbody>
          {rows.map((n) => (
            <tr key={n.id}>
              <Td className="whitespace-nowrap text-xs">{formatDateTime(n.createdAt)}</Td>
              <Td><p className="font-medium">{n.templateKey}</p><p className="text-xs text-muted">{n.channel} · {n.subject}</p><details className="text-xs"><summary className="cursor-pointer text-royal-700">Details</summary><p className="mt-1 break-all">Key: <code>{n.idempotencyKey}</code></p><p className="whitespace-pre-wrap">{n.body}</p>{n.actionUrl && <p className="break-all">Link: {SECRET_LINK_TEMPLATES.has(n.templateKey) ? "[secret link hidden]" : n.actionUrl}</p>}</details></Td>
              <Td className="text-xs">{n.recipientEmail ?? n.recipientPhone ?? (n.userId ? "In-app user" : "—")}</Td>
              <Td><NotificationStatusBadge status={n.status} />{n.lastError && <p className="mt-1 max-w-56 text-xs text-danger-700">{n.lastError}</p>}</Td>
              <Td className="text-xs"><ul>{attempts.filter((a) => a.notificationId === n.id).map((a) => <li key={a.id}>#{a.attemptNumber} {a.status} {a.provider ?? ""} · {formatDateTime(a.createdAt)}</li>)}</ul>{n.provider && <p className="text-muted">via {n.provider}</p>}</Td>
              <Td>{["failed", "cancelled"].includes(n.status) && <ActionButton action={notificationOpAction} fields={{ id: n.id, op: "retry" }} size="sm" variant="secondary">Retry</ActionButton>}{["pending", "queued"].includes(n.status) && <ActionButton action={notificationOpAction} fields={{ id: n.id, op: "cancel" }} size="sm" variant="ghost">Cancel</ActionButton>}</Td>
            </tr>
          ))}
          {rows.length === 0 && <tr><Td colSpan={6} className="py-8 text-center text-muted">No notifications match.</Td></tr>}
        </tbody>
      </Table>
    </>
  );
}
