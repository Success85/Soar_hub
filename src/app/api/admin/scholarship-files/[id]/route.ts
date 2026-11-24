import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { scholarshipFiles } from "@/lib/db/schema";
import { storage } from "@/lib/integrations/storage";

/** Internal scholarship evidence files: admins with scholarships.manage only, via short-lived signed URL. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user?.permissions.has("scholarships.manage")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [f] = await db.select().from(scholarshipFiles).where(eq(scholarshipFiles.id, id)).limit(1);
  if (!f) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const url = await storage().signedUrl(f.storageKey, { expiresInSeconds: 120, filename: f.name, contentType: f.mimeType });
  return NextResponse.redirect(new URL(url, req.url), { status: 303, headers: { "Cache-Control": "no-store" } });
}
