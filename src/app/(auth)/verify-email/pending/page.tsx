import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MailCheck } from "lucide-react";
import { logoutAction, resendVerificationAction } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { getCurrentUser } from "@/lib/auth/session";
import { env, isProd } from "@/lib/env";

export const metadata: Metadata = { title: "Check your inbox" };

export default async function PendingVerificationPage({ searchParams }: { searchParams: Promise<{ registered?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.emailVerified) redirect("/dashboard");
  const { registered } = await searchParams;
  return (
    <div className="text-center">
      <MailCheck className="mx-auto size-14 text-gold-600" aria-hidden />
      <h1 className="mt-4 font-display text-3xl">{registered ? "Account created — check your inbox" : "Verify your email to continue"}</h1>
      <p className="mt-3 text-muted">
        We sent a verification link to <strong className="text-navy-900">{user.email}</strong>. Open it to activate your account. The link expires in 24 hours.
      </p>
      <p className="mt-2 text-sm text-muted">Can&apos;t find it? Check your spam or promotions folder.</p>
      {!isProd && env.EMAIL_PROVIDER === "console" && (
        <p className="mt-4 rounded-lg border border-dashed border-gold-500 bg-gold-50 p-3 text-sm">
          Development mode: emails aren&apos;t really sent. <Link href={`/dev/mailbox?to=${encodeURIComponent(user.email)}`} className="font-semibold text-royal-700 underline">Open the development mailbox</Link> to click your link.
        </p>
      )}
      <ActionForm action={resendVerificationAction} className="mt-8" refreshOnSuccess={false}>
        <SubmitButton variant="secondary" pendingLabel="Sending…">Resend verification email</SubmitButton>
      </ActionForm>
      <form action={logoutAction} className="mt-4">
        <button className="text-sm font-medium text-royal-700 hover:underline">Use a different account</button>
      </form>
      <p className="mt-8 text-xs text-muted"><Link href="/" className="hover:underline">Return to the homepage</Link></p>
    </div>
  );
}
