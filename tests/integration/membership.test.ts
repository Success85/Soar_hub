import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { memberships, payments, platformSettings } from "@/lib/db/schema";
import { makeUser } from "./helpers";

/** A fake Flutterwave API: the n-th checkout gets transaction id base+n (fw.id(n)), and /verify answers for it. */
function fakeFlutterwave(opts: { verifyStatus?: string; amountDelta?: number; currency?: string } = {}) {
  const checkouts: { tx_ref: string; amount: number; currency: string }[] = [];
  const base = 100_000 + Math.floor(Math.random() * 1_000_000_000);
  const calls: { url: string; body?: unknown }[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, body });
    if (url.endsWith("/payments")) {
      checkouts.push({ tx_ref: body.tx_ref, amount: body.amount, currency: body.currency });
      return new Response(JSON.stringify({ status: "success", data: { link: `https://checkout.flw.test/pay/${body.tx_ref}` } }));
    }
    const m = /\/transactions\/(\d+)\/verify$/.exec(url);
    const c = m ? checkouts[Number(m[1]) - base] : undefined;
    if (c) {
      return new Response(JSON.stringify({ status: "success", data: { id: Number(m![1]), tx_ref: c.tx_ref, status: opts.verifyStatus ?? "successful", amount: c.amount + (opts.amountDelta ?? 0), charged_amount: c.amount, currency: opts.currency ?? c.currency, payment_type: "card", customer: { email: "x@y.z" } } }));
    }
    return new Response(JSON.stringify({ status: "error", message: "not found" }), { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, calls, id: (n = 0) => String(base + n) };
}

const M = () => import("@/lib/services/membership");

beforeAll(async () => {
  await db.insert(platformSettings).values({ key: "membership_price_ngn", value: 5000 }).onConflictDoUpdate({ target: platformSettings.key, set: { value: 5000 } });
  await db.insert(platformSettings).values({ key: "membership_duration_months", value: 12 }).onConflictDoUpdate({ target: platformSettings.key, set: { value: 12 } });
  await db.insert(platformSettings).values({ key: "membership_required", value: true }).onConflictDoUpdate({ target: platformSettings.key, set: { value: true } });
});
afterEach(() => vi.unstubAllGlobals());

