import type { Metadata } from "next";
import Link from "next/link";
import { forgotPasswordAction } from "@/app/actions/auth";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Input, Label } from "@/components/ui/form";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="font-display text-3xl">Forgot your password?</h1>
      <p className="mt-2 text-muted">Enter your email and we&apos;ll send you a secure link to choose a new one.</p>
      <ActionForm action={forgotPasswordAction} className="mt-8 space-y-4" resetOnSuccess refreshOnSuccess={false}>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email address</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
          <FieldError name="email" />
        </div>
        <SubmitButton size="lg" className="w-full" pendingLabel="Sending…">Send reset link</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm"><Link href="/login" className="font-semibold text-royal-700 hover:underline">Back to sign in</Link></p>
    </>
  );
}
