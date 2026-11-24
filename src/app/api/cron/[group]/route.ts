import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/auth/tokens";
import { env } from "@/lib/env";
import { JOB_GROUPS, JOBS, runGroup, runJob, type JobName } from "@/lib/services/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Protected scheduler endpoint. Vercel Cron sends "Authorization: Bearer $CRON_SECRET".
 * /api/cron/frequent | hourly | daily — or a single job name.
 */
async function handle(req: Request, { params }: { params: Promise<{ group: string }> }) {
  const auth = req.headers.get("authorization") ?? "";
  if (!safeEqual(auth, `Bearer ${env.CRON_SECRET}`)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { group } = await params;
  if (group in JOB_GROUPS) return NextResponse.json({ group, results: await runGroup(group) });
  if (group in JOBS) return NextResponse.json(await runJob(group as JobName));
  return NextResponse.json({ error: "Unknown job" }, { status: 404 });
}

export const GET = handle;
export const POST = handle;
