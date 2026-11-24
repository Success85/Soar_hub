import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn("size-9", className)}>
      <rect width="64" height="64" rx="14" fill="#0B1F3A" />
      <path d="M14 44c8-3 15-10 18-24 3 14 10 21 18 24" fill="none" stroke="#D4A72C" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="32" cy="15" r="4" fill="#FAF8F2" />
    </svg>
  );
}

export function Logo({ href = "/", light, name = "SOAR Hub" }: { href?: string; light?: boolean; name?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 rounded-lg" aria-label={`${name} home`}>
      <LogoMark />
      <span className={cn("font-display text-xl font-semibold tracking-tight", light ? "text-ivory" : "text-navy-900")}>
        {name.replace(/\s*Hub$/i, "")}
        <span className={light ? "text-gold-500" : "text-gold-700"}> Hub</span>
      </span>
    </Link>
  );
}
