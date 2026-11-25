import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { memberships, payments, users } from "@/lib/db/schema";
import { AppError, NotFoundError } from "@/lib/errors";
import { createCheckout, verifyTransaction, type VerifiedTransaction } from "@/lib/integrations/flutterwave";
import type { CurrentUser } from "@/lib/auth/session";
import { audit } from "./audit";
import { appUrl } from "./notifications";
import { getSettings } from "./settings";

/** Staff never need a membership; applicants do while the paywall is switched on. */
const EXEMPT_ROLES = new Set(["super_admin", "admin", "reviewer"]);

export function isExemptFromMembership(roles: readonly string[]): boolean {
  return roles.some((r) => EXEMPT_ROLES.has(r));
}

export interface MembershipState {
  active: boolean;
  expiresAt: Date | null;
  lifetime: boolean;
  source: string | null;
}

export async function membershipState(userId: string): Promise<MembershipState> {
  const now = new Date();
  const [m] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.userId, userId), isNull(memberships.revokedAt), lte(memberships.startsAt, now), or(isNull(memberships.expiresAt), gt(memberships.expiresAt, now))))
    .orderBy(sql`${memberships.expiresAt} DESC NULLS FIRST`)
    .limit(1);
  if (!m) return { active: false, expiresAt: null, lifetime: false, source: null };
  const end = await currentEnd(db, userId);
  return { active: true, expiresAt: end instanceof Date ? end : null, lifetime: end === "lifetime", source: m.source };
}

/** True when this user may use member-only features. */
export async function hasMemberAccess(userId: string, roles: readonly string[]): Promise<boolean> {
  if (isExemptFromMembership(roles)) return true;
  if (!(await getSettings()).membership_required) return true;
  return (await membershipState(userId)).active;
}

function addMonths(d: Date, months: number): Date {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + months);
  return r;
}

/** Latest expiry among active memberships, so renewals extend rather than overlap. */
async function currentEnd(tx: typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0], userId: string): Promise<Date | "lifetime" | null> {
  const rows = await tx.select({ expiresAt: memberships.expiresAt }).from(memberships).where(and(eq(memberships.userId, userId), isNull(memberships.revokedAt)));
  if (rows.some((r) => r.expiresAt === null)) return "lifetime";
  const now = Date.now();
  const future = rows.map((r) => r.expiresAt!).filter((d) => d.getTime() > now);
  return future.length ? new Date(Math.max(...future.map((d) => d.getTime()))) : null;
}

export async function startMembershipCheckout(user: CurrentUser): Promise<{ link: string; txRef: string }> {
  if (isExemptFromMembership(user.roles)) throw new AppError("Staff accounts don't need a membership.", 400);
  const s = await getSettings();
  const state = await membershipState(user.id);
  if (state.lifetime) throw new AppError("You already have lifetime membership.", 409);
  const amount = Number(s.membership_price_ngn);
  if (!Number.isFinite(amount) || amount < 100) throw new AppError("Membership price isn't set correctly. Please contact support.", 500);
  const months = Math.max(0, Math.floor(Number(s.membership_duration_months)));
  const txRef = `SOAR-${Date.now().toString(36).toUpperCase()}-${randomBytes(5).toString("hex").toUpperCase()}`;
  await db.insert(payments).values({ userId: user.id, txRef, amount: amount.toFixed(2), currency: "NGN", membershipMonths: months });
  try {
    const { link } = await createCheckout({
      txRef,
      amount,
      currency: "NGN",
      redirectUrl: appUrl("/membership/callback"),
      customer: { email: user.email, name: `${user.firstName} ${user.lastName}` },
      title: `${s.platform_name} membership`,
      description: months === 0 ? "Lifetime access to every SOAR Hub feature" : `${months}-month access to every SOAR Hub feature`,
      meta: { userId: user.id, memberCode: user.memberCode ?? "" },
    });
    await audit({ eventType: "payment.checkout_started", actorId: user.id, targetType: "payment", targetId: txRef, metadata: { amount, months } });
    return { link, txRef };
  } catch (e) {
    await db.update(payments).set({ status: "failed", failureReason: e instanceof Error ? e.message.slice(0, 500) : String(e), updatedAt: new Date() }).where(eq(payments.txRef, txRef));
    throw e;
  }
}

