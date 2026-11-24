import "server-only";
import { db, type DbOrTx } from "@/lib/db";
import { auditLogs, userActivity } from "@/lib/db/schema";
import { getRequestMeta } from "@/lib/request";

export interface AuditInput {
  eventType: string;
  actorId?: string | null;
  actorRole?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  previousState?: unknown;
  newState?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}

/** Writes an append-only audit record. Pass a transaction to make it atomic with the change. */
export async function audit(input: AuditInput, tx: DbOrTx = db): Promise<void> {
  const meta = input.ip !== undefined ? { ip: input.ip, userAgent: input.userAgent ?? null } : await getRequestMeta();
  await tx.insert(auditLogs).values({
    eventType: input.eventType,
    actorId: input.actorId ?? null,
    actorRole: input.actorRole ?? null,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    metadata: input.metadata ?? null,
    previousState: (input.previousState as object) ?? null,
    newState: (input.newState as object) ?? null,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
}

export async function trackActivity(
  eventType: string,
  opts: { userId?: string | null; entityType?: string; entityId?: string; metadata?: Record<string, unknown> } = {},
): Promise<void> {
  try {
    await db.insert(userActivity).values({
      eventType,
      userId: opts.userId ?? null,
      entityType: opts.entityType ?? null,
      entityId: opts.entityId ?? null,
      metadata: opts.metadata ?? null,
    });
  } catch (e) {
    console.warn(JSON.stringify({ level: "warn", msg: "activity tracking failed", error: String(e) }));
  }
}
