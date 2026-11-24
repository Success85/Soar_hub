import type { Metadata } from "next";
import Link from "next/link";
import { resetPasswordAction } from "@/app/actions/auth";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Input, Label } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import { checkResetToken } from "@/lib/services/auth";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const valid = token ? await checkResetToken(token) : false;
  if (!valid) {
    return (
      <>
        <h1 className="font-display text-3xl">This link has expired</h1>
        <Alert tone="warning" className="mt-6">Password reset links work once and expire after an hour. Please request a new one.</Alert>
        <Link href="/forgot-password" className="mt-6 inline-block font-semibold text-royal-700 hover:underline">Request a new link</Link>
      </>
    );
  }
  return (
    <>
      <h1 className="font-display text-3xl">Choose a new password</h1>
      <p className="mt-2 text-muted">Use at least 10 characters, including a letter and a number.</p>
      <ActionForm action={resetPasswordAction} className="mt-8 space-y-4" refreshOnSuccess={false}>
        <input type="hidden" name="token" value={token} />
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" required />
          <FieldError name="password" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
          <FieldError name="confirmPassword" />
        </div>
        <SubmitButton size="lg" className="w-full" pendingLabel="Saving…">Reset password</SubmitButton>
      </ActionForm>
    </>
  );
}
