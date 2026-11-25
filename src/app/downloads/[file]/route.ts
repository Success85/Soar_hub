import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";

/** Member-only sample documents (content/downloads). Previews stay public in /public/previews. */
const DIR = path.join(process.cwd(), "content", "downloads");
const TYPES: Record<string, string> = { ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };

export async function GET(req: NextRequest, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const name = path.basename(file);
  const type = TYPES[path.extname(name).toLowerCase()];
  if (name !== file || !type || !/^[a-z0-9][a-z0-9._-]{0,100}$/i.test(name)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const user = await getCurrentUser();
  if (!user || !user.emailVerified || user.memberAccess === false) {
    return NextResponse.redirect(new URL(`/membership?next=${encodeURIComponent(req.nextUrl.pathname)}`, req.url));
  }
  let data: Buffer;
  try {
    data = await readFile(path.join(DIR, name));
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const download = req.nextUrl.searchParams.get("download") === "1";
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": type,
      "Content-Length": String(data.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name}"`,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
