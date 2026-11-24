import { schoolInitials } from "@/lib/school-initials";
import { cn } from "@/lib/utils";

const TILE_TONES = [
  "bg-navy-900 text-gold-400",
  "bg-royal-700 text-white",
  "bg-gold-500 text-navy-950",
  "bg-emerald-700 text-white",
  "bg-rose-800 text-white",
  "bg-slate-700 text-white",
];

function tone(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TILE_TONES[h % TILE_TONES.length];
}

/** School logo, or a coloured initials tile when no logo is stored. Decorative: the school name is always next to it. */
export function SchoolLogo({ name, logoUrl, size = "md", className }: { name: string; logoUrl?: string | null; size?: "sm" | "md" | "lg"; className?: string }) {
  const box = { sm: "size-10 rounded-lg text-xs", md: "size-14 rounded-xl text-sm", lg: "size-20 rounded-2xl text-lg" }[size];
  if (logoUrl) {
    return (
      <span className={cn("flex shrink-0 items-center justify-center overflow-hidden border border-line bg-white p-1.5", box, className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
      </span>
    );
  }
  const initials = schoolInitials(name);
  return (
    <span aria-hidden className={cn("flex shrink-0 items-center justify-center font-display font-semibold tracking-wide", box, tone(name), initials.length > 3 && "text-[0.8em]", className)}>
      {initials}
    </span>
  );
}
