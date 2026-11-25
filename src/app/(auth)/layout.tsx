import Link from "next/link";
import { Logo } from "@/components/layout/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden overflow-hidden bg-navy-900 p-12 text-ivory lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="absolute -bottom-40 -left-24 size-[460px] rounded-full bg-gold-500/10 blur-3xl" />
        <Logo light />
        <div className="relative">
          <p className="font-display text-4xl leading-tight text-ivory">Talent is everywhere.<br />Let&apos;s make sure opportunity finds you.</p>
          <p className="mt-4 max-w-md text-ivory/70">Plan, prepare and submit your scholarship applications with structured guidance.</p>
        </div>
        <p className="relative text-xs text-ivory/50">SOAR Hub supports your preparation. It never guarantees selection.</p>
      </aside>
      <main id="main" className="flex flex-col px-4 py-8 sm:px-8">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">{children}</div>
        <p className="text-center text-xs text-muted">
          <Link href="/privacy" className="hover:underline">Privacy</Link> · <Link href="/terms" className="hover:underline">Terms</Link> · <Link href="/contact" className="hover:underline">Help</Link>
        </p>
      </main>
    </div>
  );
}
