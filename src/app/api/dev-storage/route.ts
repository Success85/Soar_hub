import { NextResponse } from "next/server";
import { signPayload, safeEqual } from "@/lib/auth/tokens";
import { isProd } from "@/lib/env";
import { storage } from "@/lib/integrations/storage";

/** Development-only signed download endpoint for the local storage driver. Disabled in production. */
export async function GET(req: Request) {
  if (isProd) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const q = new URL(req.url).searchParams;
  const key = q.get("key") ?? "";
  const exp = Number(q.get("exp"));
  const fn = q.get("fn") ?? "file";
  const ct = q.get("ct") ?? "application/octet-stream";
  const inl = q.get("inl") === "1";
  const expected = signPayload(`${key}|${exp}|${fn}|${ct}|${inl ? 1 : 0}`);
  if (!safeEqual(expected, q.get("sig") ?? "") || !exp || exp < Date.now() / 1000) return NextResponse.json({ error: "Link expired or invalid" }, { status: 403 });
  try {
    const buf = await storage().get(key);
    return new NextResponse(new Uint8Array(buf), {
      headers: { "Content-Type": ct, "Content-Disposition": `${inl ? "inline" : "attachment"}; filename="${fn.replace(/["\\\r\n]/g, "_")}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
