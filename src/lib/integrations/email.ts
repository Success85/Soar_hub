import "server-only";
import { env } from "@/lib/env";
import { IntegrationNotConfiguredError, ProviderError } from "./errors";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  idempotencyKey: string;
}
export interface SendResult {
  provider: string;
  messageId: string | null;
  response?: unknown;
}

async function resend(m: EmailMessage): Promise<SendResult> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.EMAIL_PROVIDER_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": m.idempotencyKey.slice(0, 256) },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [m.to], subject: m.subject, text: m.text, html: m.html }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ProviderError("resend", `Resend error ${res.status}: ${JSON.stringify(body).slice(0, 300)}`, res.status >= 500 || res.status === 429, body);
  return { provider: "resend", messageId: (body as { id?: string }).id ?? null, response: body };
}

async function sendgrid(m: EmailMessage): Promise<SendResult> {
  const fromMatch = /^(.*)<(.+)>$/.exec(env.EMAIL_FROM);
  const from = fromMatch ? { name: fromMatch[1].trim(), email: fromMatch[2].trim() } : { email: env.EMAIL_FROM };
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.EMAIL_PROVIDER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: m.to }], custom_args: { idempotency_key: m.idempotencyKey.slice(0, 200) } }],
      from,
      subject: m.subject,
      content: [
        { type: "text/plain", value: m.text },
        { type: "text/html", value: m.html },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new ProviderError("sendgrid", `SendGrid error ${res.status}: ${text.slice(0, 300)}`, res.status >= 500 || res.status === 429);
  }
  return { provider: "sendgrid", messageId: res.headers.get("x-message-id") };
}

async function consoleDev(m: EmailMessage): Promise<SendResult> {
  console.info(JSON.stringify({ level: "info", msg: "[dev email]", to: m.to, subject: m.subject, text: m.text }));
  // Development outbox (never in production): lets developers and E2E tests open emailed links.
  const { appendFile, mkdir } = await import("node:fs/promises");
  const dir = `${process.cwd()}/${env.LOCAL_STORAGE_DIR}`;
  await mkdir(dir, { recursive: true });
  await appendFile(`${dir}/outbox.jsonl`, JSON.stringify({ at: new Date().toISOString(), to: m.to, subject: m.subject, text: m.text }) + "\n");
  return { provider: "console", messageId: `console-${Date.now()}` };
}

export async function sendEmail(m: EmailMessage): Promise<SendResult> {
  switch (env.EMAIL_PROVIDER) {
    case "resend":
    case "sendgrid":
      if (!env.EMAIL_PROVIDER_API_KEY) throw new IntegrationNotConfiguredError("Email", "EMAIL_PROVIDER_API_KEY is not set");
      return env.EMAIL_PROVIDER === "resend" ? resend(m) : sendgrid(m);
    case "console":
      return consoleDev(m);
    default:
      throw new IntegrationNotConfiguredError("Email", "EMAIL_PROVIDER is 'none'");
  }
}

export function emailStatus() {
  if (env.EMAIL_PROVIDER === "console") return { configured: true, provider: "Console (development only — emails are logged, not sent)", missing: [] as string[] };
  if (env.EMAIL_PROVIDER === "none") return { configured: false, provider: "None", missing: ["EMAIL_PROVIDER", "EMAIL_PROVIDER_API_KEY"] };
  const missing = env.EMAIL_PROVIDER_API_KEY ? [] : ["EMAIL_PROVIDER_API_KEY"];
  return { configured: missing.length === 0, provider: env.EMAIL_PROVIDER === "resend" ? "Resend" : "SendGrid", missing };
}
