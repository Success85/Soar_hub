/** Idempotency keys and retry policy for notification delivery (pure). */
export const RETRY_DELAYS_MINUTES = [5, 15, 60] as const;
export const MAX_ATTEMPTS = RETRY_DELAYS_MINUTES.length + 1; // initial attempt + 3 retries

export function idempotencyKey(parts: (string | number | null | undefined)[]): string {
  return parts.map((p) => String(p ?? "-").replace(/[^a-zA-Z0-9_.@-]/g, "_")).join(":").slice(0, 250);
}

/** Returns when to retry after `attempts` failed attempts, or null when retries are exhausted. */
export function nextRetryAt(attempts: number, now: Date = new Date()): Date | null {
  if (attempts >= MAX_ATTEMPTS) return null;
  const delay = RETRY_DELAYS_MINUTES[attempts - 1];
  if (delay === undefined) return null;
  return new Date(now.getTime() + delay * 60_000);
}

/** Days-before offsets at which milestone reminders are sent. */
export const MILESTONE_EMAIL_OFFSETS = [7, 1, 0] as const;
export const MILESTONE_SMS_OFFSET = 1;

export function renderTemplate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, k: string) => {
    const v = k.split(".").reduce<unknown>((acc, part) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[part] : undefined), vars);
    return v === undefined || v === null ? "" : String(v);
  });
}
