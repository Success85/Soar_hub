import Link from "next/link";
import { sql } from "drizzle-orm";
import { MilestoneEditor } from "@/components/admin/milestone-editor";
import { ScholarshipStatusBadge } from "@/components/status";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, PageHeader, Table, Td, Th } from "@/components/ui/misc";
import { requirePermissionPage } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { OPERATORS } from "@/lib/engine/eligibility";
import { FIELDS } from "@/lib/engine/fields";
import { templatesFor } from "@/lib/services/planner";

export const metadata = { title: "Eligibility rules" };
export const dynamic = "force-dynamic";

export default async function EligibilityRulesPage() {
  await requirePermissionPage("scholarships.manage");
  const rows = await db.execute<{ id: string; name: string; status: string; criteria: number; absolute: number; groups: number; assessments: number }>(sql`
    SELECT s.id, s.name, s.status::text,
      (SELECT count(*)::int FROM scholarship_criteria c WHERE c.scholarship_id = s.id) AS criteria,
      (SELECT count(*)::int FROM scholarship_criteria c WHERE c.scholarship_id = s.id AND c.severity = 'absolute') AS absolute,
      (SELECT count(*)::int FROM scholarship_criteria_groups g WHERE g.scholarship_id = s.id) AS groups,
      (SELECT count(*)::int FROM eligibility_assessments a WHERE a.scholarship_id = s.id AND a.is_current) AS assessments
    FROM scholarships s ORDER BY s.updated_at DESC`);
  const global = await db.execute<{ c: number }>(sql`SELECT count(*)::int AS c FROM scholarship_milestone_templates WHERE scholarship_id IS NULL`);
  return (
    <>
      <PageHeader title="Eligibility rules" description="Rules are data, configured per scholarship — no code deployment needed. Edit them on each scholarship's Eligibility criteria tab." />
      <Table caption="Criteria by scholarship">
        <thead><tr><Th>Scholarship</Th><Th>Status</Th><Th>Criteria</Th><Th>Absolute</Th><Th>Groups</Th><Th>Current assessments</Th></tr></thead>
        <tbody>{[...rows].map((r) => <tr key={r.id}><Td><Link href={`/admin/scholarships/${r.id}?tab=criteria`} className="font-semibold hover:underline">{r.name}</Link></Td><Td><ScholarshipStatusBadge status={r.status as never} /></Td><Td>{r.criteria}</Td><Td>{r.absolute}</Td><Td>{r.groups}</Td><Td>{r.assessments}</Td></tr>)}</tbody>
      </Table>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Applicant fields available to rules</CardTitle></CardHeader>
          <CardBody>
            <ul className="divide-y divide-line text-sm">{FIELDS.map((f) => <li key={f.key} className="flex flex-wrap items-center justify-between gap-2 py-2"><span><strong>{f.label}</strong> <code className="text-xs text-muted">{f.key}</code></span><span className="flex gap-1"><Badge>{f.type}</Badge>{f.sensitive && <Badge tone="warning">Sensitive — asked last, optional</Badge>}{f.derived && <Badge tone="info">Derived</Badge>}</span></li>)}<li className="py-2"><strong>Custom questions</strong> <code className="text-xs text-muted">custom.*</code> — scholarship-specific questions defined in the rule builder.</li></ul>
          </CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Operators</CardTitle></CardHeader>
          <CardBody><ul className="space-y-1 text-sm">{OPERATORS.map((o) => <li key={o.value}><code className="text-xs">{o.value}</code> — {o.label}</li>)}</ul><p className="mt-3 text-xs text-muted">Missing applicant information always yields “Undetermined”, never “Ineligible”.</p></CardBody>
        </Card>
      </div>
      <div className="mt-8">
        <MilestoneEditor scholarshipId={null} rows={(await templatesFor("00000000-0000-0000-0000-000000000000")).map((t) => ({ ...t, description: t.description ?? null, priority: t.priority ?? "medium", isRequired: t.isRequired !== false }))} usingDefault={global[0]?.c === 0} />
      </div>
    </>
  );
}
