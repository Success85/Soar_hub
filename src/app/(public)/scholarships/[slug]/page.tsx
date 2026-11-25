import type { Metadata } from "next";
import Link from "next/link";
import { SchoolLogo } from "@/components/school-logo";
import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { BadgeCheck, CalendarDays, ClipboardList, ExternalLink, FileText, Lock, Mail, MapPin, RefreshCcw, ShieldAlert, Users } from "lucide-react";
import { startApplicationAction, toggleSaveAction } from "@/app/actions/portal";
import { ActionButton } from "@/components/forms/action-form";
import { Markdown } from "@/components/markdown";
import { DeadlineBadge, WindowBadge } from "@/components/scholarship-card";
import { VerdictBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, Badge } from "@/components/ui/misc";
import { getCurrentUser, requireMemberPage } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { applications, savedScholarships } from "@/lib/db/schema";
import { describeRequirement } from "@/lib/engine/eligibility";
import { fieldLabel } from "@/lib/engine/fields";
import { canStartApplication, CATEGORY_LABELS, type Category, type WindowStatus } from "@/lib/scholarship-meta";
import { trackActivity } from "@/lib/services/audit";
import { currentAssessment } from "@/lib/services/eligibility";
import { getScholarshipBundle, isPubliclyVisible } from "@/lib/services/scholarships";
import { formatDate, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const b = await getScholarshipBundle({ slug: (await params).slug });
  if (!b || !isPubliclyVisible(b.scholarship)) return { title: "Scholarship not found" };
  return { title: `${b.scholarship.partnerUniversity} — Mastercard Foundation Scholars`, description: b.scholarship.keyEligibility ?? b.scholarship.summary ?? undefined };
}

function ShortRequirement({ c }: { c: { fieldKey: string; operator: never; requiredValue: unknown; questionText: string | null; description: string | null } }) {
  if (c.description) return <>{c.description}</>;
  if (c.fieldKey.startsWith("custom.")) return <>{c.questionText}</>;
  const req = describeRequirement(c);
  const long = Array.isArray(c.requiredValue) && c.requiredValue.length > 8;
  return <>{fieldLabel(c.fieldKey)} {long ? "must be one of the listed countries" : req}</>;
}

