"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

const NAV = [
  { href: "/scholarships", label: "Scholarships" },
  { href: "/guide", label: "How to apply" },
  { href: "/resources", label: "Learning resources" },
  { href: "/faq", label: "FAQ" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function PublicHeader({ signedIn, homeHref }: { signedIn: boolean; homeHref: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-ivory/90 backdrop-blur supports-[backdrop-filter]:bg-ivory/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={pathname.startsWith(n.href) ? "page" : undefined} className={cn("whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-navy-800 hover:bg-ivory-200", pathname.startsWith(n.href) && "text-navy-950 underline decoration-gold-500 decoration-2 underline-offset-8")}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          {signedIn ? (
            <Button asChild>
              <Link href={homeHref}>Go to dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild>
                <Link href="/register">Get started</Link>
              </Button>
            </>
          )}
        </div>
        <button type="button" className="inline-flex size-11 items-center justify-center rounded-lg text-navy-900 hover:bg-ivory-200 lg:hidden" aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen((o) => !o)}>
          {open ? <X aria-hidden /> : <Menu aria-hidden />}
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        </button>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-line bg-ivory px-4 pb-5 pt-2 lg:hidden">
          <ul className="space-y-1">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="block rounded-lg px-3 py-3 text-base font-medium text-navy-900 hover:bg-ivory-200">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid gap-2">
            {signedIn ? (
              <Button asChild>
                <Link href={homeHref}>Go to dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild>
                  <Link href="/register">Get started — it&apos;s free</Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/login">Sign in</Link>
                </Button>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
