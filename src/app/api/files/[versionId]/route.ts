import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { signedDownloadUrl } from "@/lib/services/documents";

/** Authorises access, then redirects to a short-lived signed URL. No permanent public URLs exist. */
export async function GET(req: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { versionId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(versionId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const inline = new URL(req.url).searchParams.get("inline") === "1";
    const url = await signedDownloadUrl(user, versionId, inline);
    return NextResponse.redirect(new URL(url, req.url), { status: 303, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    return NextResponse.json({ error: status === 404 ? "Not found" : "Unable to download" }, { status });
  }
}