export type ConfirmResult =
  | { outcome: "activated" | "already_active"; expiresAt: Date | null; paymentId: string }
  | { outcome: "failed" | "pending" | "mismatch"; message: string };

/**
 * Confirms a payment with Flutterwave and activates (or extends) the membership. Idempotent and safe to run
 * concurrently: the redirect callback and the webhook may both arrive for the same payment.
 */
export async function confirmPayment(txRef: string, transactionId: string, via: "callback" | "webhook" | "admin"): Promise<ConfirmResult> {
  const [p] = await db.select().from(payments).where(eq(payments.txRef, txRef)).limit(1);
  if (!p) throw new NotFoundError("Payment");
  if (p.status === "successful") {
    const [m] = await db.select({ expiresAt: memberships.expiresAt }).from(memberships).where(eq(memberships.paymentId, p.id)).limit(1);
    return { outcome: "already_active", expiresAt: m?.expiresAt ?? null, paymentId: p.id };
  }
  const t: VerifiedTransaction = await verifyTransaction(transactionId);

  const expected = Number(p.amount);
  const problems: string[] = [];
  if (t.txRef !== p.txRef) problems.push("reference does not match");
  if (t.currency !== p.currency) problems.push(`currency ${t.currency} instead of ${p.currency}`);
  if (t.amount + 0.001 < expected) problems.push(`amount ${t.amount} is less than ${expected}`);
  const [reused] = await db.select({ id: payments.id }).from(payments).where(and(eq(payments.provider, "flutterwave"), eq(payments.providerTransactionId, String(t.id)))).limit(1);
  if (reused && reused.id !== p.id) problems.push("transaction already used for another payment");
  if (problems.length) {
    // The transaction id is stored only on success: a mismatched id may belong to someone else's payment.
    await db.update(payments).set({ status: "failed", failureReason: `Verification failed: ${problems.join("; ")} (Flutterwave transaction ${t.id})`, providerResponse: t.raw as object, updatedAt: new Date() }).where(and(eq(payments.id, p.id), eq(payments.status, "pending")));
    await audit({ eventType: "payment.verification_mismatch", actorRole: "system", targetType: "payment", targetId: p.id, metadata: { via, problems }, ip: null });
    return { outcome: "mismatch", message: "We couldn't match this payment to your order. If you were charged, contact support with your reference." };
  }
  if (t.status !== "successful") {
    const final = t.status === "failed" || t.status === "cancelled";
    if (final) await db.update(payments).set({ status: t.status === "cancelled" ? "cancelled" : "failed", providerResponse: t.raw as object, failureReason: `Flutterwave status: ${t.status} (transaction ${t.id})`, updatedAt: new Date() }).where(and(eq(payments.id, p.id), eq(payments.status, "pending")));
    return final ? { outcome: "failed", message: "The payment did not go through. You have not been charged; you can try again." } : { outcome: "pending", message: "Your payment is still being processed. This page will update once Flutterwave confirms it." };
  }

  return db.transaction(async (tx) => {
    // Row lock: whichever of callback/webhook gets here first activates; the other sees "successful".
    const [locked] = await tx.select().from(payments).where(eq(payments.id, p.id)).for("update").limit(1);
    if (locked.status === "successful") {
      const [m] = await tx.select({ expiresAt: memberships.expiresAt }).from(memberships).where(eq(memberships.paymentId, p.id)).limit(1);
      return { outcome: "already_active" as const, expiresAt: m?.expiresAt ?? null, paymentId: p.id };
    }
    const now = new Date();
    await tx.update(payments).set({ status: "successful", paidAt: now, providerTransactionId: String(t.id), paymentMethod: t.paymentType, providerResponse: t.raw as object, failureReason: null, updatedAt: now }).where(eq(payments.id, p.id));
    const end = await currentEnd(tx, p.userId);
    const startsAt = end instanceof Date ? end : now;
    const expiresAt = end === "lifetime" || locked.membershipMonths === 0 ? null : addMonths(startsAt, locked.membershipMonths);
    await tx.insert(memberships).values({ userId: p.userId, startsAt: end === "lifetime" ? now : startsAt, expiresAt, source: "flutterwave", paymentId: p.id });
    await audit({ eventType: "payment.succeeded", actorId: p.userId, actorRole: "applicant", targetType: "payment", targetId: p.id, metadata: { via, amount: t.amount, currency: t.currency, method: t.paymentType, transactionId: t.id, expiresAt: expiresAt?.toISOString() ?? "lifetime" }, ip: null }, tx);
    return { outcome: "activated" as const, expiresAt, paymentId: p.id };
  });
}

