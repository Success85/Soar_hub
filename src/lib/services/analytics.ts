import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";

export interface AnalyticsFilters {
  from: string; // YYYY-MM-DD
  to: string;
  scholarshipId?: string;
  institution?: string;
  status?: string;
  cohort?: string; // registration month YYYY-MM
}

function appScope(f: AnalyticsFilters, alias = "a"): SQL {
  const parts: SQL[] = [sql.raw(`${alias}.deleted_at IS NULL`)];
  if (f.scholarshipId) parts.push(sql`${sql.raw(alias)}.scholarship_id = ${f.scholarshipId}`);
  if (f.institution) parts.push(sql`${sql.raw(alias)}.scholarship_id IN (SELECT id FROM scholarships WHERE partner_university = ${f.institution})`);
  if (f.status) parts.push(sql`${sql.raw(alias)}.status::text = ${f.status}`);
  if (f.cohort) parts.push(sql`${sql.raw(alias)}.user_id IN (SELECT id FROM users WHERE to_char(created_at, 'YYYY-MM') = ${f.cohort})`);
  return sql.join(parts, sql` AND `);
}

const range = (f: AnalyticsFilters, col: string) => sql`${sql.raw(col)} >= ${f.from}::date AND ${sql.raw(col)} < (${f.to}::date + 1)`;

/** Every number here is a live aggregate over real records. Nothing is estimated or seeded. */
export async function analytics(f: AnalyticsFilters) {
  const cohort = f.cohort ? sql`AND to_char(u.created_at, 'YYYY-MM') = ${f.cohort}` : sql``;
  const [summary] = await db.execute<Record<string, number | null>>(sql`
    SELECT
      (SELECT count(*)::int FROM users u WHERE ${range(f, "u.created_at")} ${cohort}) AS registrations,
      (SELECT round(100.0 * count(*) FILTER (WHERE p.onboarding_completed_at IS NOT NULL) / nullif(count(*),0), 1) FROM users u JOIN profiles p ON p.user_id = u.id WHERE ${range(f, "u.created_at")} ${cohort}) AS profile_completion_rate,
      (SELECT count(*)::int FROM eligibility_assessments ea WHERE ${range(f, "ea.created_at")} ${f.scholarshipId ? sql`AND ea.scholarship_id = ${f.scholarshipId}` : sql``}) AS assessments_run,
      (SELECT count(DISTINCT (ea.user_id, ea.scholarship_id))::int FROM eligibility_assessments ea WHERE ea.status = 'completed' AND ${range(f, "ea.created_at")} ${f.scholarshipId ? sql`AND ea.scholarship_id = ${f.scholarshipId}` : sql``}) AS screenings_completed,
      (SELECT count(*)::int FROM user_activity ua WHERE ua.event_type = 'scholarship.viewed' AND ${range(f, "ua.created_at")} ${f.scholarshipId ? sql`AND ua.entity_id = ${f.scholarshipId}` : sql``}) AS scholarship_views,
      (SELECT count(*)::int FROM saved_scholarships ss WHERE ${range(f, "ss.created_at")} ${f.scholarshipId ? sql`AND ss.scholarship_id = ${f.scholarshipId}` : sql``}) AS scholarship_saves,
      (SELECT count(*)::int FROM applications a WHERE ${appScope(f)} AND ${range(f, "a.created_at")}) AS applications_created,
      (SELECT count(*)::int FROM applications a WHERE ${appScope(f)} AND ${range(f, "a.created_at")} AND a.status NOT IN ('draft','screening')) AS applications_started,
      (SELECT count(*)::int FROM applications a WHERE ${appScope(f)} AND a.submitted_at IS NOT NULL AND ${range(f, "a.created_at")}) AS applications_submitted,
      (SELECT count(*)::int FROM applications a WHERE ${appScope(f)} AND ${range(f, "a.created_at")} AND a.status IN ('draft','screening','eligible','in_progress') AND a.updated_at < now() - interval '21 days') AS applications_abandoned,
      (SELECT round(100.0 * count(*) FILTER (WHERE m.status = 'completed') / nullif(count(*),0), 1) FROM application_milestones m JOIN applications a ON a.id = m.application_id WHERE ${appScope(f)} AND m.due_date BETWEEN ${f.from}::date AND ${f.to}::date) AS milestone_completion_rate,
      (SELECT round(avg(extract(epoch FROM (dr.created_at - dv.created_at)) / 3600)::numeric, 1) FROM document_reviews dr JOIN document_versions dv ON dv.id = dr.document_version_id WHERE ${range(f, "dr.created_at")}) AS doc_review_hours,
      (SELECT round(avg(extract(epoch FROM (er.completed_at - er.created_at)) / 3600)::numeric, 1) FROM essay_reviews er WHERE er.completed_at IS NOT NULL AND ${range(f, "er.completed_at")}) AS essay_review_hours,
      (SELECT count(*)::int FROM referee_requests r WHERE ${range(f, "r.created_at")}) AS referee_requests,
      (SELECT count(*)::int FROM referee_requests r WHERE r.status = 'submitted' AND ${range(f, "r.created_at")}) AS referee_submitted,
      (SELECT count(*)::int FROM notifications n WHERE n.channel <> 'in_app' AND ${range(f, "n.created_at")}) AS notifications_total,
      (SELECT count(*)::int FROM notifications n WHERE n.channel <> 'in_app' AND n.status IN ('sent','delivered') AND ${range(f, "n.created_at")}) AS notifications_delivered,
      (SELECT count(*)::int FROM notifications n WHERE n.channel <> 'in_app' AND n.status = 'failed' AND ${range(f, "n.created_at")}) AS notifications_failed
  `);

  const verdicts = await db.execute<{ verdict: string; count: number }>(sql`
    SELECT overall_verdict::text AS verdict, count(*)::int AS count FROM eligibility_assessments ea
    WHERE ea.is_current AND ea.overall_verdict IS NOT NULL AND ${range(f, "ea.created_at")} ${f.scholarshipId ? sql`AND ea.scholarship_id = ${f.scholarshipId}` : sql``}
    GROUP BY 1 ORDER BY 1`);

  const registrations = await db.execute<{ day: string; count: number }>(sql`
    SELECT to_char(d::date, 'YYYY-MM-DD') AS day, coalesce(c.count, 0)::int AS count
    FROM generate_series(${f.from}::date, ${f.to}::date, interval '1 day') d
    LEFT JOIN (SELECT u.created_at::date AS day, count(*) AS count FROM users u WHERE true ${cohort} GROUP BY 1) c ON c.day = d::date ORDER BY d`);

  const funnel = await db.execute<{ status: string; count: number }>(sql`
    SELECT a.status::text AS status, count(*)::int AS count FROM applications a WHERE ${appScope(f)} AND ${range(f, "a.created_at")} GROUP BY 1`);

  const engagement = await db.execute<{ id: string; name: string; views: number; saves: number; applications: number; submitted: number }>(sql`
    SELECT s.id, s.name,
      (SELECT count(*)::int FROM user_activity ua WHERE ua.event_type = 'scholarship.viewed' AND ua.entity_id = s.id AND ${range(f, "ua.created_at")}) AS views,
      (SELECT count(*)::int FROM saved_scholarships ss WHERE ss.scholarship_id = s.id AND ${range(f, "ss.created_at")}) AS saves,
      (SELECT count(*)::int FROM applications a WHERE a.scholarship_id = s.id AND a.deleted_at IS NULL AND ${range(f, "a.created_at")}) AS applications,
      (SELECT count(*)::int FROM applications a WHERE a.scholarship_id = s.id AND a.submitted_at IS NOT NULL AND ${range(f, "a.created_at")}) AS submitted
    FROM scholarships s ${f.scholarshipId ? sql`WHERE s.id = ${f.scholarshipId}` : f.institution ? sql`WHERE s.partner_university = ${f.institution}` : sql``}
    ORDER BY views DESC, applications DESC LIMIT 25`);

  return { summary, verdicts: [...verdicts], registrations: [...registrations], funnel: [...funnel], engagement: [...engagement] };
}

