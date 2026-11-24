import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { FAQ_SECTIONS } from "@/lib/data/faq";

export const metadata: Metadata = {
  title: "Frequently asked questions",
  description: "Answers about the Mastercard Foundation Scholars Program, eligibility, documents, essays, recommendation letters and using SOAR Hub.",
};

const plain = (md: string) => md.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\*\*/g, "");

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_SECTIONS.flatMap((s) => s.items).map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: plain(i.a) } })),
  };
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-700">Help centre</p>
      <h1 className="mt-2 font-display text-4xl">Frequently asked questions</h1>
      <p className="mt-2 max-w-2xl text-muted">Quick answers about the scholarships, eligibility, documents and how SOAR Hub works. For the full step-by-step process, read the <Link href="/guide" className="font-semibold text-royal-700 underline">application guide</Link>.</p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[240px_1fr]">
        <nav aria-label="FAQ topics" className="lg:sticky lg:top-24 lg:self-start">
          <h2 className="text-sm font-semibold">Topics</h2>
          <ul className="mt-3 flex flex-wrap gap-2 lg:flex-col lg:gap-1">
            {FAQ_SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="block rounded-full border border-line bg-white px-3 py-1.5 text-sm hover:border-navy-600 lg:rounded-lg lg:border-0 lg:bg-transparent lg:px-2 lg:hover:bg-ivory-200">
                  {s.title} <span className="text-muted">({s.items.length})</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-12">
          {FAQ_SECTIONS.map((s) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="scroll-mt-24">
              <h2 id={`${s.id}-title`} className="font-display text-2xl">{s.title}</h2>
              <div className="mt-4 divide-y divide-line rounded-[var(--radius-card)] border border-line bg-white">
                {s.items.map((f) => (
                  <details key={f.id} id={f.id} className="group scroll-mt-24 p-5">
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                      {f.q}
                      <span aria-hidden className="text-xl leading-none text-gold-600 transition-transform group-open:rotate-45">+</span>
                    </summary>
                    <div className="mt-2 text-muted [&_.prose-soar]:text-navy-800 [&_p]:my-1">
                      <Markdown>{f.a}</Markdown>
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ))}

          <div className="flex flex-col items-start gap-4 rounded-2xl bg-navy-900 p-6 text-ivory sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-display text-2xl">Still have a question?</p>
              <p className="mt-1 text-ivory/80">Send us a message and we&apos;ll reply by email.</p>
            </div>
            <Button asChild variant="gold"><Link href="/contact">Contact us <ArrowRight aria-hidden /></Link></Button>
          </div>
        </div>
      </div>
    </div>
  );
}
