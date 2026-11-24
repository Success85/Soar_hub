"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useActionState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { registerAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";

const schema = z
  .object({
    firstName: z.string().trim().min(1, "Enter your first name"),
    lastName: z.string().trim().min(1, "Enter your last name"),
    email: z.string().trim().email("Enter a valid email address"),
    password: z.string().min(10, "Use at least 10 characters").regex(/[a-zA-Z]/, "Include a letter").regex(/[0-9]/, "Include a number"),
    confirmPassword: z.string(),
    privacyConsent: z.literal(true, { message: "Please accept the privacy policy" }),
    termsConsent: z.literal(true, { message: "Please accept the terms of service" }),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" });
type Values = z.infer<typeof schema>;

export function RegisterForm() {
  const [state, action] = useActionState(registerAction, null);
  const [pending, start] = useTransition();
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema), mode: "onBlur" });
  const serverErr = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);
  const err = (k: keyof Values) => errors[k]?.message ?? serverErr(k);
  const aria = (k: keyof Values) => ({ "aria-invalid": !!err(k), "aria-describedby": err(k) ? `${k}-error` : undefined });

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit((values) => {
        const fd = new FormData();
        for (const [k, v] of Object.entries(values)) fd.set(k, typeof v === "boolean" ? (v ? "on" : "") : String(v));
        start(() => action(fd));
      })}
    >
      {state && !state.ok && <Alert tone="danger">{state.error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" htmlFor="firstName" error={err("firstName")}>
          <Input id="firstName" autoComplete="given-name" {...register("firstName")} {...aria("firstName")} />
        </Field>
        <Field label="Last name" htmlFor="lastName" error={err("lastName")}>
          <Input id="lastName" autoComplete="family-name" {...register("lastName")} {...aria("lastName")} />
        </Field>
      </div>
      <Field label="Email address" htmlFor="email" error={err("email")}>
        <Input id="email" type="email" autoComplete="email" inputMode="email" {...register("email")} {...aria("email")} />
      </Field>
      <Field label="Password" htmlFor="password" hint="At least 10 characters, with a letter and a number." error={err("password")}>
        <Input id="password" type="password" autoComplete="new-password" {...register("password")} {...aria("password")} />
      </Field>
      <Field label="Confirm password" htmlFor="confirmPassword" error={err("confirmPassword")}>
        <Input id="confirmPassword" type="password" autoComplete="new-password" {...register("confirmPassword")} {...aria("confirmPassword")} />
      </Field>
      <div className="space-y-3 rounded-xl border border-line bg-white p-4">
        <Checkbox id="privacyConsent" {...register("privacyConsent")} label={<>I have read the <Link href="/privacy" target="_blank" className="font-semibold text-royal-700 underline">privacy policy</Link> and agree to SOAR Hub processing my data to support my applications.</>} />
        {err("privacyConsent") && <p id="privacyConsent-error" role="alert" className="text-[13px] font-medium text-danger-700">{err("privacyConsent")}</p>}
        <Checkbox id="termsConsent" {...register("termsConsent")} label={<>I agree to the <Link href="/terms" target="_blank" className="font-semibold text-royal-700 underline">terms of service</Link>.</>} />
        {err("termsConsent") && <p id="termsConsent-error" role="alert" className="text-[13px] font-medium text-danger-700">{err("termsConsent")}</p>}
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Creating your account…" : "Create account"}
      </Button>
    </form>
  );
}
