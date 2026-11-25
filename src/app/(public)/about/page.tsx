import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "About", description: "SOAR Hub's mission: equitable access to transformative education for young Africans." };

const VALUES = [
  ["Access", "Opportunity shouldn't depend on who you know or what you can afford. We keep membership affordable."],
  ["Clarity", "Plain language, honest explanations, and no unsupported promises."],
  ["Empowerment", "We help you tell your own story in your own voice — we never write it for you."],
  ["Integrity", "Scholarship information comes only from official sources, verified by people, with dates you can check."],
  ["Privacy", "Your data belongs to you. We collect only what's needed and you can export or delete it any time."],
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-700">About SOAR Hub</p>
      <h1 className="mt-2 font-display text-4xl sm:text-5xl">Equipping talent to meet opportunity.</h1>
      <section className="mt-10 space-y-4 text-[17px] leading-relaxed">
        <h2 className="font-display text-2xl">Our mission</h2>
        <p>To expand equitable access to transformative educational opportunities for young Africans from underserved communities — particularly women and people facing social or economic barriers — starting with Nigerians, by equipping them with strategic guidance and technological infrastructure to compete for fully funded scholarship opportunities.</p>
      </section>
      <section className="mt-10 space-y-4 text-[17px] leading-relaxed">
        <h2 className="font-display text-2xl">The problem</h2>
        <p>Fully funded scholarships exist — but finding the real ones, understanding their requirements, organising documents, securing references and writing a compelling essay before the deadline is hard. Students with access to counsellors and well-connected mentors navigate this far more easily. Many brilliant young people from low-income homes, rural communities or first-generation families never complete an application, not because they lack ability, but because they lack structured support.</p>
      </section>
      <section className="mt-10 space-y-4 text-[17px] leading-relaxed">
        <h2 className="font-display text-2xl">Our solution</h2>
        <p>SOAR Hub turns a complex application into a guided journey: verified opportunities, explainable eligibility checks, a personal deadline plan, a secure document workspace, essay feedback from human reviewers (with AI suggestions that a person always checks first), and simple referee management. We support preparation — universities make every decision, and we never guarantee outcomes.</p>
      </section>
      <section className="mt-10">
        <h2 className="font-display text-2xl">Who we support</h2>
        <p className="mt-3 text-[17px] leading-relaxed">Version 1 focuses on Nigerian applicants aged 29 and below applying for undergraduate scholarships offered by partner universities of programmes such as the Mastercard Foundation Scholars Program — especially first-generation applicants, young women, persons with disabilities, refugees and displaced young people, and those from low-income households.</p>
      </section>
      <section className="mt-10">
        <h2 className="font-display text-2xl">Our values</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          {VALUES.map(([k, v]) => <div key={k} className="rounded-[var(--radius-card)] border border-line bg-white p-5"><dt className="font-semibold">{k}</dt><dd className="mt-1 text-sm text-muted">{v}</dd></div>)}
        </dl>
      </section>
      <div className="mt-12 flex flex-wrap gap-3"><Button asChild size="lg"><Link href="/register">Get started</Link></Button><Button asChild size="lg" variant="secondary"><Link href="/contact">Contact us</Link></Button></div>
    </div>
  );
}
