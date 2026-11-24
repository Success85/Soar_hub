import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import Link from "next/link";
import { SchoolLogo } from "@/components/school-logo";
import { Badge } from "@/components/ui/misc";
import {
  WINDOW_LABELS,
  WINDOW_TONES,
  type Category,
  type WindowStatus,
} from "@/lib/scholarship-meta";
import { cn, daysUntil, formatDate } from "@/lib/utils";

export interface ScholarshipCardData {
  slug: string;
  name: string;
  partnerUniversity: string;
  country: string;
  city: string | null;
  scholarshipType: string;
  summary: string | null;
  deadline: Date | null;
  lastVerifiedAt: Date | null;
  isFeatured: boolean;
  isDemo: boolean;
  programmes: string[];
  programmeLevel?: string;
  windowStatus?: WindowStatus;
  category?: Category | null;
  currentWindow?: string | null;
  nextWindow?: string | null;
  keyEligibility?: string | null;
  logoUrl?: string | null;
}

export function WindowBadge({ status }: { status: WindowStatus }) {
  return <Badge tone={WINDOW_TONES[status]}>{WINDOW_LABELS[status]}</Badge>;
}

export function DeadlineBadge({
  deadline,
  windowStatus,
}: {
  deadline: Date | null;
  windowStatus?: WindowStatus;
}) {
  if (windowStatus && windowStatus !== "open" && windowStatus !== "opens_soon")
    return null;
  const d = daysUntil(deadline);
  if (d === null) return null;
  if (d < 0) return <Badge>Deadline passed</Badge>;
  if (d <= 14)
    return (
      <Badge tone="danger">
        {d === 0 ? "Closes today" : `${d} day${d === 1 ? "" : "s"} left`}
      </Badge>
    );
  if (d <= 45) return <Badge tone="warning">{d} days left</Badge>;
  return <Badge tone="success">{d} days left</Badge>;
}

const LEVEL_LABEL: Record<string, string> = {
  undergraduate: "Undergraduate",
  masters: "Postgraduate",
  postgraduate: "Postgraduate",
};

/** The one date that matters right now: the deadline while a window is open, otherwise the next expected window. */
function keyDate(s: ScholarshipCardData, status: WindowStatus): string {
  if (status === "open" || status === "opens_soon") {
    if (s.deadline)
      return `${status === "open" ? "Closes" : "Deadline"} ${formatDate(s.deadline)}`;
    return s.currentWindow ?? "Dates on the official page";
  }
  if (s.nextWindow && s.nextWindow !== "—") return `Next: ${s.nextWindow}`;
  return "Next window not announced";
}

export function ScholarshipCard({
  s,
  verdict,
  className,
}: {
  s: ScholarshipCardData;
  verdict?: React.ReactNode;
  className?: string;
}) {
  const status = s.windowStatus ?? "open";
  const date = keyDate(s, status);
  const meta = [
    [s.city, s.country].filter(Boolean).join(", "),
    s.programmeLevel ? LEVEL_LABEL[s.programmeLevel] : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <article
      className={cn(
        "group relative flex h-full flex-col rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-navy-600/40 hover:shadow-md",
        className,
      )}
    >
      <div className="flex items-start gap-3.5">
        <SchoolLogo name={s.partnerUniversity} logoUrl={s.logoUrl} />
        <div className="min-w-0 pt-0.5">
          <h3 className="line-clamp-2 font-semibold leading-snug text-navy-950">
            <Link
              href={`/scholarships/${s.slug}`}
              className="after:absolute after:inset-0 group-hover:underline"
            >
              {s.partnerUniversity}
            </Link>
          </h3>
          <p className="mt-0.5 flex items-center gap-1 text-[13px] text-muted">
            <MapPin className="size-3.5 shrink-0" aria-hidden />{" "}
            <span className="truncate">{meta}</span>
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <WindowBadge status={status} />
        <DeadlineBadge deadline={s.deadline} windowStatus={status} />
        {s.isDemo && <Badge tone="neutral">Demo record</Badge>}
      </div>

      {s.summary && (
        <p className="mt-3 line-clamp-2 text-sm text-navy-800">{s.summary}</p>
      )}

      <div className="mt-auto pt-4">
        <div className="flex items-center justify-between gap-3 border-t border-line pt-3 text-[13px]">
          <span
            className="flex min-w-0 items-center gap-1.5 text-navy-800"
            title={date}
          >
            <CalendarDays
              className="size-4 shrink-0 text-gold-600"
              aria-hidden
            />
            <span className="truncate">{date}</span>
          </span>
          {verdict ? (
            <span className="relative z-10 shrink-0">{verdict}</span>
          ) : (
            <span className="flex shrink-0 items-center gap-1 font-semibold text-royal-700">
              Details{" "}
              <ArrowRight
                className="size-3.5 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
