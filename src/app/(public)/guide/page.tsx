import type { Metadata } from "next";
import Link from "next/link";
import { requireMemberPage } from "@/lib/auth/session";
import { AlertTriangle, ArrowRight, Check, CircleCheck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "How to apply: the complete guide",
  description: "Step-by-step guidance on Mastercard Foundation Scholars Program applications: eligibility, the ACCESS code, essays, video, documents and a 24-hour action plan.",
};

const TOC = [
  ["for-you", "Is this for you?"],
  ["covers", "What a full scholarship covers"],
  ["how-it-works", "How the Scholars Program works"],
  ["where", "Where you can apply"],
  ["eligibility", "Check eligibility"],
  ["access-code", "The ACCESS code"],
  ["impact", "Show real impact"],
  ["essay", "Write the essay"],
  ["evidence", "Evidence to include"],
  ["video", "The video application"],
  ["documents", "Prepare your documents"],
  ["timeline", "Your 12-month timeline"],
  ["action-plan", "Your 24-hour action plan"],
  ["safety", "Stay safe"],
  ["sources", "Official sources"],
] as const;

function Section({ id, eyebrow, title, children, className }: { id: string; eyebrow: string; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("scroll-mt-24 border-t border-line pt-10", className)}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-700">{eyebrow}</p>
      <h2 id={`${id}-title`} className="mt-2 font-display text-3xl leading-tight">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Col({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="border-b-2 border-gold-500 pb-2 text-xs font-semibold uppercase tracking-[0.14em] text-gold-700">{title}</h3>
      <ul className="divide-y divide-line text-[15px]">
        {items.map((i) => <li key={i} className="py-2">{i}</li>)}
      </ul>
    </div>
  );
}

function Note({ children, tone = "navy" }: { children: React.ReactNode; tone?: "navy" | "gold" }) {
  return <div className={cn("mt-6 rounded-xl px-5 py-4 text-[15px]", tone === "navy" ? "bg-navy-900 text-ivory" : "bg-gold-500 text-navy-950")}>{children}</div>;
}

const ACCESS = [
  ["A", "Academics", "Can you handle the work? Grades, improvement, awards."],
  ["C", "Contribution", "What did you do with what you had?"],
  ["C", "Clear vision", "What will you solve, and for whom?"],
  ["E", "Economic need", "Why is support necessary? Tell it honestly."],
  ["S", "Story and evidence", "Show what you did with what happened. Prove it."],
  ["S", "Start now", "Prepare before the call opens."],
] as const;

const ESSAY = [
  ["1", "The hook and your background", "A real moment, then the barrier that shaped you. Not “Education is the key to success.”"],
  ["2", "What you did despite it", "Action and evidence: work, projects, leadership, service."],
  ["3", "Your vision, and why this scholarship", "The course, the place, the problem, who benefits."],
  ["4", "Your conclusion", "Return to your opening. Show why you're worth investing in."],
] as const;

const SOURCES = [
  ["Mastercard Foundation: Where to Apply (official partner directory)", "https://mastercardfdn.org/en/what-we-do/our-programs/mastercard-foundation-scholars-program/where-to-apply/"],
  ["Mastercard Foundation: Scholars Program and FAQs", "https://mastercardfdn.org/apply"],
  ["Mastercard Foundation: Becoming a Scholar (age guidance)", "https://mastercardfdn.org/all/scholars/becoming-a-scholar/"],
  ["Mastercard Foundation: Young Africa Works", "https://mastercardfdn.org/en/the-young-africa-works-strategy/"],
  ["UC Berkeley: Scholars Program partner list", "https://mcfscholarsprogram.berkeley.edu/partner-universities"],
  ["UNHCR Rwanda: current Scholars Program calls (Oct 2026)", "https://help.unhcr.org/rwanda/2026/10/09/call-for-application-different-under-and-postgraduate-scholarship-opportunities-under-mastercard-foundation-scholars-programme/"],
  ["Arizona State University: 2026 call and eligibility", "https://mcfscholars.asu.edu/phase-three-innovation-and-technology"],
  ["University of Edinburgh: eligibility", "https://edinburgh-global.ed.ac.uk/mastercard-foundation-scholars-program/apply-for-a-scholarship/eligibility"],
  ["Makerere University: 2026/27 undergraduate call", "https://apply.mastercardfoundation.mak.ac.ug/announcements/28"],
] as const;

export default async function GuidePage() {
  await requireMemberPage("/guide");
  return (
    <>
      <section className="bg-navy-900 text-ivory">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-400">The Scholarship Access Code · Application guide</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl leading-tight text-ivory sm:text-5xl">How to apply for a fully funded scholarship, step by step</h1>
          <p className="mt-4 max-w-2xl text-ivory/80">Where the opportunities are, what they require and how to prepare, with a plan you can start in the next 24 hours.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="gold"><Link href="#action-plan">Jump to the action plan <ArrowRight aria-hidden /></Link></Button>
            <Button asChild variant="outlineLight"><Link href="/scholarships">Browse scholarships</Link></Button>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[220px_1fr]">
        <nav aria-label="On this page" className="lg:sticky lg:top-24 lg:self-start">
          <details className="rounded-xl border border-line bg-white p-4 lg:border-0 lg:bg-transparent lg:p-0" open>
            <summary className="cursor-pointer text-sm font-semibold lg:pointer-events-none lg:list-none">On this page</summary>
            <ol className="mt-3 space-y-1.5 text-sm">
              {TOC.map(([id, label], i) => (
                <li key={id}><a href={`#${id}`} className="flex gap-2 text-navy-800 hover:text-royal-700 hover:underline"><span className="w-5 shrink-0 text-right text-muted">{i + 1}.</span>{label}</a></li>
              ))}
            </ol>
          </details>
        </nav>

        <div className="min-w-0 space-y-14">
          <Section id="for-you" eyebrow="Start here" title="Is this opportunity meant for someone like me?">
            <ul className="grid gap-x-8 sm:grid-cols-2">
              {[
                "You've studied without electricity, or by the light of a phone.",
                "You work, trade or care for siblings while you study.",
                "You've missed an exam, a term or a year because of money.",
                "You've taught, helped or built something for someone else.",
                "You'd be the first in your family to go to university.",
                "You have a dream that is bigger than your bank account.",
              ].map((t) => <li key={t} className="flex gap-2 border-b border-line py-2.5 text-[15px]"><Check className="mt-0.5 size-4 shrink-0 text-gold-600" aria-hidden />{t}</li>)}
            </ul>
            <p className="mt-5 font-display text-xl text-navy-900">If even one of these is true for you, read on. These scholarships were built for people like you. Your job is to get ready.</p>
            <p className="mt-2 text-sm text-muted">If your education was delayed, paused or interrupted, you are not alone, and it does not disqualify you. Each scholarship still has its own eligibility criteria; step 5 shows how to check them.</p>
          </Section>

          <Section id="covers" eyebrow="Understanding the opportunity" title="A fully funded scholarship is more than tuition">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Studying", ["Full tuition", "Books and materials", "Laptop or equipment", "Academic support"]],
                ["Living", ["Accommodation", "Living stipend", "Meals or food allowance", "Health insurance or care"]],
                ["Getting there", ["Travel and relocation", "Visa support, where it applies", "Psychosocial support"]],
                ["Growing", ["Mentorship", "Leadership development", "Internships and career transition", "Networks"]],
              ].map(([t, items]) => (
                <div key={t as string} className="rounded-xl border border-line bg-white p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-700">{t}</h3>
                  <ul className="mt-2 space-y-1.5 text-[15px]">{(items as string[]).map((i) => <li key={i}>{i}</li>)}</ul>
                </div>
              ))}
            </div>
            <Note>The exact package depends on the university, scholarship, programme and terms. <strong className="text-gold-400">Always read the official scholarship information.</strong></Note>
          </Section>

          <Section id="how-it-works" eyebrow="The Mastercard Foundation" title="You apply through a partner university, not the Foundation">
            <p className="max-w-3xl text-[15px] text-navy-800">The Mastercard Foundation is an independent foundation, separate from the Mastercard company, working almost entirely in Africa. Its Scholars Program funds talented, service-oriented young people facing barriers to higher education, at secondary, undergraduate and master&apos;s level.</p>
            <dl className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[["58,000+", "Scholars supported"], ["71%", "of Scholars are women"], ["62", "global partner institutions"], ["100,000", "scholarships: the 2030 goal"]].map(([v, l]) => (
                <div key={l} className="border-t-2 border-gold-500 pt-2"><dt className="sr-only">{l}</dt><dd><span className="block font-display text-3xl text-navy-900">{v}</span><span className="text-sm text-muted">{l}</span></dd></div>
              ))}
            </dl>
            <p className="mt-2 text-xs text-muted">Source: Mastercard Foundation, Scholars Program and Young Africa Works pages (accessed November 2026).</p>
            <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {["The Mastercard Foundation funds the program", "Partner universities and institutions receive the funding", "Each partner runs its own scholarship program", "You apply to that institution", "The institution evaluates candidates", "It makes the admission and scholarship decisions"].map((t, i) => (
                <li key={t} className={cn("rounded-xl border p-4", i === 3 ? "border-royal-600 bg-white text-royal-700" : "border-line bg-white")}>
                  <span className="font-display text-2xl text-gold-600">{i + 1}</span>
                  <p className="mt-1 font-semibold">{t}</p>
                </li>
              ))}
            </ol>
            <h3 className="mt-8 text-xs font-semibold uppercase tracking-[0.14em] text-gold-700">Each institution sets its own</h3>
            <ul className="mt-2 grid grid-cols-2 gap-x-6 text-[15px] sm:grid-cols-4">
              {["Courses", "Eligibility", "Age limits", "Application forms", "Documents", "Deadlines", "Benefits", "Selection process"].map((t) => <li key={t} className="border-b border-line py-2">{t}</li>)}
            </ul>
            <Note><strong className="text-gold-400">Admission does not guarantee a scholarship.</strong> The Foundation never asks you for money. If a partner charges an application fee, it is refunded if you are selected.</Note>
          </Section>

          <Section id="where" eyebrow="Where can you apply?" title="Opportunities exist across Africa and beyond. Your job is to find the right one.">
            <p className="max-w-3xl text-[15px] text-navy-800">SOAR Hub lists the Mastercard Foundation partner opportunities in one place, grouped into undergraduate and postgraduate study in Africa and outside Africa, with each one&apos;s current window, next expected window, eligibility and documents.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ["Undergraduate in Africa", "/scholarships?category=ug_africa", "ALU, Ashesi, University of Rwanda, USIU-Africa, Makerere and more"],
                ["Undergraduate outside Africa", "/scholarships?category=ug_outside_africa", "EARTH University, UBC and other partners"],
                ["Postgraduate in Africa", "/scholarships?category=pg_africa", "Carnegie Mellon Africa, Cape Town, Pretoria, AIMS and more"],
                ["Postgraduate outside Africa", "/scholarships?category=pg_outside_africa", "Edinburgh, Cambridge, McGill, Toronto, ASU and more"],
              ].map(([t, href, d]) => (
                <Link key={t} href={href} className="group rounded-xl border border-line bg-white p-4 hover:border-navy-600">
                  <p className="flex items-center justify-between font-semibold">{t} <ArrowRight className="size-4 text-royal-700 transition-transform group-hover:translate-x-0.5" aria-hidden /></p>
                  <p className="mt-1 text-sm text-muted">{d}</p>
                </Link>
              ))}
            </div>
            <p className="mt-4 rounded-lg border-l-4 border-gold-500 bg-white px-4 py-3 text-sm">A listed partner is not the same as an open call. Check each official page for current dates.</p>
          </Section>

          <Section id="eligibility" eyebrow="Age and eligibility" title="Check the exact call. Every time.">
            <div className="grid gap-6 md:grid-cols-[1fr_1.3fr]">
              <div className="space-y-5">
                <div className="border-t-2 border-gold-500 pt-2"><p className="font-display text-5xl text-navy-900">29</p><p className="text-[15px]">or under when you apply: undergraduate (bachelor&apos;s)</p></div>
                <div className="border-t-2 border-gold-500 pt-2"><p className="font-display text-5xl text-navy-900">35</p><p className="text-[15px]">or under when you apply: master&apos;s</p></div>
                <p className="text-sm text-muted">This is the Foundation&apos;s general guidance. Partners can be stricter or different. For example, ASU&apos;s 2026 graduate certificate call asked for ages 18–33.</p>
              </div>
              <div className="rounded-xl bg-navy-900 p-5 text-ivory">
                <h3 className="font-semibold text-gold-400">Before you start any application</h3>
                <ul className="mt-3 space-y-2 text-[15px]">
                  {["Am I within the age limit?", "Is my country eligible?", "Is my course offered?", "Is my level of study eligible?", "Do I meet the academic requirements?", "Am I in the scholarship's target groups?", "Do I meet the financial-need requirements?", "Do I have the required documents?", "Can I meet the deadline?"].map((q) => <li key={q} className="flex gap-2"><CircleCheck className="mt-0.5 size-4 shrink-0 text-gold-400" aria-hidden />{q}</li>)}
                </ul>
                <Button asChild variant="gold" className="mt-5"><Link href="/scholarships">Check my eligibility on SOAR Hub</Link></Button>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted">Sources: Mastercard Foundation, Becoming a Scholar; Arizona State University Mastercard Foundation Scholars Program (2026 call).</p>
          </Section>

          <Section id="access-code" eyebrow="The Access Code · a scholarship is an investment, not a reward" title="Six letters to remember what providers invest in">
            <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ACCESS.map(([l, t, d], i) => (
                <li key={t} className={cn("rounded-xl p-5", i === 5 ? "bg-gold-500 text-navy-950" : "bg-navy-900 text-ivory")}>
                  <span aria-hidden className={cn("font-display text-5xl", i === 5 ? "text-navy-950" : i === 4 ? "text-royal-100" : "text-gold-400")}>{l}</span>
                  <p className="mt-2 font-semibold">{t}</p>
                  <p className={cn("mt-1 text-sm", i === 5 ? "text-navy-900" : "text-ivory/80")}>{d}</p>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-muted">A framework by Success Ituma for explaining what makes a strong candidate. It is not a universal scoring system: every institution has its own criteria.</p>
          </Section>

          <Section id="impact" eyebrow="You don't need to have founded an NGO" title="Impact is not always loud. But it should be real.">
            <div className="grid gap-6 sm:grid-cols-3">
              <Col title="At school" items={["Teaching someone", "Helping a classmate", "Organising a school activity"]} />
              <Col title="At home and in your community" items={["Helping your family", "Supporting younger children", "Volunteering"]} />
              <Col title="By creating" items={["Building a small project", "Solving a problem you noticed", "Taking initiative"]} />
            </div>
            <div className="mt-6 grid items-center gap-3 md:grid-cols-[1fr_auto_1.4fr]">
              <div className="rounded-xl border border-line bg-white p-5"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-700">A claim</p><p className="mt-1 font-display text-xl">“I am passionate about education.”</p></div>
              <ArrowRight className="mx-auto size-6 rotate-90 text-gold-600 md:rotate-0" aria-hidden />
              <div className="rounded-xl bg-navy-900 p-5 text-ivory"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-400">Evidence (an example)</p><p className="mt-1 font-display text-xl">“For a year, I taught six children on my street to read every Saturday. Four now read on their own.”</p></div>
            </div>
          </Section>

          <Section id="essay" eyebrow="The essay · not a poverty report, a list or a speech" title="Show not only what happened to you, but what you did with what happened">
            <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {ESSAY.map(([n, t, d], i) => (
                <li key={n} className={cn("rounded-xl border p-4", i === 3 ? "border-navy-900 bg-navy-900 text-ivory" : "border-line bg-white")}>
                  <span className="font-display text-2xl text-gold-600">{n}</span>
                  <p className="mt-1 font-semibold">{t}</p>
                  <p className={cn("mt-1 text-sm", i === 3 ? "text-ivory/80" : "text-muted")}>{d}</p>
                </li>
              ))}
            </ol>
            <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-white">
              <table className="w-full min-w-[520px] text-sm">
                <caption className="sr-only">Suggested word budget for each part of the essay</caption>
                <thead className="bg-navy-900 text-left text-ivory">
                  <tr><th scope="col" className="px-4 py-2.5">Essay length</th><th scope="col" className="px-4 py-2.5">1 · Hook</th><th scope="col" className="px-4 py-2.5">2 · Action</th><th scope="col" className="px-4 py-2.5">3 · Vision</th><th scope="col" className="px-4 py-2.5">4 · Close</th></tr>
                </thead>
                <tbody>
                  <tr className="border-t border-line"><th scope="row" className="px-4 py-2.5 text-left font-semibold">300–500 words</th><td className="px-4 py-2.5">60–100</td><td className="px-4 py-2.5">90–150</td><td className="px-4 py-2.5">105–175</td><td className="px-4 py-2.5">45–75</td></tr>
                  <tr className="border-t border-line bg-ivory/60"><th scope="row" className="px-4 py-2.5 text-left font-semibold">500–800 words</th><td className="px-4 py-2.5">100–160</td><td className="px-4 py-2.5">150–240</td><td className="px-4 py-2.5">175–280</td><td className="px-4 py-2.5">75–120</td></tr>
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-sm text-muted">Most schools ask for 300–500 words; some ask for 500–800. This is a rough guide: always follow the exact prompt.</p>
            <p className="mt-4 text-[15px]">Learn from examples: <Link href="/resources/statement-of-purpose-sample-explained" className="font-semibold text-royal-700 underline">Statement of purpose: a sample, explained</Link>. Then draft in your own words in the Essays workspace.</p>
          </Section>

          <Section id="evidence" eyebrow="Show, don't claim" title="What evidence should you include?">
            <div className="grid gap-6 sm:grid-cols-3">
              <Col title="Academic" items={["Grades and improvement", "Awards and certificates", "Competitions", "Research"]} />
              <Col title="Leadership and service" items={["Leadership roles", "Volunteering and community work", "Teaching and mentoring", "Family responsibilities"]} />
              <Col title="Work and proof" items={["Projects you built", "Work experience", "Achievements", "Recommendation letters, where asked"]} />
            </div>
            <div className="mt-6 rounded-xl border-t-4 border-gold-500 bg-white p-5">
              <p className="font-semibold">Applying for a master&apos;s? Add weight to:</p>
              <p className="mt-1 text-[15px] text-navy-800">Undergraduate results · research, publications and your final-year project · professional experience · certifications · <strong className="text-royal-700">why this degree is the logical next step</strong>.</p>
            </div>
          </Section>

          <Section id="video" eyebrow="The video application" title="A video is your chance to be heard in your own voice">
            <div className="grid gap-6 sm:grid-cols-3">
              <Col title="Before you record" items={["Read the prompt carefully", "Follow the exact time limit", "Answer their question: who you are, what shaped you, what you've done, your vision"]} />
              <Col title="Your setup" items={["Clear audio, in a quiet room", "Good light: face a window", "A simple background", "Look at the camera"]} />
              <Col title="Your delivery" items={["Speak naturally", "Don't sound robotic", "Don't just read your essay", "Be authentic"]} />
            </div>
            <Note tone="gold">Use your own voice, words and experiences. AI can help you check grammar, but it must never invent your story.</Note>
          </Section>

          <Section id="documents" eyebrow="Don't wait until applications open" title="Your opportunity may open tomorrow. Your documents should not be a problem tomorrow.">
            <div className="grid gap-6 md:grid-cols-3">
              <Col title="Admission documents" items={["Grade 10–12 results", "WAEC result, notarised where required", "NIN and birth certificate", "International passport", "Equivalence certificate (e.g. Rwanda)", "Police character certificate, if required", "Two recommendation letters", "English proficiency (IELTS, Duolingo, SAT, etc.), depending on the school"]} />
              <Col title="Scholarship documents" items={["Sponsor's bank statement, if requested", "School fees receipts, if requested", "Sponsor's job declaration, if requested", "Recommendation letters", "Scholarship essay", "Video application"]} />
              <Col title="Your scholarship folder" items={["01 · Academic documents", "02 · Identification", "03 · Financial documents", "04 · Recommendations", "05 · Essays and statements", "06 · Videos", "07 · Applications and emails"]} />
            </div>
            <p className="mt-3 text-sm text-muted">An example checklist. Requirements differ by institution, scholarship, country and course. Each scholarship page on SOAR Hub lists its own documents.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[["CV template, explained", "/resources/alu-cv-template-explained"], ["Recommendation letter sample", "/resources/recommendation-letter-sample-explained"], ["SOP sample, explained", "/resources/statement-of-purpose-sample-explained"]].map(([t, h]) => (
                <Link key={h} href={h} className="flex items-center justify-between rounded-xl border border-line bg-white p-4 text-sm font-semibold hover:border-navy-600">{t} <ArrowRight className="size-4 text-royal-700" aria-hidden /></Link>
              ))}
            </div>
          </Section>

          <Section id="timeline" eyebrow="Picture this" title="A year from now, you could be opening an email that begins “Congratulations…”">
            <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[["Today", "You decide. You create your scholarship folder."], ["This week", "You pick your course, five universities and three scholarships."], ["In 3 months", "Documents ready. Essay drafted. Referees asked."], ["In 12 months", "Applications in. Your name on a list of new Scholars."]].map(([t, d], i) => (
                <li key={t} className={cn("rounded-xl border-t-4 border-gold-500 p-5", i === 3 ? "bg-gold-500 text-navy-950" : "bg-navy-900 text-ivory")}>
                  <p className={cn("text-xs font-semibold uppercase tracking-[0.14em]", i === 3 ? "text-navy-900" : "text-gold-400")}>{t}</p>
                  <p className="mt-2 text-[15px]">{d}</p>
                </li>
              ))}
            </ol>
            <p className="mt-5 border-l-4 border-gold-500 pl-4 text-[15px]">Or a year from now, you&apos;re still saying “I don&apos;t know how.” The only difference between those two futures is what you do this week.</p>
          </Section>

          <Section id="action-plan" eyebrow="Don't close this tab yet" title="You don't have to apply today. But you can start preparing today.">
            <div className="grid gap-6 md:grid-cols-3">
              <Col title="In the next 24 hours" items={["1 · Write down the course you want to study", "2 · Create your scholarship folder", "3 · List the documents you already have"]} />
              <Col title="This week" items={["4 · Pick your top 5 universities", "5 · Read three scholarships' official pages", "6 · List what you're missing, and start on one"]} />
              <Col title="Before every application" items={["Course and level offered", "Country, age and academic rules", "Target groups and financial need", "Documents and deadline", "The official application page"]} />
            </div>
            <div className="mt-6 flex flex-col items-start gap-4 rounded-xl bg-navy-900 p-6 text-ivory sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[15px]">Right now: decide the <strong className="text-gold-400">one thing you&apos;ll do in the next 24 hours.</strong> Then go and do it.</p>
              <Button asChild variant="gold"><Link href="/dashboard">Go to my dashboard</Link></Button>
            </div>
          </Section>

          <Section id="safety" eyebrow="Stay safe" title="Apply only through official pages">
            <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-5 text-[15px] text-red-900">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
              <div>
                <p className="font-semibold">Never pay an agent for a scholarship form.</p>
                <p className="mt-1">The Mastercard Foundation never asks for money. Submit your application only on the official university or foundation page. SOAR Hub helps you prepare, but it never submits applications for you and never guarantees selection.</p>
              </div>
            </div>
          </Section>

          <Section id="sources" eyebrow="Keep these links" title="Official sources and where to find opportunities">
            <ul className="grid gap-2 sm:grid-cols-2">
              {SOURCES.map(([t, u]) => (
                <li key={u}><a href={u} target="_blank" rel="noopener noreferrer" className="flex items-start gap-1.5 text-[15px] text-royal-700 underline underline-offset-2 hover:text-navy-900">{t}<ExternalLink className="mt-1 size-3.5 shrink-0" aria-hidden /></a></li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-muted">Still have questions? Read the <Link href="/faq" className="font-semibold text-royal-700 underline">frequently asked questions</Link>.</p>
          </Section>
        </div>
      </div>
    </>
  );
}
