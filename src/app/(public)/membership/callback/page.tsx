import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { and, eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { payments } from "@/lib/db/schema";
import { confirmPayment, type ConfirmResult } from "@/lib/services/membership";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Payment status", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Flutterwave redirects here after checkout with ?status=&tx_ref=&transaction_id=. Nothing is trusted until verified. */
export default async function PaymentCallbackPage({ searchParams }: { searchParams: Promise<{ status?: string; tx_ref?: string; transaction_id?: string }> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  const txRef = (sp.tx_ref ?? "").slice(0, 80);
  let result: ConfirmResult | { outcome: "cancelled" | "unknown"; message: string };
  if (!txRef) {
    result = { outcome: "unknown", message: "We couldn't find a payment reference in the link." };
  } else if (sp.status === "cancelled") {
    await db.update(payments).set({ status: "cancelled", updatedAt: new Date() }).where(and(eq(payments.txRef, txRef), eq(payments.status, "pending")));
    result = { outcome: "cancelled", message: "You cancelled the payment. Nothing was charged." };
  } else if (!sp.transaction_id) {
    result = { outcome: "unknown", message: "The payment provider didn't send a transaction number. If you were charged, contact support with your reference." };
  } else {
    try {
      result = await confirmPayment(txRef, sp.transaction_id, "callback");
    } catch (e) {
      result = { outcome: "unknown", message: e instanceof NotFoundError ? "We couldn't find this payment." : "We couldn't confirm the payment right now. If you were charged, your membership will activate automatically within a few minutes; refresh this page." };
    }
  }
  const ok = result.outcome === "activated" || result.outcome === "already_active";
  const pending = result.outcome === "pending";
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
      {ok ? <CheckCircle2 className="mx-auto size-14 text-success-700" aria-hidden /> : pending ? <Clock className="mx-auto size-14 text-gold-600" aria-hidden /> : <XCircle className="mx-auto size-14 text-danger-700" aria-hidden />}
      <h1 className="mt-4 font-display text-3xl">{ok ? "Payment successful. Welcome!" : pending ? "Payment processing" : "Payment not completed"}</h1>
      <p className="mt-3 text-muted">
        {ok ? ("expiresAt" in result && result.expiresAt ? `Your membership is active until ${formatDate(result.expiresAt)}.` : "Your membership is active.") : "message" in result ? result.message : ""}
      </p>
      {txRef && <p className="mt-2 text-xs text-muted">Reference: <span className="font-mono">{txRef}</span></p>}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {ok ? (
          user ? <Button asChild size="lg"><Link href="/dashboard">Go to my dashboard</Link></Button> : <Button asChild size="lg"><Link href="/login?next=/dashboard">Sign in to continue</Link></Button>
        ) : (
          <>
            {pending && <Button asChild size="lg"><Link href={`/membership/callback?${new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][])}`}>Refresh</Link></Button>}
            <Button asChild size="lg" variant={pending ? "secondary" : "primary"}><Link href="/membership">Back to membership</Link></Button>
          </>
        )}
      </div>
    </div>
  );
}
