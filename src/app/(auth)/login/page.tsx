import type { Metadata } from "next";
import Link from "next/link";
import { loginAction } from "@/app/actions/auth";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Input, Label } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return (
    <>
      <h1 className="font-display text-3xl">Welcome back</h1>
      <p className="mt-2 text-muted">Sign in to continue your scholarship journey.</p>
      <div className="mt-6 space-y-3">
        {sp.reset && <Alert tone="success">Your password has been reset. Please sign in.</Alert>}
        {sp.signedOut && <Alert tone="info">You&apos;ve been signed out.</Alert>}
        {sp.next && !sp.signedOut && <Alert tone="info">Please sign in to continue. For your security, sessions end after 30 minutes of inactivity.</Alert>}
      </div>
      <ActionForm action={loginAction} className="mt-6 space-y-4" refreshOnSuccess={false}>
        <input type="hidden" name="next" value={sp.next ?? ""} />
        <div className="space-y-1.5">
          <Label htmlFor="email">Email address</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
          <FieldError name="email" />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-sm font-medium text-royal-700 hover:underline">Forgot password?</Link>
          </div>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
          <FieldError name="password" />
        </div>
        <SubmitButton size="lg" className="w-full" pendingLabel="Signing in…">Sign in</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-muted">
        New to SOAR Hub? <Link href="/register" className="font-semibold text-royal-700 hover:underline">Create a free account</Link>
      </p>
    </>
  );
}
