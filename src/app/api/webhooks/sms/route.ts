import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/auth/tokens";
import { env } from "@/lib/env";
import { applyDeliveryReceipt } from "@/lib/services/notifications";

/** Africa's Talking delivery reports (form-encoded). Configure the callback URL with ?secret=SMS_WEBHOOK_SECRET. */
export async function POST(req: Request) {
  if (!env.SMS_WEBHOOK_SECRET) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  if (!safeEqual(new URL(req.url).searchParams.get("secret") ?? "", env.SMS_WEBHOOK_SECRET)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const form = await req.formData();
  const id = String(form.get("id") ?? "");
  const status = String(form.get("status") ?? "");
  if (id) {
    if (status === "Success") await applyDeliveryReceipt(id, "delivered", null, "africastalking");
    else if (["Failed", "Rejected"].includes(status)) await applyDeliveryReceipt(id, "failed", String(form.get("failureReason") ?? status), "africastalking");
  }
  return NextResponse.json({ ok: true });
}
