import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getRequestMeta } from "@/lib/request";
import { verifyEmail } from "@/lib/services/auth";

export const metadata: Metadata = { title: "Verify your email" };
export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const result = token ? await verifyEmail(token, await getRequestMeta()) : "invalid";
  if (result === "verified") {
    return (
      <div className="text-center">
        <CheckCircle2 className="mx-auto size-14 text-success-700" aria-hidden />
        <h1 className="mt-4 font-display text-3xl">Email verified</h1>
        <p className="mt-2 text-muted">Thank you! Your account is ready. Let&apos;s set up your profile.</p>
        <Button asChild size="lg" className="mt-8"><Link href="/onboarding">Continue</Link></Button>
      </div>
    );
  }
  return (
    <div className="text-center">
      <XCircle className="mx-auto size-14 text-danger-700" aria-hidden />
      <h1 className="mt-4 font-display text-3xl">We couldn&apos;t verify your email</h1>
      <p className="mt-2 text-muted">{result === "expired" ? "This verification link has expired." : "This link is invalid or has already been used."} Sign in and we&apos;ll send you a fresh link.</p>
      <Button asChild size="lg" className="mt-8"><Link href="/verify-email/pending">Get a new link</Link></Button>
    </div>
  );
}
