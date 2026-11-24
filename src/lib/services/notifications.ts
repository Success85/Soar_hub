import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, type DbOrTx } from "@/lib/db";
import { notificationDeliveryAttempts, notificationPreferences, notifications, notificationTemplates, users } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { MAX_ATTEMPTS, nextRetryAt, renderTemplate } from "@/lib/engine/notification-keys";
import { sendEmail } from "@/lib/integrations/email";
import { IntegrationNotConfiguredError, ProviderError } from "@/lib/integrations/errors";
import { normalisePhone, sendSms } from "@/lib/integrations/sms";
import { audit } from "./audit";
import { DEFAULT_TEMPLATES } from "./notification-templates";
import { getSetting } from "./settings";

export type Channel = "email" | "sms" | "in_app";

/** Which preference flag governs each template family. Transactional (auth/referee-to-referee) ignore preferences. */
function preferenceFor(templateKey: string): keyof typeof notificationPreferences.$inferSelect | null {
  if (templateKey.startsWith("milestone.overdue")) return "overdueReminders";
  if (templateKey.startsWith("milestone.")) return "milestoneReminders";
  if (templateKey === "referee.submitted" || templateKey === "referee.expired") return "refereeUpdates";
  if (templateKey.startsWith("review.document") || templateKey.startsWith("review.essay")) return "feedbackUpdates";
  return null;
}

export interface EnqueueInput {
  templateKey: string;
  channel: Channel;
  idempotencyKey: string;
  userId?: string | null;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  vars: Record<string, unknown>;
  actionUrl?: string | null;
  sendAt?: Date;
  /** bypass user preferences (security/transactional mail) */
  transactional?: boolean;
}

async function loadTemplate(key: string, channel: Channel, tx: DbOrTx) {
  const [row] = await tx
    .select()
    .from(notificationTemplates)
    .where(and(eq(notificationTemplates.key, key), eq(notificationTemplates.channel, channel), eq(notificationTemplates.isActive, true)))
    .limit(1);
  if (row) return { subject: row.subject ?? "", body: row.body };
  const def = DEFAULT_TEMPLATES.find((t) => t.key === key && t.channel === channel);
  if (!def) return null;
  return { subject: def.subject ?? "", body: def.body };
}

/**
 * Creates a notification exactly once per idempotency key (unique index + ON CONFLICT DO NOTHING).
 * Returns the notification id, or null when skipped (duplicate, preference off, no recipient).
 */
