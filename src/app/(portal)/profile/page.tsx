import type { Metadata } from "next";
import Link from "next/link";
import { ProfileForm } from "@/components/profile-form";
import { Card, CardBody } from "@/components/ui/card";
import { MemberCode } from "@/components/member-code";
import { PageHeader, Progress } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { calculateAge } from "@/lib/engine/eligibility";
import { getProfileBundle } from "@/lib/services/profile";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser({ next: "/profile" });
  const b = await getProfileBundle(user.id);
  const age = calculateAge(b.profile?.dateOfBirth);
  const isApplicant = user.roles.includes("applicant");
  return (
    <>
      <PageHeader title="Your profile" description="Keep this up to date. When you change details that affect eligibility, your results are recalculated automatically." actions={user.memberCode ? <MemberCode code={user.memberCode} /> : undefined} />
      {isApplicant && (
        <Card className="mb-6">
          <CardBody className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="text-sm font-semibold">Profile {b.completion.percent}% complete{age !== null && <span className="ml-2 font-normal text-muted">· Age {age}</span>}</p>
              <Progress value={b.completion.percent} label="Profile completion" tone="gold" className="mt-2" />
              <p className="mt-2 text-sm text-muted">{b.completion.nextAction}</p>
            </div>
            {b.completion.missing.length > 0 && <p className="text-sm text-muted">Missing: {b.completion.missing.slice(0, 4).map((m) => m.label).join(", ")}{b.completion.missing.length > 4 ? "…" : ""}</p>}
          </CardBody>
        </Card>
      )}
      <Card>
        <CardBody className="p-5 sm:p-8">
          <ProfileForm profile={b.profile} user={b.user} sections={isApplicant ? ["personal", "education", "background", "goals", "consent"] : ["personal"]} hasConsent={b.hasConsent} />
        </CardBody>
      </Card>
      <p className="mt-6 text-sm text-muted">Want a copy of your data or to delete your account? Visit <Link href="/settings" className="font-semibold text-royal-700 hover:underline">Settings & privacy</Link>.</p>
    </>
  );
}
