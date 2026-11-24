import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, isNull } from "drizzle-orm";
import { AppStatusBadge, EssayStatusBadge, MilestoneBadge, ReviewStatusBadge } from "@/components/status";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, Progress } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { applicationMilestones, documents, essays, profiles, users } from "@/lib/db/schema";
import { EDUCATION_LEVELS } from "@/lib/engine/fields";
import { dayInTimezone, effectiveStatus } from "@/lib/engine/scheduler";
import { applicationAccess } from "@/lib/services/access";
import { applicationDetail } from "@/lib/services/applications";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ReviewerApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const access = await applicationAccess(user, id).catch(() => null);
  if (!access || access.access === "owner") notFound();
  const d = await applicationDetail(id);
  const [applicant] = await db.select({ u: users, p: profiles }).from(users).leftJoin(profiles, eq(profiles.userId, users.id)).where(eq(users.id, d.app.userId)).limit(1);
  const [docs, ess, ms] = await Promise.all([
    db.select().from(documents).where(and(eq(documents.applicationId, id), isNull(documents.deletedAt))),
    db.select().from(essays).where(and(eq(essays.applicationId, id), isNull(essays.deletedAt))),
    db.select().from(applicationMilestones).where(eq(applicationMilestones.applicationId, id)).orderBy(asc(applicationMilestones.dueDate)),
  ]);
  const today = dayInTimezone(new Date(), "Africa/Lagos");
  const p = applicant.p;
  return (
    <>
      <PageHeader back={{ href: "/reviewer", label: "Assignments" }} title={`${applicant.u.firstName} ${applicant.u.lastName}`} description={d.sch.name} actions={<AppStatusBadge status={d.app.status} outcome={d.app.outcome} />} />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Documents</CardTitle></CardHeader>
            <CardBody>
              {docs.length === 0 ? <p className="text-sm text-muted">No documents attached yet.</p> : (
                <ul className="divide-y divide-line">{docs.map((doc) => <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><Link href={`/reviewer/documents/${doc.id}`} className="font-medium hover:underline">{doc.title} <span className="text-xs text-muted">v{doc.currentVersion}</span></Link><ReviewStatusBadge status={doc.reviewStatus} /></li>)}</ul>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader><CardTitle>Essays</CardTitle></CardHeader>
            <CardBody>
              {ess.length === 0 ? <p className="text-sm text-muted">No essays linked yet.</p> : (
                <ul className="divide-y divide-line">{ess.map((e) => <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><Link href={`/reviewer/essays/${e.id}`} className="font-medium hover:underline">{e.title} <span className="text-xs text-muted">v{e.currentVersion} · {e.wordCount} words</span></Link><EssayStatusBadge status={e.status} /></li>)}</ul>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader><CardTitle>Milestones</CardTitle></CardHeader>
            <CardBody>
              <div className="mb-4 flex items-center gap-3"><Progress value={d.app.progress} label="Progress" /><span className="font-semibold">{d.app.progress}%</span></div>
              <ul className="divide-y divide-line text-sm">{ms.map((m) => <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span>{m.name} <span className="text-xs text-muted">· due {formatDate(m.dueDate)}</span></span><MilestoneBadge status={effectiveStatus(m, today)} /></li>)}</ul>
            </CardBody>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Applicant context</CardTitle></CardHeader>
            <CardBody className="space-y-2 text-sm">
              <p><span className="text-muted">Education:</span> {EDUCATION_LEVELS.find((e) => e.value === p?.educationLevel)?.label ?? "—"}</p>
              <p><span className="text-muted">School:</span> {p?.currentSchool ?? "—"}</p>
              <p><span className="text-muted">Wants to study:</span> {p?.preferredProgramme ?? "—"}</p>
              <p><span className="text-muted">Career interests:</span> {p?.careerInterests ?? "—"}</p>
              <p><span className="text-muted">Background:</span> {p?.personalBackground ?? "—"}</p>
              <p className="pt-2 text-xs text-muted">Sensitive details (income, disability, refugee status, date of birth) are restricted and not shown to reviewers.</p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader><CardTitle>Checklist</CardTitle></CardHeader>
            <CardBody><ul className="space-y-1 text-sm">{d.checklist.documents.map((c) => <li key={c.requirementId}>{c.ready ? "✓" : "○"} {c.name}</li>)}</ul></CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
