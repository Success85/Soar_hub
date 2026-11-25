import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, CalendarClock, Check, FileText, GraduationCap, Lock, NotebookPen, ShieldCheck, UserRoundCheck } from "lucide-react";
import { startMembershipCheckoutAction } from "@/app/actions/portal";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";
import { flutterwaveStatus } from "@/lib/integrations/flutterwave";
import { isExemptFromMembership, membershipState, paymentsForUser } from "@/lib/services/membership";
import { getSettings } from "@/lib/services/settings";
import { formatDate, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Membership", description: "Unlock every SOAR Hub feature: the full scholarship directory, eligibility checks, planner, documents, essays and expert feedback." };
export const dynamic = "force-dynamic";

const naira = (n: number) => `₦${n.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;

const FEATURES = [
  { icon: GraduationCap, title: "Full scholarship directory", body: "Every partner scholarship with its current and next window, eligibility, documents and official links." },
  { icon: BadgeCheck, title: "Eligibility checker", body: "See, criterion by criterion, which scholarships you're likely eligible for." },
  { icon: CalendarClock, title: "Application planner", body: "A plan built backward from each deadline, with email reminders." },
  { icon: FileText, title: "Document workspace", body: "Private storage, checklists for every application and reviewer comments." },
  { icon: NotebookPen, title: "Essays, feedback and AI critique", body: "Draft in your own voice; reviewers and reviewer-approved AI feedback help you improve." },
  { icon: UserRoundCheck, title: "Referee requests", body: "Send referees a secure upload link and track their letters." },
];

export default async function MembershipPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [user, s, { next }] = await Promise.all([getCurrentUser(), getSettings(), searchParams]);
  const price = Number(s.membership_price_ngn);
  const months = Number(s.membership_duration_months);
  const period = months === 0 ? "one-time payment, lifetime access" : months === 12 ? "per year" : `for ${months} months`;
  const staff = !!user && isExemptFromMembership(user.roles);
  const state = user && !staff ? await membershipState(user.id) : null;
  const history = user && !staff ? await paymentsForUser(user.id) : [];
  const payReady = flutterwaveStatus().configured;
  const blocked = !!next;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      {blocked && !state?.active && !staff && (
        <p className="mb-6 flex items-center gap-2 rounded-xl border border-gold-500/40 bg-gold-50 px-4 py-3 text-sm">
          <Lock className="size-4 shrink-0 text-gold-700" aria-hidden /> That page is for SOAR Hub members. Join below to unlock it and everything else.
        </p>
      )}
      <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-700">SOAR Hub membership</p>
          <h1 className="mt-2 font-display text-4xl leading-tight sm:text-5xl">Everything you need to apply, in one place</h1>
          <p className="mt-3 max-w-xl text-muted">The home page, About, Contact and FAQ are free for everyone. Members unlock the full platform.</p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-3 rounded-xl border border-line bg-white p-4">
                <f.icon className="mt-0.5 size-5 shrink-0 text-gold-600" aria-hidden />
                <div><p className="font-semibold">{f.title}</p><p className="mt-0.5 text-sm text-muted">{f.body}</p></div>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-muted">Plus the learning library (SOP, CV and recommendation letter samples) and the step-by-step application guide.</p>
        </div>

        <aside className="rounded-2xl border border-line bg-white p-6 shadow-[var(--shadow-card)] lg:sticky lg:top-24">
          <p className="text-sm font-semibold text-muted">Membership</p>
          <p className="mt-1 font-display text-5xl text-navy-950">{naira(price)}</p>
          <p className="text-sm text-muted">{period}</p>
          <ul className="mt-5 space-y-2 text-sm">
            {["All features listed here", "Pay by card, bank transfer or USSD", "Secure checkout by Flutterwave"].map((t) => <li key={t} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success-700" aria-hidden />{t}</li>)}
          </ul>

          <div className="mt-6 border-t border-line pt-5">
            {!user ? (
              <div className="space-y-2">
                <Button asChild size="lg" className="w-full"><Link href="/register?next=/membership">Create an account to join</Link></Button>
                <p className="text-center text-sm text-muted">Already have an account? <Link href={`/login?next=${encodeURIComponent("/membership")}`} className="font-semibold text-royal-700 hover:underline">Sign in</Link></p>
              </div>
            ) : staff ? (
              <p className="text-sm"><Badge tone="success">Staff</Badge> Admin and reviewer accounts have full access without a membership.</p>
            ) : !user.emailVerified ? (
              <div className="space-y-2 text-sm"><p>Verify your email address first, then come back to pay.</p><Button asChild variant="secondary" className="w-full"><Link href="/verify-email/pending">Verify my email</Link></Button></div>
            ) : (
              <div className="space-y-3">
                {state?.active && (
                  <p className="rounded-lg bg-success-100 px-3 py-2 text-sm text-success-700">
                    <ShieldCheck className="mr-1 inline size-4" aria-hidden />
                    {state.lifetime ? "You have lifetime membership." : `Your membership is active until ${formatDate(state.expiresAt)}.`}
                  </p>
                )}
                {state?.active && !state.lifetime && <p className="text-xs text-muted">Paying again now adds {months === 0 ? "lifetime access" : `${months} months`} after your current end date.</p>}
                {state?.lifetime ? (
                  <Button asChild size="lg" className="w-full"><Link href="/dashboard">Go to my dashboard</Link></Button>
                ) : payReady ? (
                  <ActionForm action={startMembershipCheckoutAction} showSuccess={false}>
                    <SubmitButton size="lg" className="w-full" pendingLabel="Opening secure checkout…">{state?.active ? `Renew for ${naira(price)}` : `Pay ${naira(price)} and join`}</SubmitButton>
                  </ActionForm>
                ) : (
                  <p className="rounded-lg border border-warning-700/30 bg-amber-50 p-3 text-sm text-amber-900">Online payment isn&apos;t switched on yet. Please check back soon or contact us.</p>
                )}
                {state?.active && !state.lifetime && <Button asChild variant="secondary" className="w-full"><Link href="/dashboard">Go to my dashboard</Link></Button>}
                <p className="text-center text-xs text-muted">You&apos;ll be taken to Flutterwave to pay, then brought back here.</p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {history.length > 0 && (
        <section aria-labelledby="payments-title" className="mt-12">
          <h2 id="payments-title" className="font-display text-2xl">Your payments</h2>
          <ul className="mt-4 divide-y divide-line rounded-xl border border-line bg-white">
            {history.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span><span className="font-semibold">{naira(Number(p.amount))}</span> · {formatDateTime(p.paidAt ?? p.createdAt)} · <span className="font-mono text-xs">{p.txRef}</span></span>
                <Badge tone={p.status === "successful" ? "success" : p.status === "pending" ? "warning" : "neutral"}>{p.status}</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