describe("membership payments (Flutterwave)", () => {
  it("applicants need a membership; staff don't", async () => {
    const { hasMemberAccess } = await M();
    const applicant = await makeUser(["applicant"]);
    const reviewer = await makeUser(["reviewer"]);
    expect(await hasMemberAccess(applicant.id, applicant.roles)).toBe(false);
    expect(await hasMemberAccess(reviewer.id, reviewer.roles)).toBe(true);
  });

  it("checkout → verified payment → 12-month membership; repeat confirmation is idempotent", async () => {
    const { startMembershipCheckout, confirmPayment, hasMemberAccess, membershipState } = await M();
    const fw = fakeFlutterwave();
    const user = await makeUser(["applicant"]);
    const { link, txRef } = await startMembershipCheckout(user);
    expect(link).toContain(txRef);
    const sent = fw.calls[0].body as { amount: number; currency: string; customer: { email: string }; redirect_url: string };
    expect(sent).toMatchObject({ amount: 5000, currency: "NGN", customer: { email: user.email } });
    expect(sent.redirect_url).toMatch(/\/membership\/callback$/);

    const r1 = await confirmPayment(txRef, fw.id(0), "callback");
    expect(r1.outcome).toBe("activated");
    const r2 = await confirmPayment(txRef, fw.id(0), "webhook");
    expect(r2.outcome).toBe("already_active");
    expect((await db.select().from(memberships).where(eq(memberships.userId, user.id))).length).toBe(1);

    expect(await hasMemberAccess(user.id, user.roles)).toBe(true);
    const st = await membershipState(user.id);
    const months = (st.expiresAt!.getTime() - Date.now()) / (30.44 * 86_400_000);
    expect(months).toBeGreaterThan(11.8);
    expect(months).toBeLessThan(12.2);
    const [p] = await db.select().from(payments).where(eq(payments.txRef, txRef));
    expect(p).toMatchObject({ status: "successful", providerTransactionId: fw.id(0), paymentMethod: "card" });
  });

  it("renewing adds the new period after the current end date", async () => {
    const { startMembershipCheckout, confirmPayment, membershipState } = await M();
    const fw = fakeFlutterwave();
    const user = await makeUser(["applicant"]);
    const a = await startMembershipCheckout(user);
    await confirmPayment(a.txRef, fw.id(0), "callback");
    const first = (await membershipState(user.id)).expiresAt!;
    const b = await startMembershipCheckout(user);
    await confirmPayment(b.txRef, fw.id(1), "callback");
    const second = (await membershipState(user.id)).expiresAt!;
    const gapMonths = (second.getTime() - first.getTime()) / (30.44 * 86_400_000);
    expect(gapMonths).toBeGreaterThan(11.8);
    expect(gapMonths).toBeLessThan(12.2);
  });

  it("rejects an underpaid or wrong-currency payment and a failed charge", async () => {
    const { startMembershipCheckout, confirmPayment, hasMemberAccess } = await M();
    const user = await makeUser(["applicant"]);
    let fw = fakeFlutterwave({ amountDelta: -4000 });
    const a = await startMembershipCheckout(user);
    expect((await confirmPayment(a.txRef, fw.id(0), "callback")).outcome).toBe("mismatch");

    fw = fakeFlutterwave({ currency: "USD" });
    const b = await startMembershipCheckout(user);
    expect((await confirmPayment(b.txRef, fw.id(0), "callback")).outcome).toBe("mismatch");

    fw = fakeFlutterwave({ verifyStatus: "failed" });
    const c = await startMembershipCheckout(user);
    expect((await confirmPayment(c.txRef, fw.id(0), "callback")).outcome).toBe("failed");

    // someone else's real, successful transaction can't be used to pay for this order
    fw = fakeFlutterwave();
    const other = await makeUser(["applicant"]);
    const o = await startMembershipCheckout(other);
    const d = await startMembershipCheckout(user);
    expect((await confirmPayment(o.txRef, fw.id(0), "callback")).outcome).toBe("activated");
    expect((await confirmPayment(d.txRef, fw.id(0), "callback")).outcome).toBe("mismatch");

    expect(await hasMemberAccess(user.id, user.roles)).toBe(false);
  });

  it("admins can grant (and revoke) membership without payment", async () => {
    const { grantMembership, revokeMemberships, hasMemberAccess } = await M();
    const admin = await makeUser(["admin"]);
    const user = await makeUser(["applicant"]);
    await grantMembership(admin, user.id, 6, "sponsored");
    expect(await hasMemberAccess(user.id, user.roles)).toBe(true);
    await revokeMemberships(admin, user.id, "test");
    expect(await hasMemberAccess(user.id, user.roles)).toBe(false);
  });

  it("the paywall can be switched off in settings", async () => {
    const { hasMemberAccess } = await M();
    const user = await makeUser(["applicant"]);
    await db.update(platformSettings).set({ value: false }).where(eq(platformSettings.key, "membership_required"));
    try {
      // getSettings is cached per request (React cache) - outside Next it re-reads each call
      expect(await hasMemberAccess(user.id, user.roles)).toBe(true);
    } finally {
      await db.update(platformSettings).set({ value: true }).where(eq(platformSettings.key, "membership_required"));
    }
  });
});

describe("Flutterwave webhook signature", () => {
  it("accepts only the configured secret hash", async () => {
    const { webhookSignatureValid } = await import("@/lib/integrations/flutterwave");
    expect(webhookSignatureValid("test-webhook-hash")).toBe(true);
    expect(webhookSignatureValid("wrong")).toBe(false);
    expect(webhookSignatureValid(null)).toBe(false);
  });
});
