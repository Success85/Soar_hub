import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, CircleHelp, Lock, XCircle } from "lucide-react";
import { eligibilityAction, startApplicationAction } from "@/app/actions/portal";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms/action-form";
import { CriterionVerdictBadge, VerdictBadge, VERDICT_LABELS } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/form";
import { Alert, Badge, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { applications } from "@/lib/db/schema";
import type { Question } from "@/lib/engine/eligibility";
import { optionLabel } from "@/lib/engine/fields";
import { assessmentHistory, currentAssessment, getAssessment, pendingQuestions } from "@/lib/services/eligibility";
import { getScholarshipBundle, isPubliclyVisible } from "@/lib/services/scholarships";
import { formatDateTime } from "@/lib/utils";
import { and, eq, isNull } from "drizzle-orm";

export const metadata: Metadata = { title: "Eligibility check" };
export const dynamic = "force-dynamic";

function QuestionInput({ q }: { q: Question }) {
  const name = `q:${q.fieldKey}`;
  const id = `q-${q.fieldKey.replace(/\W/g, "-")}`;
  if (q.type === "boolean") {
    return (
      <fieldset>
        <legend className="text-sm font-semibold">{q.prompt}</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {[["true", "Yes"], ["false", "No"]].map(([v, l]) => (
            <label key={v} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-line bg-white px-4 has-[:checked]:border-navy-900 has-[:checked]:bg-navy-50">
              <input type="radio" name={name} value={v} className="size-4 accent-navy-900" /> {l}
            </label>
          ))}
          {q.sensitive && (
            <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-line bg-white px-4 has-[:checked]:border-navy-900">
              <input type="radio" name={name} value="" className="size-4 accent-navy-900" /> Prefer not to say
            </label>
          )}
        </div>
      </fieldset>
    );
  }
  if (q.type === "string_list" && q.options) {
    return (
      <fieldset>
        <legend className="text-sm font-semibold">{q.prompt}</legend>
        <input type="hidden" name={`multi:${q.fieldKey}`} value="1" />
        <input type="hidden" name={name} value="" />
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {q.options.map((o) => (
            <label key={o.value} className="flex min-h-11 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm">
              <input type="checkbox" name={name} value={o.value} className="size-4 accent-navy-900" /> {o.label}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{q.prompt}</Label>
      {q.help && <p className="text-[13px] text-muted">{q.help}</p>}
      {q.options && (q.type === "enum" || q.type === "string") ? (
        <Select id={id} name={name} defaultValue="">
          <option value="">{q.sensitive ? "Prefer not to say" : "Select…"}</option>
          {q.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      ) : (
        <Input id={id} name={name} type={q.type === "date" ? "date" : q.type === "number" ? "number" : "text"} inputMode={q.type === "number" ? "decimal" : undefined} />
      )}
    </div>
  );
}

export default async function EligibilityPage({ params, searchParams }: { params: Promise<{ scholarshipId: string }>; searchParams: Promise<{ assessment?: string }> }) {
  const user = await requireUser();
  const { scholarshipId } = await params;
  const { assessment: assessmentParam } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(scholarshipId)) notFound();
  const b = await getScholarshipBundle({ id: scholarshipId });
  if (!b || !isPubliclyVisible(b.scholarship)) notFound();

  if (b.criteria.length === 0) {
    return (
      <>
        <PageHeader back={{ href: `/scholarships/${b.scholarship.slug}`, label: "Scholarship details" }} eyebrow="Eligibility check" title={b.scholarship.partnerUniversity} />
        <Alert tone="info" title="Official criteria not published">There is nothing to check yet for this scholarship. {b.scholarship.keyEligibility ?? ""} Check the official page for updates.</Alert>
      </>
    );
  }
  const current = await currentAssessment(user.id, scholarshipId);
  const showId = assessmentParam ?? current?.id;
  const shown = showId ? await getAssessment(showId) : null;
  if (shown && shown.assessment.userId !== user.id) notFound();
  const { questions } = await pendingQuestions(user.id, scholarshipId);
  const history = await assessmentHistory(user.id, scholarshipId);
  const [app] = await db.select({ id: applications.id }).from(applications).where(and(eq(applications.userId, user.id), eq(applications.scholarshipId, scholarshipId), isNull(applications.deletedAt))).limit(1);
  const batch = questions.slice(0, 5);
  const verdict = shown?.assessment.overallVerdict;
  const order = { ineligible: 0, undetermined: 1, eligible: 2 } as const;
  const results = [...(shown?.results ?? [])].sort((a, z) => order[a.verdict] - order[z.verdict]);

  return (
    <>
      <PageHeader back={{ href: `/scholarships/${b.scholarship.slug}`, label: "Scholarship details" }} eyebrow="Eligibility check" title={b.scholarship.partnerUniversity} description="We check your profile against this scholarship's official criteria and explain every result. This is guidance — the university makes the final decision." />

      {batch.length > 0 && (
        <Card className="mb-8 border-gold-200">
          <CardHeader>
            <div>
              <CardTitle>{current ? "A few more questions" : "Let's check your eligibility"}</CardTitle>
              <p className="mt-1 text-sm text-muted">{questions.length} question{questions.length === 1 ? "" : "s"} left. We ask the most decisive ones first and never repeat what&apos;s in your profile. Profile answers are saved to your profile.</p>
            </div>
          </CardHeader>
          <CardBody>
            <ActionForm action={eligibilityAction} className="space-y-6">
              <input type="hidden" name="scholarshipId" value={scholarshipId} />
              {batch.map((q) => (
                <div key={q.fieldKey} className="space-y-2 rounded-xl border border-line bg-ivory/50 p-4">
                  <QuestionInput q={q} />
                  <p className="flex items-start gap-1.5 text-xs text-muted"><CircleHelp className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Why we ask: {q.why}{q.sensitive && " This question is optional."}</p>
                </div>
              ))}
              <SubmitButton size="lg" pendingLabel="Checking…">{questions.length > batch.length ? "Save and continue" : "See my result"}</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>
      )}

      {batch.length === 0 && !current && (
        <Card className="mb-8">
          <CardBody className="flex flex-wrap items-center justify-between gap-4">
            <p>Your profile already has everything this check needs.</p>
            <ActionForm action={eligibilityAction}>
              <input type="hidden" name="scholarshipId" value={scholarshipId} />
              <SubmitButton pendingLabel="Checking…">Run eligibility check</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>
      )}

      {shown && verdict && (
        <section aria-labelledby="result" className="space-y-6">
          <Card className={verdict === "likely_eligible" ? "border-green-200" : verdict === "not_eligible" ? "border-red-200" : "border-amber-200"}>
            <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                {verdict === "likely_eligible" ? <CheckCircle2 className="size-10 shrink-0 text-success-700" aria-hidden /> : verdict === "not_eligible" ? <XCircle className="size-10 shrink-0 text-danger-700" aria-hidden /> : <CircleHelp className="size-10 shrink-0 text-warning-700" aria-hidden />}
                <div>
                  <h2 id="result" className="font-display text-2xl">{VERDICT_LABELS[verdict]}</h2>
                  <p className="mt-1 max-w-2xl text-sm text-muted">
                    {verdict === "likely_eligible" && "Based on what you've told us, you appear to meet this scholarship's stated criteria. This is guidance, not a guarantee — the university makes all final decisions."}
                    {verdict === "more_info_needed" && "You may be eligible. Answer the remaining questions to complete your assessment."}
                    {verdict === "not_eligible" && "Based on your current information, you don't meet at least one requirement. Check your details are correct — some issues may be fixable."}
                  </p>
                  <p className="mt-2 text-xs text-muted">
                    {shown.assessment.eligibleCount} met · {shown.assessment.ineligibleCount} not met · {shown.assessment.undeterminedCount} undetermined · assessed {formatDateTime(shown.assessment.createdAt)}
                    {shown.assessment.trigger !== "manual" && ` (recalculated after ${shown.assessment.trigger === "profile_change" ? "a profile change" : "the scholarship's criteria changed"})`}
                  </p>
                  {!shown.assessment.isCurrent && <Badge tone="warning" className="mt-2">Historical result — not your latest</Badge>}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {app ? (
                  <Button asChild><Link href={`/applications/${app.id}`}>Open application</Link></Button>
                ) : verdict !== "not_eligible" ? (
                  <ActionButton action={startApplicationAction} fields={{ scholarshipId }} pendingLabel="Creating your plan…">Start application plan</ActionButton>
                ) : null}
                <Button asChild variant="secondary"><Link href="/profile">Update my profile</Link></Button>
              </div>
            </CardBody>
          </Card>

          <div>
            <h3 className="text-lg font-semibold">Criterion by criterion</h3>
            <ul className="mt-3 space-y-3">
              {results.map((r) => (
                <li key={r.id} className="rounded-xl border border-line bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{r.criterionName}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <CriterionVerdictBadge verdict={r.verdict} />
                      {r.isAbsolute && <Badge tone="danger"><Lock className="size-3" aria-hidden /> Absolute</Badge>}
                      {!r.isRequired && <Badge>Advisory</Badge>}
                    </div>
                  </div>
                  {r.criterionDescription && <p className="mt-1 text-sm text-muted">{r.criterionDescription}</p>}
                  <p className="mt-2 text-[15px]">{r.explanation}</p>
                  <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                    <div><dt className="text-xs text-muted">Your information</dt><dd className="font-medium">{optionLabel(r.fieldKey, r.applicantValue)}</dd></div>
                    <div><dt className="text-xs text-muted">Fixable?</dt><dd className="font-medium">{r.verdict === "eligible" ? "—" : r.isFixable ? "Yes" : "No"}</dd></div>
                    <div><dt className="text-xs text-muted">Source</dt><dd className="font-medium">{r.source ?? "Official scholarship page"}</dd></div>
                  </dl>
                  {r.recommendedAction && r.verdict !== "eligible" && <p className="mt-3 rounded-lg bg-gold-50 p-3 text-sm"><strong>What you can do:</strong> {r.recommendedAction}</p>}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {!shown && batch.length > 0 && <Alert tone="info">Answer the questions above to see your result.</Alert>}

      {history.length > 1 && (
        <section className="mt-10">
          <h3 className="text-lg font-semibold">Assessment history</h3>
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-white">
            {history.map(({ a }) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span>{formatDateTime(a.createdAt)} · {a.trigger.replace("_", " ")}</span>
                <span className="flex items-center gap-2"><VerdictBadge verdict={a.overallVerdict} short /><Link className="font-semibold text-royal-700 hover:underline" href={`/eligibility/${scholarshipId}?assessment=${a.id}`}>View</Link></span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
