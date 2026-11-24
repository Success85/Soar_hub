import type { Metadata } from "next";
import { Clock, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { Alert } from "@/components/ui/misc";
import { getRequestMeta } from "@/lib/request";
import { openRefereeLink } from "@/lib/services/referees";
import { formatDate, formatDateTime } from "@/lib/utils";
import { RefereeUploadForm } from "./upload-form";

export const metadata: Metadata = { title: "Reference letter upload", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function RefereePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const res = await openRefereeLink(token, await getRequestMeta());
  return (
    <div className="min-h-dvh bg-ivory">
      <header className="border-b border-line bg-white"><div className="mx-auto flex h-16 max-w-3xl items-center px-4"><Logo /></div></header>
      <main id="main" className="mx-auto max-w-3xl px-4 py-10">
        {res.state === "invalid" && <Alert tone="danger" title="This link isn't valid">Please check you used the full link from the email. If the problem continues, ask the applicant to send you a new request.</Alert>}
        {res.state === "expired" && <Alert tone="warning" title="This link has expired">Upload links are valid for a limited time. Please ask the applicant to send you a fresh request.</Alert>}
        {res.state === "used" && <Alert tone="success" title="A letter has already been submitted">This link has been used and is now closed. Thank you for your support.</Alert>}
        {res.state === "revoked" && <Alert tone="warning" title="This request was cancelled">The applicant or SOAR Hub has cancelled this request.</Alert>}
        {res.state === "valid" && "view" in res && res.view && (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-700">Reference request</p>
              <h1 className="mt-2 font-display text-3xl">Dear {res.view.refereeName},</h1>
              <p className="mt-3 text-[17px] leading-relaxed"><strong>{res.view.applicantName}</strong> has asked you to provide a reference letter for their application to <strong>{res.view.scholarshipName}</strong> at {res.view.university}.</p>
            </div>
            {res.view.message && <blockquote className="rounded-xl border-l-4 border-gold-500 bg-white p-4 text-[15px] italic">“{res.view.message}”<span className="mt-2 block text-sm not-italic text-muted">— {res.view.applicantName}</span></blockquote>}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-white p-4"><p className="flex items-center gap-2 text-sm font-semibold"><Clock className="size-4 text-gold-600" aria-hidden /> Please submit by</p><p className="mt-1">{formatDate(res.view.deadline, { day: "numeric", month: "long", year: "numeric" })}</p><p className="text-xs text-muted">Link expires {formatDateTime(res.view.expiresAt)}</p></div>
              <div className="rounded-xl border border-line bg-white p-4"><p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="size-4 text-success-700" aria-hidden /> Private & secure</p><p className="mt-1 text-sm text-muted">Your letter is stored privately. This link works once and only for this request — no account needed.</p></div>
            </div>
            <section className="rounded-xl border border-line bg-white p-5">
              <h2 className="font-semibold">Guidance for your letter</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                <li>Describe how you know the applicant and for how long.</li>
                <li>Give specific examples of their academic ability, character, leadership or service.</li>
                <li>Use your institution&apos;s letterhead if possible, and include your contact details.</li>
              </ul>
            </section>
            <section className="rounded-[var(--radius-card)] border border-line bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold">Upload your letter</h2>
              <RefereeUploadForm token={token} maxMb={res.view.maxMb} refereeName={res.view.refereeName} applicantName={res.view.applicantName} />
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
