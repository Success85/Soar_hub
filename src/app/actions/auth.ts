"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { toActionError, type ActionResult } from "@/lib/errors";
import { getRequestMeta } from "@/lib/request";
import { changePassword, login, loginSchema, logout, register, registerSchema, requestPasswordReset, resetPassword, sendVerificationEmail } from "@/lib/services/auth";

function safeNext(next: FormDataEntryValue | null): string | null {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") ? n : null;
}

export async function registerAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const input = registerSchema.parse({
      firstName: fd.get("firstName"),
      lastName: fd.get("lastName"),
      email: fd.get("email"),
      password: fd.get("password"),
      confirmPassword: fd.get("confirmPassword"),
      privacyConsent: fd.get("privacyConsent") === "on",
      termsConsent: fd.get("termsConsent") === "on",
    });
    await register(input, await getRequestMeta());
  } catch (e) {
    return toActionError(e);
  }
  redirect("/verify-email/pending?registered=1");
}

export async function loginAction(_: unknown, fd: FormData): Promise<ActionResult> {
  let verified = false;
  try {
    const input = loginSchema.parse({ email: fd.get("email"), password: fd.get("password") });
    ({ verified } = await login(input, await getRequestMeta()));
  } catch (e) {
    return toActionError(e);
  }
  if (!verified) redirect("/verify-email/pending");
  redirect(safeNext(fd.get("next")) ?? "/dashboard");
}

export async function logoutAction(): Promise<void> {
  const user = await getCurrentUser();
  await logout(user?.id ?? null, await getRequestMeta());
  redirect("/login?signedOut=1");
}

export async function resendVerificationAction(): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Please sign in first." };
    if (user.emailVerified) return { ok: true, message: "Your email is already verified." };
    await sendVerificationEmail(user.id);
    return { ok: true, message: `We've sent a new verification link to ${user.email}.` };
  } catch (e) {
    return toActionError(e);
  }
}

export async function forgotPasswordAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const email = z.string().trim().toLowerCase().email("Enter a valid email address").parse(fd.get("email"));
    await requestPasswordReset(email, await getRequestMeta());
    return { ok: true, message: "If an account exists for that email, a reset link is on its way. It expires in 1 hour." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function resetPasswordAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const token = String(fd.get("token") ?? "");
    const password = String(fd.get("password") ?? "");
    if (password !== String(fd.get("confirmPassword") ?? "")) return { ok: false, error: "Passwords don't match.", fieldErrors: { confirmPassword: "Passwords don't match" } };
    await resetPassword(token, password, await getRequestMeta());
  } catch (e) {
    return toActionError(e);
  }
  redirect("/login?reset=1");
}

export async function changePasswordAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Please sign in." };
    const next = String(fd.get("newPassword") ?? "");
    if (next !== String(fd.get("confirmPassword") ?? "")) return { ok: false, error: "Passwords don't match.", fieldErrors: { confirmPassword: "Passwords don't match" } };
    await changePassword(user.id, String(fd.get("currentPassword") ?? ""), next, await getRequestMeta());
    return { ok: true, message: "Password changed. Other devices have been signed out." };
  } catch (e) {
    return toActionError(e);
  }
}
