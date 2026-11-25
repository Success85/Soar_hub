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

type Transport = { sendMail: (o: Record<string, unknown>) => Promise<{ messageId?: string; response?: string }> };
let smtpTransport: Transport | null = null;

/** SMTP, e.g. Gmail (smtp.gmail.com:465) with an App Password. Gmail sends as SMTP_USER, so EMAIL_FROM should use that address. */
async function smtp(m: EmailMessage): Promise<SendResult> {
  if (!smtpTransport) {
    const nodemailer = await import("nodemailer");
    smtpTransport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: (env.SMTP_PASSWORD ?? "").replace(/\s+/g, "") }, // Google shows App Passwords with spaces
      pool: true,
      maxConnections: 2,
    }) as unknown as Transport;
  }
  try {
    const info = await smtpTransport.sendMail({ from: env.EMAIL_FROM, to: m.to, subject: m.subject, text: m.text, html: m.html, headers: { "X-SOAR-Idempotency-Key": m.idempotencyKey.slice(0, 200) } });
    return { provider: "smtp", messageId: info.messageId ?? null, response: info.response };
  } catch (e) {
    const err = e as { code?: string; responseCode?: number; message?: string };
    if (err.responseCode === 535 || err.code === "EAUTH") {
      throw new ProviderError("smtp", "The SMTP server rejected the login. For Gmail, SMTP_PASSWORD must be a 16-character App Password (not your normal password) and SMTP_USER your full Gmail address.", false);
    }
    // 4xx replies and network errors are temporary (retry); 5xx replies are permanent.
    const retryable = !err.responseCode || (err.responseCode >= 400 && err.responseCode < 500);
    throw new ProviderError("smtp", `SMTP error${err.responseCode ? ` ${err.responseCode}` : ""}: ${(err.message ?? String(e)).slice(0, 300)}`, retryable);
  }
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

/** Development outbox (never in production): lets developers, demos and E2E tests open emailed links at /dev/mailbox. */
async function writeDevOutbox(m: EmailMessage, provider: string) {
  if (env.NODE_ENV === "production") return;
  const { appendFile, mkdir } = await import("node:fs/promises");
  const dir = `${process.cwd()}/${env.LOCAL_STORAGE_DIR}`;
  await mkdir(dir, { recursive: true });
  await appendFile(`${dir}/outbox.jsonl`, JSON.stringify({ at: new Date().toISOString(), to: m.to, subject: m.subject, text: m.text, provider }) + "\n");
}

async function consoleDev(m: EmailMessage): Promise<SendResult> {
  console.info(JSON.stringify({ level: "info", msg: "[dev email]", to: m.to, subject: m.subject, text: m.text }));
  await writeDevOutbox(m, "console");
  return { provider: "console", messageId: `console-${Date.now()}` };
}

export async function sendEmail(m: EmailMessage): Promise<SendResult> {
  switch (env.EMAIL_PROVIDER) {
    case "resend":
    case "sendgrid":
      if (!env.EMAIL_PROVIDER_API_KEY) throw new IntegrationNotConfiguredError("Email", "EMAIL_PROVIDER_API_KEY is not set");
      // In development, keep a copy so links still work when the provider refuses a recipient (e.g. Resend before domain verification).
      await writeDevOutbox(m, env.EMAIL_PROVIDER).catch(() => undefined);
      return env.EMAIL_PROVIDER === "resend" ? resend(m) : sendgrid(m);
    case "smtp":
      if (!env.SMTP_USER || !env.SMTP_PASSWORD) throw new IntegrationNotConfiguredError("Email", "SMTP_USER and SMTP_PASSWORD are not set");
      await writeDevOutbox(m, "smtp").catch(() => undefined);
      return smtp(m);
    case "console":
      return consoleDev(m);
    default:
      throw new IntegrationNotConfiguredError("Email", "EMAIL_PROVIDER is 'none'");
  }
}

export function emailStatus() {
  if (env.EMAIL_PROVIDER === "console") return { configured: true, provider: "Console (development only — emails are logged, not sent)", missing: [] as string[] };
  if (env.EMAIL_PROVIDER === "none") return { configured: false, provider: "None", missing: ["EMAIL_PROVIDER", "EMAIL_PROVIDER_API_KEY"] };
  if (env.EMAIL_PROVIDER === "smtp") {
    const missing = [!env.SMTP_USER && "SMTP_USER", !env.SMTP_PASSWORD && "SMTP_PASSWORD"].filter(Boolean) as string[];
    return { configured: missing.length === 0, provider: `SMTP (${env.SMTP_HOST}:${env.SMTP_PORT}${env.SMTP_USER ? `, as ${env.SMTP_USER}` : ""})`, missing };
  }
  const missing = env.EMAIL_PROVIDER_API_KEY ? [] : ["EMAIL_PROVIDER_API_KEY"];
  return { configured: missing.length === 0, provider: env.EMAIL_PROVIDER === "resend" ? "Resend" : "SendGrid", missing };
}
