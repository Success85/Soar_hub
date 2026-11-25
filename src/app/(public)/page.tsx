import { Markdown } from "@/components/markdown";
import { HOME_FAQ } from "@/lib/data/faq";
import { ArrowRight, BadgeCheck, CalendarClock, CheckCircle2, ClipboardList, FileText, GraduationCap, HeartHandshake, MessageSquareQuote, NotebookPen, Search, ShieldCheck, Sparkles, UserRoundCheck } from "lucide-react";
import Link from "next/link";
import { ScholarshipCard } from "@/components/scholarship-card";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { educationalResources } from "@/lib/db/schema";
import { listPublicScholarships } from "@/lib/services/scholarships";
import { and, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

const STEPS = [
  { title: "Create your profile", body: "Tell us about your education and background — only what's needed, explained in plain language." },
  { title: "Explore opportunities", body: "Browse fully funded undergraduate scholarships verified against official university sources." },
  { title: "Check your eligibility", body: "Answer a few smart questions and see exactly which criteria you meet, and why." },
  { title: "Build your plan", body: "Get a personal roadmap that works backward from the official deadline." },
  { title: "Prepare your documents", body: "Upload, organise and version your transcript, CV, passport and more — securely." },
  { title: "Get feedback", body: "Reviewers and coaches give feedback on your essays and documents. AI suggestions are always checked by a person." },
  { title: "Submit with confidence", body: "Work through your checklist, then submit on the official university portal." },
];

const FEATURES = [
  { icon: Search, title: "Verified scholarship discovery", body: "Every published opportunity links to its official source with the date it was last verified." },
  { icon: BadgeCheck, title: "Explainable eligibility", body: "See which criteria you meet, which need more information, and what you can do about each one." },
  { icon: CalendarClock, title: "Deadline planner", body: "Milestones scheduled backward from the deadline, with email reminders so nothing slips." },
  { icon: FileText, title: "Secure document workspace", body: "Private storage, version history and reviewer comments linked to the exact passage." },
  { icon: NotebookPen, title: "Essay workspace & answer bank", body: "Draft in your own voice, keep your best stories, and find them again for new prompts." },
  { icon: UserRoundCheck, title: "Referee management", body: "Send referees a secure, time-limited upload link — no account needed — and track their status." },
];

const AUDIENCES = ["First-generation university applicants", "Young people from low-income households", "Young women and girls", "Persons with disabilities", "Refugees and displaced young people", "Students from underserved communities across all 36 states and the FCT"];


export default async function HomePage() {
  const [{ rows: featured, total }, [resCount]] = await Promise.all([
    listPublicScholarships({ pageSize: 3 }),
    db.select({ c: sql<number>`count(*)::int` }).from(educationalResources).where(and(eq(educationalResources.status, "published"), eq(educationalResources.visibility, "public"))),
  ]);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-navy-900 text-ivory">
        <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 size-[520px] rounded-full bg-gold-500/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-semibold text-gold-400">
              <Sparkles className="size-3.5" aria-hidden /> Fully funded undergraduate scholarships · Built for young Nigerians
            </p>
            <h1 className="mt-6 font-display text-[2.4rem] leading-[1.08] text-ivory sm:text-6xl">
              Your scholarship journey deserves more than <span className="text-gold-400">luck.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ivory/80">
              Discover opportunities, understand your eligibility, organise your application, and get guided support from preparation to submission.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" variant="gold">
                <Link href="/scholarships">
                  Explore scholarships <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outlineLight">
                <Link href="/register">Get application support</Link>
              </Button>
            </div>
            <p className="mt-6 text-sm text-ivory/60">Affordable membership. We help you prepare — universities make every final decision.</p>
          </div>
          <div aria-hidden className="relative hidden lg:block">
            <div className="rounded-2xl border border-white/10 bg-white p-5 text-navy-900 shadow-2xl">
              <p className="text-xs font-semibold uppercase tracking-widest text-gold-700">Your application roadmap</p>
              <p className="mt-1 font-display text-xl">Undergraduate Scholars Programme</p>
              <div className="mt-4 h-2 rounded-full bg-ivory-200">
                <div className="h-2 w-[62%] rounded-full bg-gold-500" />
              </div>
              <ul className="mt-5 space-y-3 text-sm">
                {[
                  ["Eligibility assessment", "Done", true],
                  ["Request referee letter", "Done", true],
                  ["Draft essay", "Due in 3 days", false],
                  ["Collect supporting documents", "Due in 9 days", false],
                  ["Final application review", "Planned", false],
                ].map(([t, s, done]) => (
                  <li key={t as string} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className={done ? "size-4 text-success-700" : "size-4 text-line"} />
                      {t}
                    </span>
                    <span className="text-xs text-muted">{s}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="absolute -bottom-6 -left-8 w-56 rounded-xl border border-line bg-white p-4 text-navy-900 shadow-xl">
              <p className="text-xs font-semibold text-success-700">Likely eligible</p>
              <p className="mt-1 text-sm">You meet 6 of 6 stated criteria.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Live platform facts — counts come from the database */}
      <section aria-label="Platform at a glance" className="border-b border-line bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-1 divide-y divide-line px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6">
          {[
            [String(total), total === 1 ? "verified opportunity open now" : "verified opportunities open now"],
            [String(resCount?.c ?? 0), "learning guides"],
            ["100%", "of AI feedback checked by a human"],
          ].map(([n, l]) => (
            <div key={l} className="flex items-baseline gap-3 py-5 sm:justify-center">
              <span className="font-display text-3xl text-navy-900">{n}</span>
              <span className="text-sm text-muted">{l}</span>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6" aria-labelledby="how">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-700">How it works</p>
        <h2 id="how" className="mt-2 max-w-2xl font-display text-3xl sm:text-4xl">From “Where do I start?” to “Application submitted.”</h2>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-[var(--radius-card)] border border-line bg-white p-5">
              <span className="flex size-9 items-center justify-center rounded-full bg-navy-900 font-display text-base text-gold-400">{i + 1}</span>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.body}</p>
            </li>
          ))}
          <li className="flex flex-col justify-between rounded-[var(--radius-card)] bg-gold-100 p-5">
            <p className="font-display text-xl text-navy-900">Ready to start?</p>
            <Button asChild className="mt-4 self-start">
              <Link href="/register">Create your account</Link>
            </Button>
          </li>
        </ol>
      </section>

      {/* Scholarships */}
      <section className="bg-ivory-200/60 py-20" aria-labelledby="opps">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-700">Scholarship opportunities</p>
              <h2 id="opps" className="mt-2 font-display text-3xl sm:text-4xl">Open now</h2>
              <p className="mt-2 max-w-xl text-muted">Sourced from official partner university websites and verified by our team before publication.</p>
            </div>
            <Button asChild variant="secondary">
              <Link href="/scholarships">
                View all scholarships <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
          {featured.length ? (
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {featured.map((s) => (
                <ScholarshipCard key={s.id} s={s} />
              ))}
            </div>
          ) : (
            <p className="mt-8 rounded-xl border border-dashed border-line bg-white p-8 text-center text-muted">No opportunities are open right now. New scholarships are added as soon as our team verifies them — create an account to be notified.</p>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6" aria-labelledby="features">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-700">What you get</p>
        <h2 id="features" className="mt-2 max-w-2xl font-display text-3xl sm:text-4xl">Structured guidance, not just a list of links</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-[var(--radius-card)] border border-line bg-white p-6">
              <Icon className="size-6 text-gold-600" aria-hidden />
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Who we support */}
      <section className="bg-navy-900 py-20 text-ivory" aria-labelledby="who">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-400">Who SOAR Hub supports</p>
            <h2 id="who" className="mt-2 font-display text-3xl text-ivory sm:text-4xl">Talent is everywhere. Access to guidance isn&apos;t — yet.</h2>
            <p className="mt-4 text-ivory/75">SOAR Hub is designed for young Nigerians aged 29 and below who face social or economic barriers to competing for fully funded opportunities.</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {AUDIENCES.map((a) => (
              <li key={a} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
                <HeartHandshake className="mt-0.5 size-5 shrink-0 text-gold-400" aria-hidden /> {a}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Educational impact */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6" aria-labelledby="impact">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-700">Educational impact</p>
            <h2 id="impact" className="mt-2 font-display text-3xl sm:text-4xl">Preparation that compounds</h2>
            <p className="mt-4 text-muted">A scholarship application teaches skills that last: telling your story with evidence, planning backward from a deadline, asking mentors for support, and presenting your achievements with confidence.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              [GraduationCap, "Clarity", "Know exactly what each opportunity requires."],
              [ClipboardList, "Completion", "Turn a big application into small, scheduled steps."],
              [ShieldCheck, "Confidence", "Submit materials that have been reviewed and refined."],
            ].map(([Icon, t, b]) => {
              const I = Icon as typeof GraduationCap;
              return (
                <div key={t as string} className="rounded-[var(--radius-card)] border border-line bg-white p-5">
                  <I className="size-6 text-navy-700" aria-hidden />
                  <h3 className="mt-3 font-semibold">{t as string}</h3>
                  <p className="mt-1 text-sm text-muted">{b as string}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testimonials — placeholders until real, consented testimonials are supplied */}
      <section className="bg-ivory-200/60 py-20" aria-labelledby="voices">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-700">Voices</p>
          <h2 id="voices" className="mt-2 font-display text-3xl sm:text-4xl">Stories from our community</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <figure key={i} className="rounded-[var(--radius-card)] border border-dashed border-line bg-white p-6">
                <MessageSquareQuote className="size-6 text-gold-600" aria-hidden />
                <blockquote className="mt-3 text-sm italic text-muted">Testimonial placeholder — real applicant stories will appear here once they are shared with consent.</blockquote>
                <figcaption className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Placeholder</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-24 px-4 py-20 sm:px-6" aria-labelledby="faq-title">
        <h2 id="faq-title" className="font-display text-3xl sm:text-4xl">Frequently asked questions</h2>
        <div className="mt-8 divide-y divide-line rounded-[var(--radius-card)] border border-line bg-white">
          {HOME_FAQ.map((f) => (
            <details key={f.q} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                {f.q}
                <span aria-hidden className="text-xl text-gold-600 transition-transform group-open:rotate-45">+</span>
              </summary>
              <div className="mt-3 text-[15px] leading-relaxed text-muted [&_.prose-soar]:text-muted [&_p]:my-1"><Markdown>{f.a}</Markdown></div>
            </details>
          ))}
        </div>
        <p className="mt-6 text-center"><Link href="/faq" className="font-semibold text-royal-700 hover:underline">See all frequently asked questions →</Link></p>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col items-start gap-6 rounded-2xl bg-gold-500 px-6 py-10 sm:px-10 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-3xl text-navy-950">Start preparing today.</h2>
            <p className="mt-2 max-w-xl text-navy-900/80">Your profile takes about ten minutes. Your future self will thank you.</p>
          </div>
          <Button asChild size="lg">
            <Link href="/register">
              Create your account <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
