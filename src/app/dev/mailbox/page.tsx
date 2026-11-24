import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { readFile } from "node:fs/promises";
import { env, isProd } from "@/lib/env";
import { dispatchDue } from "@/lib/services/notifications";

export const metadata: Metadata = { title: "Development mailbox", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

interface Mail { at: string; to: string; subject: string; text: string }

/** Turns app links in an email body into clickable links; everything else stays plain text. */
function Body({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s)]+)/g);
  return (
    <p className="whitespace-pre-wrap break-words text-sm text-navy-800">
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) && p.startsWith(env.APP_URL) ? (
          <a key={i} href={p.slice(env.APP_URL.length) || "/"} className="font-semibold text-royal-700 underline">{p.slice(env.APP_URL.length)}</a>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </p>
  );
}

/**
 * Development only: shows the emails the "console" email provider has written to the local outbox,
 * so you can click verification and referee links without a real email service.
 * It also sends any queued notifications first, so you don't need the background worker running.
 */
export default async function DevMailboxPage({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  if (isProd || env.EMAIL_PROVIDER !== "console") notFound();
  const { to } = await searchParams;
  await dispatchDue(100);
  let mails: Mail[] = [];
  try {
    const raw = await readFile(`${process.cwd()}/${env.LOCAL_STORAGE_DIR}/outbox.jsonl`, "utf8");
    mails = raw.split("\n").filter(Boolean).map((l) => JSON.parse(l) as Mail).reverse();
  } catch {
    mails = [];
  }
  const recipients = [...new Set(mails.map((m) => m.to))];
  const shown = (to ? mails.filter((m) => m.to === to) : mails).slice(0, 50);
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-700">Development only</p>
      <h1 className="mt-2 font-display text-3xl">Mailbox</h1>
      <p className="mt-2 text-muted">Emails SOAR Hub would have sent. Nothing here leaves your computer. This page does not exist in production.</p>
      <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
        <Link href="/dev/mailbox" className={`rounded-full border px-3 py-1 ${!to ? "border-navy-900 bg-navy-900 text-ivory" : "border-line bg-white"}`}>All ({mails.length})</Link>
        {recipients.slice(0, 12).map((r) => (
          <Link key={r} href={`/dev/mailbox?to=${encodeURIComponent(r)}`} className={`rounded-full border px-3 py-1 ${to === r ? "border-navy-900 bg-navy-900 text-ivory" : "border-line bg-white"}`}>{r}</Link>
        ))}
        <Link href={to ? `/dev/mailbox?to=${encodeURIComponent(to)}` : "/dev/mailbox"} className="ml-auto font-semibold text-royal-700 hover:underline">Refresh</Link>
      </div>
      {shown.length === 0 ? (
        <p className="mt-8 rounded-xl border border-line bg-white p-6 text-muted">No emails yet. Register an account or send a referee request, then refresh.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {shown.map((m, i) => (
            <li key={`${m.at}-${i}`} className="rounded-xl border border-line bg-white p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">{m.subject}</p>
                <p className="text-xs text-muted">{new Date(m.at).toLocaleString("en-GB", { timeZone: "Africa/Lagos" })}</p>
              </div>
              <p className="mb-3 text-xs text-muted">To: {m.to}</p>
              <Body text={m.text} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