export default async function ScholarshipDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireMemberPage(`/scholarships/${(await params).slug}`);
  const { slug } = await params;
  const [b, user] = await Promise.all([getScholarshipBundle({ slug }), getCurrentUser()]);
  const canPreview = !!user && user.permissions.has("scholarships.manage");
  if (!b || (!isPubliclyVisible(b.scholarship) && !canPreview)) notFound();
  const s = b.scholarship;
  const w = s.windowStatus as WindowStatus;
  await trackActivity("scholarship.viewed", { userId: user?.id ?? null, entityType: "scholarship", entityId: s.id });

  let saved = false;
  let assessment = null;
  let existingApp: { id: string } | undefined;
  if (user) {
    [saved, assessment, [existingApp]] = await Promise.all([
      db.select().from(savedScholarships).where(and(eq(savedScholarships.userId, user.id), eq(savedScholarships.scholarshipId, s.id))).limit(1).then((r) => r.length > 0),
      currentAssessment(user.id, s.id),
      db.select({ id: applications.id }).from(applications).where(and(eq(applications.userId, user.id), eq(applications.scholarshipId, s.id), isNull(applications.deletedAt))).limit(1),
    ]);
  }
  const primary = b.sources.find((x) => x.isPrimary) ?? b.sources[0];
  const windowOpen = canStartApplication(w) && !(s.deadline && s.deadline.getTime() < Date.now());
  const hasRules = b.criteria.length > 0;
  const benefits = [
    ["Tuition", s.tuitionCoverage],
    ["Living allowance", s.livingAllowance],
    ["Accommodation", s.accommodationBenefits],
    ["Travel", s.travelBenefits],
    ["Other support", s.otherBenefits],
  ].filter(([, v]) => v);
  const glance: [string, React.ReactNode][] = [
    ["Institution", s.partnerUniversity],
    ["Country", [s.city, s.country].filter(Boolean).join(", ")],
    ["Group", s.category ? CATEGORY_LABELS[s.category as Category] : "—"],
    ["Level", s.programmeLevel === "masters" ? "Postgraduate (master's)" : "Undergraduate"],
    ["Eligible fields", s.summary ?? s.programmes.join(", ")],
    ["Funding", s.scholarshipType],
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link href="/scholarships" className="text-sm font-medium text-royal-700 hover:underline">← All scholarships</Link>
      {!isPubliclyVisible(s) && <Alert tone="warning" className="mt-4" title="Admin preview">This scholarship is not published ({s.status}). Applicants cannot see it.</Alert>}
      {s.isDemo && <Alert tone="warning" className="mt-4" title="Demonstration record">This is sample data created for testing SOAR Hub. It is not a real scholarship opportunity.</Alert>}

      <header className="mt-6">
        <div className="flex flex-wrap gap-2">
          <WindowBadge status={w} />
          <DeadlineBadge deadline={s.deadline} windowStatus={w} />
          {s.category && <Badge>{CATEGORY_LABELS[s.category as Category]}</Badge>}
        </div>
        <div className="mt-5 flex items-center gap-4 sm:gap-5">
          <SchoolLogo name={s.partnerUniversity} logoUrl={s.logoUrl} size="lg" />
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-gold-700">Mastercard Foundation Scholars Program</p>
            <h1 className="mt-1 font-display text-3xl leading-tight sm:text-4xl">{s.partnerUniversity}</h1>
            <p className="mt-1.5 flex items-center gap-1.5 text-muted"><MapPin className="size-4" aria-hidden /> {[s.city, s.country].filter(Boolean).join(", ")}</p>
          </div>
        </div>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div className="min-w-0 space-y-8">
          <section aria-labelledby="glance">
            <h2 id="glance" className="text-xl font-semibold">At a glance</h2>
            <dl className="mt-3 divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-white">
              {glance.map(([k, v]) => (
                <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-[180px_1fr]">
                  <dt className="text-sm text-muted">{k}</dt>
                  <dd className="text-sm font-medium text-navy-900">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="window" className="grid gap-4 sm:grid-cols-2">
            <h2 id="window" className="sr-only">Application window</h2>
            <div className={`rounded-[var(--radius-card)] border p-5 ${w === "open" ? "border-green-200 bg-success-100/40" : "border-line bg-white"}`}>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted"><CalendarDays className="size-4" aria-hidden /> Deadline / current window</p>
              <p className="mt-2 font-semibold text-navy-900">{s.currentWindow ?? (s.deadline ? formatDate(s.deadline, { day: "numeric", month: "long", year: "numeric" }) : "Not posted")}</p>
              {s.deadline && <p className="mt-1 text-xs text-muted">Deadline used for planning: {formatDateTime(s.deadline, s.timezone)} (Lagos time)</p>}
            </div>
            <div className="rounded-[var(--radius-card)] border border-line bg-white p-5">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted"><RefreshCcw className="size-4" aria-hidden /> Next window</p>
              <p className="mt-2 font-semibold text-navy-900">{s.nextWindow && s.nextWindow !== "—" ? s.nextWindow : "No further window announced"}</p>
              <p className="mt-1 text-xs text-muted">Estimates are based on previous cycles and may change.</p>
            </div>
          </section>

          {s.keyEligibility && (
            <section aria-labelledby="key">
              <h2 id="key" className="flex items-center gap-2 text-xl font-semibold"><Users className="size-5 text-gold-600" aria-hidden /> Key eligibility</h2>
              <p className="mt-3 rounded-[var(--radius-card)] border border-line bg-white p-5 text-[15px] leading-relaxed">{s.keyEligibility}</p>
            </section>
          )}

          {hasRules && (
            <section aria-labelledby="rules">
              <h2 id="rules" className="text-xl font-semibold">Eligibility checklist</h2>
              <p className="mt-1 text-sm text-muted">The criteria SOAR Hub checks against your profile. <span className="font-medium text-danger-700">Absolute</span> criteria cannot be waived.</p>
              <ul className="mt-4 space-y-2">
                {b.criteria.map((c) => {
                  const group = b.groups.find((g) => g.id === c.groupId);
                  return (
                    <li key={c.id} className="rounded-xl border border-line bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold">{c.name}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {c.severity === "absolute" && <Badge tone="danger"><Lock className="size-3" aria-hidden /> Absolute</Badge>}
                          {group && <Badge tone="info">{group.logic === "or" ? `Any one of: ${group.name}` : group.name}</Badge>}
                        </div>
                      </div>
                      <p className="mt-1 text-sm text-muted"><ShortRequirement c={c as never} /></p>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {s.howToApply && (
            <section aria-labelledby="how">
              <h2 id="how" className="flex items-center gap-2 text-xl font-semibold"><ClipboardList className="size-5 text-gold-600" aria-hidden /> How to apply</h2>
              <div className="mt-3 rounded-[var(--radius-card)] border border-line bg-white p-5 text-[15px] leading-relaxed">
                <p>{s.howToApply}</p>
                {s.contactEmail && <p className="mt-3 flex items-center gap-2 text-sm"><Mail className="size-4 text-navy-700" aria-hidden /> Application email: <a className="font-semibold text-royal-700 underline" href={`mailto:${s.contactEmail}`}>{s.contactEmail}</a></p>}
              </div>
            </section>
          )}

          {benefits.length > 0 && (
            <section aria-labelledby="benefits">
              <h2 id="benefits" className="text-xl font-semibold">Benefits</h2>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                {benefits.map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-line bg-white p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-muted">{k}</dt><dd className="mt-1 text-sm">{v}</dd></div>
                ))}
              </dl>
            </section>
          )}

          <section aria-labelledby="documents">
            <h2 id="documents" className="flex items-center gap-2 text-xl font-semibold"><FileText className="size-5 text-gold-600" aria-hidden /> Application documents</h2>
            <p className="mt-1 text-sm text-muted">Prepare these early — some (notarised results, police certificate, sponsor documents) take weeks to obtain.</p>
            {(["admission", "scholarship"] as const).map((section) => {
              const items = b.requirements.filter((r) => (r.section ?? "admission") === section);
              if (!items.length) return null;
              return (
                <div key={section} className="mt-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{section === "admission" ? "For the admission application" : "For the scholarship application"}</h3>
                  <ol className="mt-2 divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-white">
                    {items.map((r, i) => (
                      <li key={r.id} className="flex items-start gap-3 px-4 py-3">
                        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-ivory-200 text-xs font-semibold text-navy-800">{i + 1}</span>
                        <span className="min-w-0 flex-1 text-sm">
                          <span className="font-medium text-navy-900">{r.name}</span>
                          {r.description && <span className="mt-0.5 block text-xs text-muted">{r.description}</span>}
                        </span>
                        <Badge tone={r.isRequired ? "navy" : "neutral"}>{r.isRequired ? "Required" : "Optional"}</Badge>
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
            <Alert tone="info" className="mt-4">
              Visit the official page for full and up-to-date information on the application documents
              {primary ? <>: <a href={primary.url} target="_blank" rel="noopener noreferrer" className="font-semibold">{primary.sourceName}</a></> : "."}
            </Alert>
          </section>

          {!s.keyEligibility && (
            <section aria-labelledby="overview">
              <h2 id="overview" className="text-xl font-semibold">Overview</h2>
              <div className="mt-3"><Markdown>{s.description || "No overview provided."}</Markdown></div>
            </section>
          )}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardBody className="space-y-4">
              <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold">Application window</p><WindowBadge status={w} /></div>
              {user && assessment && (
                <div className="rounded-lg bg-ivory-200/70 p-3">
                  <p className="text-xs font-semibold text-muted">Your latest eligibility result</p>
                  <div className="mt-1"><VerdictBadge verdict={assessment.overallVerdict} /></div>
                  <Link href={`/eligibility/${s.id}`} className="mt-2 inline-block text-xs font-semibold text-royal-700 hover:underline">See explanation</Link>
                </div>
              )}
              {!windowOpen && (
                <Alert tone="info">
                  {w === "paused" ? "Applications are paused until further notice." : "Applications aren't open right now."} {s.nextWindow && s.nextWindow !== "—" && <>Next window: <strong>{s.nextWindow}</strong>. </>}You can still check your eligibility and prepare.
                </Alert>
              )}
              {user ? (
                <div className="grid gap-2">
                  {existingApp ? (
                    <Button asChild size="lg"><Link href={`/applications/${existingApp.id}`}>Open my application</Link></Button>
                  ) : windowOpen && assessment ? (
                    <ActionButton action={startApplicationAction} fields={{ scholarshipId: s.id }} size="lg" className="w-full" pendingLabel="Creating your plan…">Start application plan</ActionButton>
                  ) : null}
                  {hasRules ? (
                    <Button asChild size="lg" variant={existingApp || (windowOpen && assessment) ? "secondary" : "primary"}><Link href={`/eligibility/${s.id}`}>{assessment ? "Re-check eligibility" : "Check my eligibility"}</Link></Button>
                  ) : (
                    <p className="text-sm text-muted">Official criteria haven&apos;t been published, so there&apos;s nothing to check yet.</p>
                  )}
                  <ActionButton action={toggleSaveAction} fields={{ scholarshipId: s.id }} variant="ghost" className="w-full">{saved ? "★ Saved — remove" : "☆ Save scholarship"}</ActionButton>
                </div>
              ) : (
                <div className="grid gap-2">
                  <Button asChild size="lg"><Link href="/register">Check my eligibility</Link></Button>
                  <Button asChild variant="secondary"><Link href={`/login?next=/scholarships/${s.slug}`}>Sign in to save</Link></Button>
                </div>
              )}
              {s.applicationUrl && (
                <a href={s.applicationUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-navy-900 hover:bg-ivory-200">
                  Official application <ExternalLink className="size-4" aria-hidden />
                </a>
              )}
              <p className="text-xs text-muted">You submit your final application with the university. SOAR Hub helps you prepare — it does not guarantee selection.</p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><BadgeCheck className="size-4 text-success-700" aria-hidden /> Official page & sources</CardTitle></CardHeader>
            <CardBody className="space-y-2 pt-3 text-sm">
              {primary ? (
                <>
                  <p className="font-medium">{primary.sourceName}</p>
                  <a href={primary.url} target="_blank" rel="noopener noreferrer" className="break-all text-royal-700 underline">{primary.url}</a>
                </>
              ) : (
                <p className="flex items-center gap-2 text-warning-700"><ShieldAlert className="size-4" aria-hidden /> No source recorded</p>
              )}
              {s.researchSources && <p className="text-muted">Research sources: {s.researchSources}</p>}
              <p className="text-muted">Last verified: <strong className="text-navy-900">{formatDate(s.lastVerifiedAt)}</strong></p>
              <p className="text-xs text-muted">Details change between rounds. Always confirm on the official page before applying.</p>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}