export async function enqueueNotification(input: EnqueueInput, tx: DbOrTx = db): Promise<string | null> {
  let email = input.recipientEmail ?? null;
  let phone = input.recipientPhone ?? null;

  if (input.userId) {
    const [prefs] = await tx.select().from(notificationPreferences).where(eq(notificationPreferences.userId, input.userId)).limit(1);
    if (!input.transactional && prefs) {
      if (input.channel === "email" && !prefs.emailEnabled) return null;
      if (input.channel === "sms" && !prefs.smsEnabled) return null;
      if (input.channel === "in_app" && !prefs.inAppEnabled) return null;
      const flag = preferenceFor(input.templateKey);
      if (flag && prefs[flag] === false) return null;
    }
    if (input.channel === "sms" && (!prefs || !prefs.smsEnabled)) return null; // SMS is strictly opt-in
    if (input.channel === "email" && !email) {
      const [u] = await tx.select({ email: users.email, status: users.status }).from(users).where(eq(users.id, input.userId)).limit(1);
      if (!u || u.status === "deleted") return null;
      email = u.email;
    }
  }
  if (input.channel === "sms") {
    if (!(await getSetting("sms_enabled"))) return null;
    phone = normalisePhone(phone);
    if (!phone) return null;
  }
  if (input.channel === "email" && !email) return null;
  if (input.channel === "in_app" && !input.userId) return null;

  const tpl = await loadTemplate(input.templateKey, input.channel, tx);
  if (!tpl) throw new Error(`No template for ${input.templateKey}/${input.channel}`);

  const inserted = await tx
    .insert(notifications)
    .values({
      userId: input.userId ?? null,
      channel: input.channel,
      templateKey: input.templateKey,
      recipientEmail: input.channel === "email" ? email : null,
      recipientPhone: input.channel === "sms" ? phone : null,
      subject: tpl.subject ? renderTemplate(tpl.subject, input.vars) : null,
      body: renderTemplate(tpl.body, input.vars),
      actionUrl: input.actionUrl ?? null,
      data: input.vars,
      idempotencyKey: input.idempotencyKey,
      // in-app notifications are delivered the moment they're written
      status: input.channel === "in_app" ? "delivered" : "pending",
      sentAt: input.channel === "in_app" ? new Date() : null,
      deliveredAt: input.channel === "in_app" ? new Date() : null,
      nextAttemptAt: input.sendAt ?? new Date(),
    })
    .onConflictDoNothing({ target: notifications.idempotencyKey })
    .returning({ id: notifications.id });
  return inserted[0]?.id ?? null;
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function renderEmailHtml(subject: string, body: string, actionUrl: string | null, platformName: string): string {
  const paragraphs = esc(body)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
  const button = actionUrl
    ? `<p style="margin:24px 0"><a href="${esc(actionUrl)}" style="background:#0B1F3A;color:#FAF8F2;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Open in ${esc(platformName)}</a></p><p style="font-size:12px;color:#5b6473;word-break:break-all">Or paste this link into your browser: ${esc(actionUrl)}</p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#FAF8F2;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0B1F3A">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e7e2d3">
<tr><td style="padding:20px 28px;border-bottom:3px solid #D4A72C;font-weight:700;font-size:18px">${esc(platformName)}</td></tr>
<tr><td style="padding:28px"><h1 style="font-size:20px;margin:0 0 16px">${esc(subject)}</h1>${paragraphs}${button}</td></tr>
<tr><td style="padding:16px 28px;font-size:12px;color:#5b6473;border-top:1px solid #eee">SOAR Hub supports your preparation — it never guarantees selection. You can change notification preferences in Settings.</td></tr>
</table></td></tr></table></body></html>`;
}

/* ------------------------------------------------------------------ */
/* Dispatch                                                            */
/* ------------------------------------------------------------------ */

type NotificationRow = typeof notifications.$inferSelect;

/** Templates whose action URL contains a secret token: the link is removed from storage once sent. */
export const SECRET_LINK_TEMPLATES = new Set(["auth.verify_email", "auth.password_reset", "referee.invitation", "referee.reminder"]);

async function deliver(n: NotificationRow): Promise<{ provider: string; messageId: string | null; response?: unknown }> {
  if (n.channel === "email") {
    const platformName = await getSetting("platform_name");
    // In-app notifications store relative links; emails need absolute ones.
    const link = n.actionUrl?.startsWith("/") ? appUrl(n.actionUrl) : n.actionUrl;
    const text = n.body + (link ? `\n\n${link}` : "");
    return sendEmail({
      to: n.recipientEmail!,
      subject: n.subject ?? platformName,
      text,
      html: renderEmailHtml(n.subject ?? platformName, n.body, link, platformName),
      idempotencyKey: n.idempotencyKey,
    });
  }
  if (n.channel === "sms") return sendSms(n.recipientPhone!, n.body);
  return { provider: "in_app", messageId: null };
}

/** Sends one claimed notification and records the attempt. */
async function processOne(n: NotificationRow): Promise<"sent" | "retry" | "failed"> {
  const attemptNumber = n.attempts + 1;
  try {
    const res = await deliver(n);
    await db.transaction(async (tx) => {
      await tx
        .update(notifications)
        .set({
          status: "sent",
          attempts: attemptNumber,
          sentAt: new Date(),
          provider: res.provider,
          providerMessageId: res.messageId,
          lastError: null,
          lockedAt: null,
          updatedAt: new Date(),
          ...(SECRET_LINK_TEMPLATES.has(n.templateKey) ? { actionUrl: null } : {}),
        })
        .where(eq(notifications.id, n.id));
      await tx.insert(notificationDeliveryAttempts).values({ notificationId: n.id, attemptNumber, status: "sent", provider: res.provider, response: (res.response as object) ?? null });
    });
    return "sent";
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const notConfigured = e instanceof IntegrationNotConfiguredError;
    const retryable = !notConfigured && (!(e instanceof ProviderError) || e.retryable);
    const retryAt = retryable ? nextRetryAt(attemptNumber) : null;
    const status = retryAt ? "queued" : "failed";
    await db.transaction(async (tx) => {
      await tx
        .update(notifications)
        .set({ status, attempts: attemptNumber, lastError: message.slice(0, 1000), nextAttemptAt: retryAt ?? new Date(), lockedAt: null, updatedAt: new Date(), provider: e instanceof ProviderError ? e.provider : null })
        .where(eq(notifications.id, n.id));
      await tx.insert(notificationDeliveryAttempts).values({
        notificationId: n.id,
        attemptNumber,
        status: "failed",
        provider: e instanceof ProviderError ? e.provider : null,
        error: message.slice(0, 1000),
        response: e instanceof ProviderError ? ((e.response as object) ?? null) : null,
      });
    });
    if (status === "failed") {
      await audit({ eventType: "notification.failed", targetType: "notification", targetId: n.id, metadata: { templateKey: n.templateKey, channel: n.channel, attempts: attemptNumber, error: message.slice(0, 300) }, ip: null });
    }
    return retryAt ? "retry" : "failed";
  }
}

/**
 * Claims due notifications with FOR UPDATE SKIP LOCKED so concurrent workers never send
 * the same message twice, then delivers them. Stale "sending" locks (>10 min) are reclaimed.
 */
export async function dispatchDue(limit = 50): Promise<{ sent: number; retry: number; failed: number }> {
  const claimed = await db.execute<NotificationRow>(sql`
    UPDATE notifications SET status = 'sending', locked_at = now(), updated_at = now()
    WHERE id IN (
      SELECT id FROM notifications
      WHERE channel <> 'in_app'
        AND ((status IN ('pending','queued') AND next_attempt_at <= now())
             OR (status = 'sending' AND locked_at < now() - interval '10 minutes'))
      ORDER BY next_attempt_at
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *`);
  const counts = { sent: 0, retry: 0, failed: 0 };
  for (const raw of claimed) {
    const n = mapRow(raw as unknown as Record<string, unknown>);
    const r = await processOne(n);
    counts[r]++;
  }
  return counts;
}

/** Sends a single notification immediately (used for verification/reset mail). Safe to call twice. */
export async function dispatchNow(id: string | null): Promise<void> {
  if (!id) return;
  const claimed = await db
    .update(notifications)
    .set({ status: "sending", lockedAt: new Date() })
    .where(and(eq(notifications.id, id), sql`${notifications.status} IN ('pending','queued')`))
    .returning();
  if (claimed[0]) await processOne(claimed[0]);
}

function mapRow(r: Record<string, unknown>): NotificationRow {
  const d = (v: unknown) => (v ? new Date(v as string) : null);
  return {
    id: r.id as string,
    userId: (r.user_id as string) ?? null,
    channel: r.channel as NotificationRow["channel"],
    templateKey: r.template_key as string,
    recipientEmail: (r.recipient_email as string) ?? null,
    recipientPhone: (r.recipient_phone as string) ?? null,
    subject: (r.subject as string) ?? null,
    body: r.body as string,
    actionUrl: (r.action_url as string) ?? null,
    data: r.data ?? null,
    idempotencyKey: r.idempotency_key as string,
    status: r.status as NotificationRow["status"],
    attempts: Number(r.attempts),
    nextAttemptAt: d(r.next_attempt_at)!,
    lockedAt: d(r.locked_at),
    lastError: (r.last_error as string) ?? null,
    provider: (r.provider as string) ?? null,
    providerMessageId: (r.provider_message_id as string) ?? null,
    readAt: d(r.read_at),
    sentAt: d(r.sent_at),
    deliveredAt: d(r.delivered_at),
    createdAt: d(r.created_at)!,
    updatedAt: d(r.updated_at)!,
  };
}

/* ------------------------------------------------------------------ */
/* Admin operations & receipts                                         */
/* ------------------------------------------------------------------ */

export async function retryNotification(id: string, actorId: string): Promise<void> {
  const [n] = await db.select().from(notifications).where(eq(notifications.id, id)).limit(1);
  if (!n) throw new Error("Notification not found");
  if (!["failed", "cancelled"].includes(n.status)) throw new Error("Only failed or cancelled notifications can be retried.");
  await db.update(notifications).set({ status: "pending", attempts: 0, nextAttemptAt: new Date(), lastError: null, updatedAt: new Date() }).where(eq(notifications.id, id));
  await audit({ eventType: "notification.manual_retry", actorId, actorRole: "admin", targetType: "notification", targetId: id, previousState: { status: n.status, attempts: n.attempts } });
  await dispatchNow(id);
}

export async function cancelNotification(id: string, actorId: string): Promise<void> {
  const res = await db
    .update(notifications)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(and(eq(notifications.id, id), sql`${notifications.status} IN ('pending','queued')`))
    .returning({ id: notifications.id });
  if (!res[0]) throw new Error("Only pending or queued notifications can be cancelled.");
  await audit({ eventType: "notification.cancelled", actorId, actorRole: "admin", targetType: "notification", targetId: id });
}

/** Applies a provider delivery receipt (webhook). */
export async function applyDeliveryReceipt(providerMessageId: string, outcome: "delivered" | "failed", detail: string | null, provider: string): Promise<boolean> {
  const [n] = await db.select().from(notifications).where(eq(notifications.providerMessageId, providerMessageId)).limit(1);
  if (!n) return false;
  await db.transaction(async (tx) => {
    await tx
      .update(notifications)
      .set(outcome === "delivered" ? { status: "delivered", deliveredAt: new Date(), updatedAt: new Date() } : { status: "failed", lastError: detail ?? "Provider reported delivery failure", updatedAt: new Date() })
      .where(eq(notifications.id, n.id));
    await tx.insert(notificationDeliveryAttempts).values({ notificationId: n.id, attemptNumber: n.attempts, status: outcome === "delivered" ? "delivered" : "bounced", provider, response: { detail } });
  });
  return true;
}

export function appUrl(path: string): string {
  return new URL(path, env.APP_URL).toString();
}

export { MAX_ATTEMPTS };
