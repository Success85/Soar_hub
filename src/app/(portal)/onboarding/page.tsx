import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { finishOnboardingAction, welcomeSeenAction } from "@/app/actions/portal";
import { ProfileForm, type ProfileSection } from "@/components/profile-form";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { getProfileBundle } from "@/lib/services/profile";

export const metadata: Metadata = { title: "Set up your profile" };

const STEPS: { key: ProfileSection | "done"; label: string }[] = [
  { key: "personal", label: "Personal" },
  { key: "education", label: "Education" },
  { key: "background", label: "Background" },
  { key: "goals", label: "Goals" },
  { key: "consent", label: "Consent" },
  { key: "done", label: "Review" },
];

const JOURNEY = ["Create your profile", "Explore scholarship opportunities", "Check eligibility", "Build your application plan", "Prepare your documents", "Get feedback", "Submit your application"];

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const user = await requireUser({ next: "/onboarding" });
  const { step } = await searchParams;
  const bundle = await getProfileBundle(user.id);

  if (!step && !bundle.profile?.welcomeSeenAt) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-700">Welcome, {user.firstName}</p>
        <h1 className="mt-2 font-display text-4xl">Let&apos;s get you ready to soar.</h1>
        <p className="mt-3 text-lg text-muted">Here&apos;s how SOAR Hub will support you — one manageable step at a time.</p>
        <ol className="mt-8 space-y-3">
          {JOURNEY.map((j, i) => (
            <li key={j} className="flex items-center gap-4 rounded-xl border border-line bg-white p-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-navy-900 font-display text-gold-400">{i + 1}</span>
              <span className="font-medium">{j}</span>
            </li>
          ))}
        </ol>
        <form action={welcomeSeenAction} className="mt-8">
          <Button size="lg" type="submit">Start my profile</Button>
        </form>
        <p className="mt-4 text-sm text-muted">You can save progress and come back any time.</p>
      </div>
    );
  }

  const current = STEPS.find((s) => s.key === step)?.key ?? "personal";
  const idx = STEPS.findIndex((s) => s.key === current);
  const next = STEPS[idx + 1]?.key;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl">Set up your profile</h1>
      <p className="mt-2 text-muted">Your answers help us check eligibility so you don&apos;t have to repeat yourself.</p>
      <div className="mt-6">
        <div className="mb-2 flex justify-between text-sm"><span className="font-semibold">Profile {bundle.completion.percent}% complete</span><span className="text-muted">Step {idx + 1} of {STEPS.length}</span></div>
        <Progress value={bundle.completion.percent} label="Profile completion" tone="gold" />
      </div>
      <nav aria-label="Profile steps" className="mt-6 overflow-x-auto">
        <ol className="flex min-w-max gap-2">
          {STEPS.map((s, i) => (
            <li key={s.key}>
              <Link href={`/onboarding?step=${s.key}`} aria-current={s.key === current ? "step" : undefined} className={cn("block rounded-full border px-3 py-1.5 text-sm font-medium", s.key === current ? "border-navy-900 bg-navy-900 text-ivory" : i < idx ? "border-line bg-white text-navy-900" : "border-line text-muted")}>
                {i + 1}. {s.label}
              </Link>
            </li>
          ))}
        </ol>
      </nav>
      <Card className="mt-6">
        <CardBody className="p-5 sm:p-8">
          {current === "done" ? (
            <div>
              <h2 className="text-xl font-semibold">Review your profile</h2>
              {bundle.completion.missing.length === 0 ? (
                <p className="mt-3 flex items-center gap-2 text-success-700"><CheckCircle2 className="size-5" aria-hidden /> Everything we need is in place.</p>
              ) : (
                <>
                  <p className="mt-3 text-muted">You can finish now and add these later — but the more complete your profile, the more accurate your eligibility checks.</p>
                  <ul className="mt-4 space-y-2">
                    {bundle.completion.missing.map((m) => (
                      <li key={m.key} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 text-sm">
                        <span>{m.label}</span>
                        <Link href={`/onboarding?step=${m.section}`} className="font-semibold text-royal-700 hover:underline">Add</Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <p className="mt-6 rounded-lg bg-gold-50 p-3 text-sm"><strong>Recommended next step:</strong> {bundle.completion.nextAction}</p>
              <form action={finishOnboardingAction} className="mt-6">
                <Button size="lg" type="submit">Finish and go to my dashboard</Button>
              </form>
            </div>
          ) : (
            <ProfileForm profile={bundle.profile} user={bundle.user} sections={[current as ProfileSection]} hasConsent={bundle.hasConsent} submitLabel={next ? "Save and continue" : "Save"} redirectTo={next ? `/onboarding?step=${next}` : undefined} />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
