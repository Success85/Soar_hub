import "server-only";
import { headers } from "next/headers";

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

export async function getRequestMeta(): Promise<RequestMeta> {
  try {
    const h = await headers();
    const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim();
    return { ip: fwd || h.get("x-real-ip") || null, userAgent: h.get("user-agent")?.slice(0, 500) ?? null };
  } catch {
    return { ip: null, userAgent: null }; // outside a request (cron/worker/tests)
  }
}

export function metaFromRequest(req: Request): RequestMeta {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return { ip: fwd || req.headers.get("x-real-ip") || null, userAgent: req.headers.get("user-agent")?.slice(0, 500) ?? null };
}

/** CSRF defence for route handlers: same-origin requests only (server actions are checked by Next.js). */
export function assertSameOrigin(req: Request, appUrl: string) {
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients / same-origin navigations without Origin
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const allowed = new Set([new URL(appUrl).origin]);
  if (host) {
    allowed.add(`https://${host}`);
    allowed.add(`http://${host}`);
  }
  if (!allowed.has(origin)) {
    const err = new Error("Cross-origin request blocked") as Error & { status: number };
    err.status = 403;
    throw err;
  }
}