export async function grantMembership(admin: CurrentUser, userId: string, months: number, note: string | null) {
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!u) throw new NotFoundError("User");
  if (!Number.isInteger(months) || months < 0 || months > 120) throw new AppError("Choose between 1 and 120 months, or 0 for lifetime.", 400);
  const now = new Date();
  const end = await currentEnd(db, userId);
  if (end === "lifetime") throw new AppError("This member already has lifetime access.", 409);
  const startsAt = end instanceof Date ? end : now;
  const expiresAt = months === 0 ? null : addMonths(startsAt, months);
  const [m] = await db.insert(memberships).values({ userId, startsAt, expiresAt, source: "admin_grant", grantedBy: admin.id, note }).returning();
  await audit({ eventType: "membership.granted", actorId: admin.id, actorRole: "admin", targetType: "user", targetId: userId, metadata: { months, expiresAt: expiresAt?.toISOString() ?? "lifetime", note } });
  return m;
}

export async function revokeMemberships(admin: CurrentUser, userId: string, note: string | null) {
  await db.update(memberships).set({ revokedAt: new Date(), note }).where(and(eq(memberships.userId, userId), isNull(memberships.revokedAt)));
  await audit({ eventType: "membership.revoked", actorId: admin.id, actorRole: "admin", targetType: "user", targetId: userId, metadata: { note } });
}

export async function paymentsForUser(userId: string) {
  return db.select().from(payments).where(eq(payments.userId, userId)).orderBy(desc(payments.createdAt)).limit(50);
}

export async function membershipsForUser(userId: string) {
  return db.select().from(memberships).where(eq(memberships.userId, userId)).orderBy(desc(memberships.createdAt)).limit(50);
}

export async function listPayments(f: { status?: string; q?: string; page?: number }) {
  const page = Math.max(1, f.page ?? 1);
  const conds = [
    f.status ? eq(payments.status, f.status) : undefined,
    f.q ? or(sql`${users.email} ILIKE ${"%" + f.q + "%"}`, sql`${payments.txRef} ILIKE ${"%" + f.q + "%"}`, sql`${users.memberCode} ILIKE ${"%" + f.q + "%"}`) : undefined,
  ].filter(Boolean);
  const where = conds.length ? and(...(conds as Parameters<typeof and>)) : undefined;
  const rows = await db
    .select({ p: payments, u: { id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email, memberCode: users.memberCode } })
    .from(payments)
    .innerJoin(users, eq(users.id, payments.userId))
    .where(where)
    .orderBy(desc(payments.createdAt))
    .limit(50)
    .offset((page - 1) * 50);
  const [totals] = await db
    .select({
      count: sql<number>`count(*)::int`,
      revenue: sql<string>`coalesce(sum(${payments.amount}) filter (where ${payments.status} = 'successful'), 0)::text`,
      successful: sql<number>`count(*) filter (where ${payments.status} = 'successful')::int`,
    })
    .from(payments)
    .innerJoin(users, eq(users.id, payments.userId))
    .where(where);
  const [active] = await db.select({ c: sql<number>`count(distinct ${memberships.userId})::int` }).from(memberships).where(and(isNull(memberships.revokedAt), or(isNull(memberships.expiresAt), gt(memberships.expiresAt, new Date()))));
  return { rows, total: totals.count, revenue: Number(totals.revenue), successful: totals.successful, activeMembers: active.c, page };
}
