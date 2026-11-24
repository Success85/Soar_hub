import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CircleHelp, Compass } from "lucide-react";
import { ResourceLibrary } from "@/components/resource-library";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Learning resources", description: "Free scholarship application guides, sample SOP, CV template, recommendation letter sample, essay advice and interview preparation." };
export const dynamic = "force-dynamic";

export default async function ResourcesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [user, sp] = await Promise.all([getCurrentUser(), searchParams]);
  const filtering = !!(sp.q || sp.category || sp.tag || sp.type);
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-700">Learning library</p>
      <h1 className="mt-2 font-display text-4xl">Learn how to apply with confidence</h1>
      <p className="mt-2 max-w-2xl text-muted">Free guidance written for young Nigerians applying to fully funded scholarships: sample documents with explanations, templates and step-by-step guides.</p>

      {!filtering && (
        <div className="mt-8 grid gap-4 md:grid-cols-[1.6fr_1fr]">
          <Link href="/guide" className="group relative overflow-hidden rounded-2xl bg-navy-900 p-6 text-ivory sm:p-8">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-gold-400"><Compass className="size-4" aria-hidden /> Start here</p>
            <h2 className="mt-3 font-display text-3xl leading-tight text-ivory">How to apply: the complete guide</h2>
            <p className="mt-2 max-w-xl text-ivory/80">How the Mastercard Foundation Scholars Program works, eligibility, the ACCESS code, essays, video, documents and a 24-hour action plan.</p>
            <span className="mt-5 inline-flex items-center gap-1.5 font-semibold text-gold-400">Read the guide <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden /></span>
          </Link>
          <Link href="/faq" className="group rounded-2xl border border-line bg-white p-6 hover:border-navy-600 sm:p-8">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-gold-700"><CircleHelp className="size-4" aria-hidden /> Quick answers</p>
            <h2 className="mt-3 font-display text-2xl leading-tight">Frequently asked questions</h2>
            <p className="mt-2 text-sm text-muted">Age limits, documents, fees, referees, video and more.</p>
            <span className="mt-5 inline-flex items-center gap-1.5 font-semibold text-royal-700">Browse the FAQ <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden /></span>
          </Link>
        </div>
      )}

      <h2 className="mb-4 mt-12 font-display text-2xl">{filtering ? "Search results" : "All resources"}</h2>
      <ResourceLibrary searchParams={sp} basePath="/resources" includeApplicantOnly={!!user} />
    </div>
  );
}
