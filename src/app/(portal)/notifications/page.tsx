import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { Bell } from "lucide-react";
import { markNotificationsAction } from "@/app/actions/portal";
import { ActionButton } from "@/components/forms/action-form";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requireUser();
  const rows = await db.select().from(notifications).where(and(eq(notifications.userId, user.id), eq(notifications.channel, "in_app"))).orderBy(desc(notifications.createdAt)).limit(100);
  const unread = rows.filter((r) => !r.readAt).length;
  return (
    <>
      <PageHeader title="Notifications" description={`${unread} unread`} actions={unread > 0 && <ActionButton action={markNotificationsAction} variant="secondary">Mark all as read</ActionButton>} />
      {rows.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications yet" description="Reminders, feedback alerts and referee updates will appear here." />
      ) : (
        <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-white">
          {rows.map((n) => (
            <li key={n.id} className={cn("flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between", !n.readAt && "bg-gold-50/50")}>
              <div className="min-w-0">
                <p className={cn("text-sm", !n.readAt && "font-semibold")}>{!n.readAt && <span className="mr-2 inline-block size-2 rounded-full bg-gold-500" aria-label="Unread" />}{n.subject}</p>
                <p className="mt-0.5 text-sm text-muted">{n.body}</p>
                <p className="mt-1 text-xs text-muted">{formatDateTime(n.createdAt)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {n.actionUrl && n.actionUrl.startsWith("/") && <Link href={n.actionUrl} className="text-sm font-semibold text-royal-700 hover:underline">Open</Link>}
                <ActionButton action={markNotificationsAction} fields={{ id: n.id, read: n.readAt ? "0" : "1" }} size="sm" variant="ghost">{n.readAt ? "Mark unread" : "Mark read"}</ActionButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
