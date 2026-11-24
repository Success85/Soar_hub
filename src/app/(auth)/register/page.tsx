import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/services/settings";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create your account" };

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  const settings = await getSettings();
  return (
    <>
      <h1 className="font-display text-3xl">Create your free account</h1>
      <p className="mt-2 text-muted">It takes two minutes. We&apos;ll ask about your background later — and explain why.</p>
      <div className="mt-8">
        {settings.registration_open ? <RegisterForm /> : <Alert tone="warning" title="Registration is paused">New registrations are temporarily closed. Please check back soon.</Alert>}
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account? <Link href="/login" className="font-semibold text-royal-700 hover:underline">Sign in</Link>
      </p>
    </>
  );
}