export function toCsv(rows: Record<string, unknown>[], columns?: string[]): string {
  if (!rows.length) return (columns ?? []).join(",") + "\n";
  const cols = columns ?? Object.keys(rows[0]);
  const cell = (v: unknown) => {
    if (v === null || v === undefined) return "";
    let s = v instanceof Date ? v.toISOString() : Array.isArray(v) ? v.join("; ") : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // neutralise spreadsheet formula injection
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n") + "\n";
}

/** Cron: daily snapshot of key counts (for long-range trends without heavy queries). */
export async function aggregateDaily(): Promise<number> {
  const res = await db.execute(sql`
    INSERT INTO analytics_daily (day, metric, dimension, value, computed_at)
    SELECT current_date, m.metric, '', m.value, now() FROM (
      SELECT 'users_total' AS metric, (SELECT count(*)::int FROM users WHERE deleted_at IS NULL) AS value
      UNION ALL SELECT 'applications_total', (SELECT count(*)::int FROM applications WHERE deleted_at IS NULL)
      UNION ALL SELECT 'applications_submitted', (SELECT count(*)::int FROM applications WHERE submitted_at IS NOT NULL)
      UNION ALL SELECT 'assessments_total', (SELECT count(*)::int FROM eligibility_assessments)
    ) m
    ON CONFLICT (day, metric, dimension) DO UPDATE SET value = excluded.value, computed_at = now()`);
  return Number((res as unknown as { count?: number }).count ?? 4);
}
