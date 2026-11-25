import "server-only";
import { env } from "@/lib/env";
import { IntegrationNotConfiguredError, ProviderError } from "./errors";

/**
 * Flutterwave Standard (hosted checkout), API v3.
 *  1. POST /payments → a hosted payment link; the customer pays there (card, bank transfer, USSD…).
 *  2. Flutterwave redirects back to redirect_url with ?status=&tx_ref=&transaction_id=.
 *  3. We ALWAYS confirm with GET /transactions/{id}/verify before granting anything; the redirect
 *     query string and webhook bodies are never trusted on their own.
 */

export function flutterwaveStatus() {
  const missing = [!env.FLW_SECRET_KEY && "FLW_SECRET_KEY", !env.FLW_SECRET_HASH && "FLW_SECRET_HASH (webhook)"].filter(Boolean) as string[];
  const mode = env.FLW_SECRET_KEY?.includes("_TEST") ? "test mode" : env.FLW_SECRET_KEY ? "live mode" : "";
  return { configured: !!env.FLW_SECRET_KEY, provider: `Flutterwave${mode ? ` (${mode})` : ""}`, missing };
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!env.FLW_SECRET_KEY) throw new IntegrationNotConfiguredError("Payments", "FLW_SECRET_KEY is not set");
  let res: Response;
  try {
    res = await fetch(`${env.FLW_API_BASE}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${env.FLW_SECRET_KEY}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    throw new ProviderError("flutterwave", `Could not reach Flutterwave: ${e instanceof Error ? e.message : String(e)}`, true);
  }
  const body = (await res.json().catch(() => ({}))) as { status?: string; message?: string };
  if (!res.ok || body.status !== "success") {
    throw new ProviderError("flutterwave", `Flutterwave error ${res.status}: ${body.message ?? "unknown error"}`.slice(0, 300), res.status >= 500 || res.status === 429, body);
  }
  return body as T;
}

export interface CheckoutInput {
  txRef: string;
  amount: number;
  currency: "NGN";
  redirectUrl: string;
  customer: { email: string; name: string };
  title: string;
  description: string;
  logoUrl?: string;
  meta?: Record<string, string>;
}

export async function createCheckout(i: CheckoutInput): Promise<{ link: string }> {
  const body = await call<{ data?: { link?: string } }>("/payments", {
    method: "POST",
    body: JSON.stringify({
      tx_ref: i.txRef,
      amount: i.amount,
      currency: i.currency,
      redirect_url: i.redirectUrl,
      customer: { email: i.customer.email, name: i.customer.name },
      customizations: { title: i.title, description: i.description, ...(i.logoUrl ? { logo: i.logoUrl } : {}) },
      meta: i.meta,
    }),
  });
  if (!body.data?.link) throw new ProviderError("flutterwave", "Flutterwave did not return a payment link.", true, body);
  return { link: body.data.link };
}

export interface VerifiedTransaction {
  id: number;
  txRef: string;
  status: string; // "successful" | "failed" | "pending" ...
  amount: number;
  chargedAmount: number;
  currency: string;
  paymentType: string | null;
  customerEmail: string | null;
  raw: unknown;
}

export async function verifyTransaction(transactionId: string | number): Promise<VerifiedTransaction> {
  if (!/^\d{1,20}$/.test(String(transactionId))) throw new ProviderError("flutterwave", "Invalid transaction id.", false);
  const body = await call<{ data?: Record<string, unknown> }>(`/transactions/${transactionId}/verify`);
  const d = body.data ?? {};
  return {
    id: Number(d.id),
    txRef: String(d.tx_ref ?? ""),
    status: String(d.status ?? ""),
    amount: Number(d.amount ?? 0),
    chargedAmount: Number(d.charged_amount ?? d.amount ?? 0),
    currency: String(d.currency ?? ""),
    paymentType: (d.payment_type as string) ?? null,
    customerEmail: ((d.customer as { email?: string } | undefined)?.email as string) ?? null,
    raw: body,
  };
}

/** Webhooks carry the secret hash you set in the Flutterwave dashboard in the `verif-hash` header. */
export function webhookSignatureValid(header: string | null): boolean {
  if (!env.FLW_SECRET_HASH || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(env.FLW_SECRET_HASH);
  if (a.length !== b.length) return false;
  // constant-time comparison
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
