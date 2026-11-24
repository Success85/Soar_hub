import { cn } from "@/lib/utils";

export interface Anchor {
  id: string;
  start: number;
  end: number;
  resolved?: boolean;
  label?: number;
}

/** Renders text with highlighted, numbered anchors (non-overlapping; later overlaps are skipped). */
export function AnchoredText({ text, anchors, className }: { text: string; anchors: Anchor[]; className?: string }) {
  const sorted = [...anchors].filter((a) => a.start >= 0 && a.end <= text.length && a.end > a.start).sort((a, b) => a.start - b.start);
  const parts: React.ReactNode[] = [];
  let pos = 0;
  for (const a of sorted) {
    if (a.start < pos) continue;
    if (a.start > pos) parts.push(text.slice(pos, a.start));
    parts.push(
      <mark key={a.id} id={`anchor-${a.id}`} className={cn("anchor-mark", a.resolved && "opacity-50")}>
        {text.slice(a.start, a.end)}
        {a.label !== undefined && <sup className="ml-0.5 font-semibold text-gold-700">[{a.label}]</sup>}
      </mark>,
    );
    pos = a.end;
  }
  parts.push(text.slice(pos));
  return <div className={cn("whitespace-pre-wrap break-words font-serif text-[15px] leading-7 text-navy-900", className)}>{parts}</div>;
}
