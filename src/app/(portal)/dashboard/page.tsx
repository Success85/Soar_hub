import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bookmark, CalendarClock, FileUp, GraduationCap, MessageSquare, NotebookPen, Sparkles, UserRoundCheck } from "lucide-react";
import { AppStatusBadge, MilestoneBadge, RefereeStatusBadge, VerdictBadge } from "@/components/status";
import { DeadlineBadge } from "@/components/scholarship-card";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, EmptyState, Progress, Stat } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { applicantDashboard } from "@/lib/services/dashboard";
import { formatDate, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await requireUser({ next: "/dashboard" });
  const { welcome } = await searchParams;
  const d = await applicantDashboard(user.id);
  const active = d.apps.filter((a) => !["outcome", "ineligible"].includes(a.a.status));
  const hour = Number(new Date().toLocaleString("en-GB", { hour: "numeric", hour12: false, timeZone: "Africa/Lagos" }));
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-gold-700">{greet}</p>
          <h1 className="font-display text-3xl sm:text-4xl">Welcome back, {user.firstName}</h1>
          <p className="mt-1 text-muted">Here&apos;s where your scholarship journey stands today.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="gold"><Link href="/scholarships"><GraduationCap aria-hidden /> Find scholarships</Link></Button>
          <Button asChild variant="secondary"><Link href="/documents"><FileUp aria-hidden /> Upload a document</Link></Button>
        </div>
      </div>

      {welcome && <Alert tone="success" title="Your profile is set up">Next, explore scholarships and check your eligibility — it only takes a few minutes.</Alert>}
      {!d.profile?.onboardingCompletedAt && (
        <Alert tone="info" title="Finish setting up your profile">
          A complete profile means fewer questions and more accurate eligibility results. <Link href="/onboarding?step=personal" className="font-semibold">Continue setup →</Link>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-[13px] font-medium text-muted">Profile completion</p>
          <p className="mt-1 font-display text-3xl">{d.completion.percent}%</p>
          <Progress value={d.completion.percent} label="Profile completion" tone="gold" className="mt-2" />
          <Link href="/profile" className="mt-2 block text-xs font-semibold text-royal-700 hover:underline">{d.completion.missing.length ? `${d.completion.missing.length} item(s) to add` : "Complete — review"}</Link>
        </Card>
        <Stat label="Active applications" value={active.length} href="/applications" hint={`${d.apps.filter((a) => a.a.submittedAt).length} submitted`} />
        <Stat label="Overdue tasks" value={d.overdue.length} href="/planner" tone={d.overdue.length ? "danger" : "default"} hint={d.overdue.length ? "Catch up or adjust dates" : "You're on track"} />
        <Stat label="Unread notifications" value={d.unread} href="/notifications" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Active applications</CardTitle>
              <Link href="/applications" className="text-sm font-semibold text-royal-700 hover:underline">View all</Link>
            </CardHeader>
            <CardBody>
              {active.length === 0 ? (
                <EmptyState icon={GraduationCap} title="No applications yet" description="Check your eligibility for a scholarship, then start an application to get a personalised plan." action={<Button asChild><Link href="/scholarships">Explore scholarships</Link></Button>} />
              ) : (
                <ul className="space-y-3">
                  {active.map(({ a, s }) => (
                    <li key={a.id} className="rounded-xl border border-line p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <Link href={`/applications/${a.id}`} className="font-semibold hover:underline">{s.name}</Link>
                        <AppStatusBadge status={a.status} outcome={a.outcome} />
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <Progress value={a.progress} label={`${s.name} progress`} />
                        <span className="w-10 text-right text-sm font-semibold">{a.progress}%</span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                        Deadline {formatDate(s.deadline)} <DeadlineBadge deadline={s.deadline} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upcoming & overdue tasks</CardTitle>
              <Link href="/planner" className="text-sm font-semibold text-royal-700 hover:underline">Open planner</Link>
            </CardHeader>
            <CardBody>
              {d.overdue.length + d.upcoming.length === 0 ? (
                <EmptyState icon={CalendarClock} title="No tasks scheduled" description="When you start an application, we build a milestone plan backward from the deadline." />
              ) : (
                <ul className="divide-y divide-line">
                  {[...d.overdue, ...d.upcoming].slice(0, 8).map((r) => (
                    <li key={r.m.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                      <div className="min-w-0">
                        <p className="font-medium">{r.m.name}</p>
                        <p className="text-xs text-muted">{r.scholarshipName} · due {formatDate(r.m.dueDate)}</p>
                      </div>
                      <MilestoneBadge status={r.effective} />
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Eligibility at a glance</CardTitle>
              <Link href="/scholarships" className="text-sm font-semibold text-royal-700 hover:underline">All scholarships</Link>
            </CardHeader>
            <CardBody>
              {d.screening.length === 0 ? (
                <p className="text-sm text-muted">No published scholarships to screen yet.</p>
              ) : (
                <ul className="space-y-2">
                  {d.screening.slice(0, 5).map((s) => (
                    <li key={s.scholarship.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
                      <Link href={`/scholarships/${s.scholarship.slug}`} className="min-w-0 text-sm font-medium hover:underline">{s.scholarship.name}</Link>
                      <div className="flex items-center gap-2">
                        <VerdictBadge verdict={s.verdict} short />
                        <Link href={`/eligibility/${s.scholarship.id}`} className="text-xs font-semibold text-royal-700 hover:underline">Check</Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-muted">Live estimates from your current profile. Run a full check to save a result. Results are guidance, not a guarantee.</p>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-gold-600" aria-hidden /> Recommended for you</CardTitle></CardHeader>
            <CardBody>
              {d.recommended.length === 0 ? (
                <p className="text-sm text-muted">Complete your profile to get recommendations.</p>
              ) : (
                <ul className="space-y-3">
                  {d.recommended.map((r) => (
                    <li key={r.scholarship.id}>
                      <Link href={`/scholarships/${r.scholarship.slug}`} className="block rounded-lg border border-line p-3 hover:border-navy-600">
                        <p className="text-sm font-semibold">{r.scholarship.name}</p>
                        <p className="mt-1 text-xs text-muted">{r.eligibleCount} of {r.total} criteria met · closes {formatDate(r.scholarship.deadline)}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="size-4 text-navy-700" aria-hidden /> Recent feedback</CardTitle></CardHeader>
            <CardBody>
              {d.feedback.length === 0 ? (
                <p className="text-sm text-muted">No outstanding feedback. Submit an essay or document for review to get support.</p>
              ) : (
                <ul className="space-y-3">
                  {d.feedback.map((f) => (
                    <li key={f.id}>
                      <Link href={f.href} className="block rounded-lg border border-line p-3 hover:border-navy-600">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{f.kind} · {f.title}</p>
                        <p className="mt-1 line-clamp-2 text-sm">{f.body}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><UserRoundCheck className="size-4 text-navy-700" aria-hidden /> Pending referees</CardTitle>
              <Link href="/referees" className="text-sm font-semibold text-royal-700 hover:underline">Manage</Link>
            </CardHeader>
            <CardBody>
              {d.referees.length === 0 ? (
                <p className="text-sm text-muted">No reference letters outstanding.</p>
              ) : (
                <ul className="space-y-2">
                  {d.referees.map(({ r, scholarshipName }) => (
                    <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0"><strong>{r.refereeName}</strong><span className="block text-xs text-muted">{scholarshipName} · link expires {formatDate(r.tokenExpiresAt)}</span></span>
                      <RefereeStatusBadge status={r.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Bookmark className="size-4 text-navy-700" aria-hidden /> Saved scholarships</CardTitle>
            </CardHeader>
            <CardBody>
              {d.saved.length === 0 ? (
                <p className="text-sm text-muted">Save scholarships to compare them later.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {d.saved.slice(0, 5).map(({ s }) => (
                    <li key={s.id}><Link href={`/scholarships/${s.slug}`} className="font-medium hover:underline">{s.name}</Link></li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <Link href="/notifications" className="text-sm font-semibold text-royal-700 hover:underline">All</Link>
            </CardHeader>
            <CardBody>
              {d.recentNotifications.length === 0 ? (
                <p className="text-sm text-muted">You&apos;re all caught up.</p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {d.recentNotifications.map((n) => (
                    <li key={n.id} className={n.readAt ? "text-muted" : ""}>
                      <p className="font-medium">{n.subject}</p>
                      <p className="text-xs text-muted">{formatDateTime(n.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><NotebookPen className="size-4 text-navy-700" aria-hidden /> Learn something new</CardTitle></CardHeader>
            <CardBody>
              <ul className="space-y-2 text-sm">
                {d.resources.map(({ r }) => (
                  <li key={r.id}><Link href={`/resources/${r.slug}`} className="font-medium hover:underline">{r.title}</Link></li>
                ))}
              </ul>
              <Link href="/learn" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-royal-700 hover:underline">Browse the library <ArrowRight className="size-4" aria-hidden /></Link>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
