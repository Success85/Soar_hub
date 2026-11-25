import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { listApplicants } from "@/lib/services/admin";
import { analytics, toCsv } from "@/lib/services/analytics";
import { audit } from "@/lib/services/audit";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

/** CSV exports. Sensitive columns are only included for holders of exports.sensitive. */
export async function GET(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.permissions.has("exports.basic")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { kind } = await params;
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const sensitive = sp.sensitive === "1" && user.permissions.has("exports.sensitive");
  let csv = "";
  if (kind === "applicants") {
    const { rows } = await listApplicants({ ...sp, page: 1, completion: sp.completion as never }, { limit: 10000 });
    let out: Record<string, unknown>[] = rows.map((r) => ({ id: r.id, member_id: r.member_code, first_name: r.first_name, last_name: r.last_name, email: r.email, registered: r.created_at, verified: !!r.email_verified_at, profile_completion: r.completion, applications: r.applications, submitted: r.submitted, latest_status: r.latest_status, state_of_origin: r.state_of_origin, education_level: r.education_level }));
    if (sensitive && rows.length) {
      const extra = await db.execute<{ user_id: string; date_of_birth: string; gender: string; household_income_band: string; has_disability: boolean; is_refugee_or_displaced: boolean; phone: string }>(sql`SELECT user_id, date_of_birth, gender, household_income_band, has_disability, is_refugee_or_displaced, phone FROM profiles WHERE user_id IN ${rows.map((r) => r.id)}`);
      const map = new Map([...extra].map((e) => [e.user_id, e]));
      out = out.map((o) => ({ ...o, ...(map.get(o.id as string) ?? {}), user_id: undefined }));
    }
    csv = toCsv(out);
  } else if (kind === "analytics") {
    if (!user.permissions.has("analytics.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const today = new Date().toISOString().slice(0, 10);
    const a = await analytics({ from: sp.from ?? new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10), to: sp.to ?? today, scholarshipId: sp.scholarshipId || undefined, institution: sp.institution || undefined, status: sp.status || undefined, cohort: sp.cohort || undefined });
    csv = toCsv(Object.entries(a.summary).map(([metric, value]) => ({ metric, value }))) + "\n" + toCsv(a.engagement as unknown as Record<string, unknown>[]);
  } else {
    return NextResponse.json({ error: "Unknown export" }, { status: 404 });
  }
  await audit({ eventType: "export.generated", actorId: user.id, actorRole: "admin", targetType: "export", targetId: kind, metadata: { filters: sp, sensitive } });
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="soar-${kind}-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
}
