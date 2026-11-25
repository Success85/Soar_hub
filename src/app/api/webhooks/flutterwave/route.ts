import { NextResponse, type NextRequest } from "next/server";
import { webhookSignatureValid } from "@/lib/integrations/flutterwave";
import { NotFoundError } from "@/lib/errors";
import { confirmPayment } from "@/lib/services/membership";

/**
 * Flutterwave webhook (Dashboard → Settings → Webhooks → URL https://<your-domain>/api/webhooks/flutterwave,
 * with a secret hash that must equal FLW_SECRET_HASH). The body is only a hint: the payment is re-verified with
 * the Flutterwave API before anything is granted, so a forged body can't activate a membership.
 */
export async function POST(req: NextRequest) {
  if (!webhookSignatureValid(req.headers.get("verif-hash"))) return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { event?: string; data?: { id?: number | string; tx_ref?: string; status?: string } } | null;
  const txRef = body?.data?.tx_ref;
  const id = body?.data?.id;
  if (!txRef || !id || (body?.event && body.event !== "charge.completed")) return NextResponse.json({ ignored: true });
  try {
    const r = await confirmPayment(String(txRef), String(id), "webhook");
    return NextResponse.json({ ok: true, outcome: r.outcome });
  } catch (e) {
    if (e instanceof NotFoundError) return NextResponse.json({ ignored: true, reason: "unknown tx_ref" });
    // Non-2xx makes Flutterwave retry later (e.g. if their verify API was briefly unreachable).
    console.error(JSON.stringify({ level: "error", msg: "flutterwave webhook failed", error: e instanceof Error ? e.message : String(e) }));
    return NextResponse.json({ error: "temporary failure" }, { status: 503 });
  }
}
