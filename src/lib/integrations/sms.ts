import "server-only";
import { env } from "@/lib/env";
import { IntegrationNotConfiguredError, ProviderError } from "./errors";
import type { SendResult } from "./email";

/** Normalises Nigerian numbers to E.164 (+234...). Returns null when invalid. */
export function normalisePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let p = raw.replace(/[\s().-]/g, "");
  if (p.startsWith("00")) p = "+" + p.slice(2);
  if (/^0\d{10}$/.test(p)) p = "+234" + p.slice(1);
  if (/^234\d{10}$/.test(p)) p = "+" + p;
  return /^\+\d{10,15}$/.test(p) ? p : null;
}

async function africasTalking(to: string, message: string): Promise<SendResult> {
  const sandbox = env.SMS_PROVIDER_USERNAME === "sandbox";
  const url = `https://api.${sandbox ? "sandbox." : ""}africastalking.com/version1/messaging`;
  const form = new URLSearchParams({ username: env.SMS_PROVIDER_USERNAME!, to, message });
  if (env.SMS_SENDER_ID) form.set("from", env.SMS_SENDER_ID);
  const res = await fetch(url, {
    method: "POST",
    headers: { apiKey: env.SMS_PROVIDER_API_KEY!, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const body = (await res.json().catch(() => ({}))) as { SMSMessageData?: { Recipients?: { status: string; messageId: string; statusCode: number }[] } };
  if (!res.ok) throw new ProviderError("africastalking", `Africa's Talking error ${res.status}`, res.status >= 500, body);
  const r = body.SMSMessageData?.Recipients?.[0];
  if (!r || ![100, 101, 102].includes(r.statusCode)) {
    throw new ProviderError("africastalking", `SMS rejected: ${r?.status ?? "no recipient"}`, r?.statusCode === 500, body);
  }
  return { provider: "africastalking", messageId: r.messageId, response: body };
}

export async function sendSms(to: string, message: string): Promise<SendResult> {
  if (env.SMS_PROVIDER === "console") {
    console.info(JSON.stringify({ level: "info", msg: "[dev sms]", to, message }));
    return { provider: "console", messageId: `console-${Date.now()}` };
  }
  if (env.SMS_PROVIDER !== "africastalking") throw new IntegrationNotConfiguredError("SMS", "SMS_PROVIDER is 'none'");
  if (!env.SMS_PROVIDER_API_KEY || !env.SMS_PROVIDER_USERNAME) throw new IntegrationNotConfiguredError("SMS", "SMS_PROVIDER_API_KEY and SMS_PROVIDER_USERNAME are required");
  return africasTalking(to, message.slice(0, 459));
}

export function smsStatus() {
  if (env.SMS_PROVIDER === "console") return { configured: true, provider: "Console (development only)", missing: [] as string[] };
  if (env.SMS_PROVIDER === "none") return { configured: false, provider: "None: SMS is switched off", missing: ["SMS_PROVIDER", "SMS_PROVIDER_API_KEY", "SMS_PROVIDER_USERNAME"] };
  const missing = ["SMS_PROVIDER_API_KEY", "SMS_PROVIDER_USERNAME"].filter((k) => !process.env[k]);
  return { configured: missing.length === 0, provider: "Africa's Talking", missing };
}
