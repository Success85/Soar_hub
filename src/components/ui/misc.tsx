import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "gold" | "navy";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-ivory-200 text-navy-800 border-line",
  info: "bg-royal-50 text-royal-700 border-royal-100",
  success: "bg-success-100 text-success-700 border-green-200",
  warning: "bg-warning-100 text-warning-700 border-amber-200",
  danger: "bg-danger-100 text-danger-700 border-red-200",
  gold: "bg-gold-100 text-gold-700 border-gold-200",
  navy: "bg-navy-900 text-ivory border-navy-900",
};

export function Badge({ tone = "neutral", className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold", toneClasses[tone], className)} {...props} />;
}

export function Alert({ tone = "info", title, children, className }: { tone?: "info" | "success" | "warning" | "danger"; title?: React.ReactNode; children?: React.ReactNode; className?: string }) {
  const Icon = { info: Info, success: CheckCircle2, warning: TriangleAlert, danger: AlertCircle }[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-xl border p-4 text-sm", toneClasses[tone], className)}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-relaxed [&_a]:underline">{children}</div>}
      </div>
    </div>
  );
}

export function Progress({ value, label, className, tone = "navy" }: { value: number; label: string; className?: string; tone?: "navy" | "gold" | "success" }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const bar = { navy: "bg-navy-900", gold: "bg-gold-500", success: "bg-success-700" }[tone];
  return (
    <div className={cn("w-full", className)}>
      <div role="progressbar" aria-label={label} aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} className="h-2.5 w-full overflow-hidden rounded-full bg-ivory-200">
        <div className={cn("h-full rounded-full transition-[width]", bar)} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className }: { icon?: React.ComponentType<{ className?: string }>; title: string; description?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-line bg-white/60 px-6 py-12 text-center", className)}>
      {Icon && (
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-gold-100 text-gold-700">
          <Icon className="size-6" aria-hidden />
        </div>
      )}
      <h3 className="text-base font-semibold text-navy-900">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions, eyebrow, back }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; eyebrow?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-2 inline-block text-sm font-medium text-royal-700 hover:underline">
            ← {back.label}
          </Link>
        )}
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-gold-700">{eyebrow}</p>}
        <h1 className="font-display text-[1.75rem] leading-tight sm:text-[2.1rem]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[15px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, href, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; href?: string; tone?: "default" | "warning" | "danger" }) {
  const inner = (
    <div className={cn("h-full rounded-[var(--radius-card)] border border-line bg-white p-4 shadow-[var(--shadow-card)] transition-colors", href && "hover:border-navy-600", tone === "danger" && "border-red-200 bg-danger-100/40", tone === "warning" && "border-amber-200 bg-warning-100/40")}>
      <p className="text-[13px] font-medium text-muted">{label}</p>
      <p className="mt-1 font-display text-3xl text-navy-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export function Table({ children, className, caption }: { children: React.ReactNode; className?: string; caption?: string }) {
  return (
    <div className={cn("w-full overflow-x-auto rounded-[var(--radius-card)] border border-line bg-white", className)}>
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  );
}
export const Th = ({ className, ...p }: React.ThHTMLAttributes<HTMLTableCellElement>) => <th scope="col" className={cn("border-b border-line bg-ivory px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted", className)} {...p} />;
export const Td = ({ className, ...p }: React.TdHTMLAttributes<HTMLTableCellElement>) => <td className={cn("border-b border-line/70 px-4 py-3 align-top text-navy-900", className)} {...p} />;

export function Pagination({ page, total, pageSize, hrefFor }: { page: number; total: number; pageSize: number; hrefFor: (p: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
      <span className="text-muted">
        Page {page} of {pages} · {total} total
      </span>
      <div className="flex gap-2">
        {page > 1 && (
          <Link className="rounded-lg border border-line bg-white px-3 py-1.5 font-medium hover:bg-ivory-200" href={hrefFor(page - 1)}>
            Previous
          </Link>
        )}
        {page < pages && (
          <Link className="rounded-lg border border-line bg-white px-3 py-1.5 font-medium hover:bg-ivory-200" href={hrefFor(page + 1)}>
            Next
          </Link>
        )}
      </div>
    </nav>
  );
}

export function Section({ title, description, children, actions, className }: { title: string; description?: string; children: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
