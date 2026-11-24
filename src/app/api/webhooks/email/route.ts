import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/auth/tokens";
import { env } from "@/lib/env";
import { applyDeliveryReceipt } from "@/lib/services/notifications";

/**
 * Delivery receipts.
 * - Resend (Svix-signed): verifies svix-id/svix-timestamp/svix-signature with EMAIL_WEBHOOK_SECRET ("whsec_…").
 * - SendGrid Event Webhook: protect with ?secret=EMAIL_WEBHOOK_SECRET on the configured URL.
 */
export async function POST(req: Request) {
  if (!env.EMAIL_WEBHOOK_SECRET) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  const raw = await req.text();
  const svixId = req.headers.get("svix-id");
  if (svixId) {
    const ts = req.headers.get("svix-timestamp") ?? "";
    const sigs = (req.headers.get("svix-signature") ?? "").split(" ").map((s) => s.split(",")[1]).filter(Boolean);
    const key = Buffer.from(env.EMAIL_WEBHOOK_SECRET.replace(/^whsec_/, ""), "base64");
    const expected = createHmac("sha256", key).update(`${svixId}.${ts}.${raw}`).digest("base64");
    if (!sigs.some((s) => safeEqual(s, expected)) || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    const evt = JSON.parse(raw) as { type: string; data: { email_id: string } };
    if (evt.type === "email.delivered") await applyDeliveryReceipt(evt.data.email_id, "delivered", null, "resend");
    if (evt.type === "email.bounced" || evt.type === "email.complained") await applyDeliveryReceipt(evt.data.email_id, "failed", evt.type, "resend");
    return NextResponse.json({ ok: true });
  }
  if (!safeEqual(new URL(req.url).searchParams.get("secret") ?? "", env.EMAIL_WEBHOOK_SECRET)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const events = JSON.parse(raw) as { event: string; sg_message_id?: string; reason?: string }[];
  for (const e of Array.isArray(events) ? events : []) {
    const id = e.sg_message_id?.split(".")[0];
    if (!id) continue;
    if (e.event === "delivered") await applyDeliveryReceipt(id, "delivered", null, "sendgrid");
    if (["bounce", "dropped"].includes(e.event)) await applyDeliveryReceipt(id, "failed", e.reason ?? e.event, "sendgrid");
  }
  return NextResponse.json({ ok: true });
}
