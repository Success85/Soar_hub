import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MapPin } from "lucide-react";
import { contactAction } from "@/app/actions/public";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Input, Label, Textarea } from "@/components/ui/form";
import { getSettings } from "@/lib/services/settings";

export const metadata: Metadata = { title: "Contact" };

export default async function ContactPage() {
  const s = await getSettings();
  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_1.3fr]">
      <div>
        <h1 className="font-display text-4xl">We&apos;re here to help</h1>
        <p className="mt-3 text-muted">Questions about using SOAR Hub, a scholarship listing, or your data? Send us a message. We can&apos;t submit applications on your behalf or influence university decisions.</p>
        <ul className="mt-8 space-y-4 text-sm">
          <li className="flex items-center gap-3"><Mail className="size-5 text-gold-600" aria-hidden /> <a href={`mailto:${s.support_email}`} className="font-semibold text-royal-700 hover:underline">{s.support_email}</a></li>
          <li className="flex items-center gap-3"><MapPin className="size-5 text-gold-600" aria-hidden /> {s.contact_address}</li>
          {s.contact_phone && <li>{s.contact_phone}</li>}
        </ul>
        <p className="mt-8 text-sm">Quick answers: <Link href="/faq" className="font-semibold text-royal-700 hover:underline">FAQs</Link> · <Link href="/resources" className="font-semibold text-royal-700 hover:underline">Learning resources</Link></p>
      </div>
      <ActionForm action={contactAction} className="space-y-4 rounded-[var(--radius-card)] border border-line bg-white p-6" resetOnSuccess refreshOnSuccess={false}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="name">Your name</Label><Input id="name" name="name" autoComplete="name" /><FieldError name="name" /></div>
          <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" autoComplete="email" /><FieldError name="email" /></div>
        </div>
        <div className="space-y-1.5"><Label htmlFor="subject">Subject</Label><Input id="subject" name="subject" /><FieldError name="subject" /></div>
        <div className="space-y-1.5"><Label htmlFor="message">Message</Label><Textarea id="message" name="message" className="min-h-36" /><FieldError name="message" /></div>
        <div className="hidden" aria-hidden><label htmlFor="website">Leave empty</label><input id="website" name="website" tabIndex={-1} autoComplete="off" /></div>
        <SubmitButton pendingLabel="Sending…">Send message</SubmitButton>
      </ActionForm>
    </div>
  );
}
