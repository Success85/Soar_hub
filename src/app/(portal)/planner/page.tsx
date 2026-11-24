import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, Flame, Zap } from "lucide-react";
import { milestoneAction, regenerateScheduleAction } from "@/app/actions/portal";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms/action-form";
import { MilestoneBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/form";
import { Alert, Badge, EmptyState, PageHeader, Progress } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { addDays, dayInTimezone, diffDays, effectiveStatus, milestoneProgress, parseDay } from "@/lib/engine/scheduler";
import { listApplicationsForUser } from "@/lib/services/applications";
import { milestonesForApplication, parseScheduleNotice } from "@/lib/services/planner";
import { cn, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Application planner" };
export const dynamic = "force-dynamic";

type Search = { application?: string; view?: string; filter?: string; month?: string };

export default async function PlannerPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const apps = (await listApplicationsForUser(user.id)).filter((a) => a.app.status !== "ineligible");
  if (apps.length === 0) {
    return (
      <>
        <PageHeader title="Application planner" />
        <EmptyState icon={CalendarClock} title="No plans yet" description="Start an application and we'll build a personal schedule that works backward from the official deadline." action={<Button asChild><Link href="/scholarships">Explore scholarships</Link></Button>} />
      </>
    );
  }
  const selected = apps.find((a) => a.app.id === sp.application) ?? apps[0];
  const tz = selected.sch.timezone || "Africa/Lagos";
  const today = dayInTimezone(new Date(), tz);
  const ms = await milestonesForApplication(selected.app.id);
  const byId = new Map(ms.map((m) => [m.id, m]));
  const withStatus = ms.map((m) => ({ ...m, effective: effectiveStatus(m, today) }));
  const view = sp.view === "timeline" || sp.view === "calendar" ? sp.view : "list";
  const filter = sp.filter ?? "all";
  const filtered = withStatus.filter((m) => filter === "all" || (filter === "upcoming" && ["upcoming", "in_progress", "due_today", "blocked"].includes(m.effective)) || (filter === "overdue" && m.effective === "overdue") || (filter === "completed" && m.effective === "completed"));
  const notice = parseScheduleNotice(selected.app.scheduleWarning);
  const deadlineDay = selected.sch.deadline ? dayInTimezone(selected.sch.deadline, tz) : null;
  const href = (o: Partial<Search>) => `/planner?${new URLSearchParams({ application: selected.app.id, view, filter, ...o } as Record<string, string>).toString()}`;
  const counts = { overdue: withStatus.filter((m) => m.effective === "overdue").length, completed: withStatus.filter((m) => m.effective === "completed").length };
  const locked = ["submitted", "shortlisted", "outcome"].includes(selected.app.status);

  return (
    <>
      <PageHeader
        title="Application planner"
        description="Your milestones, scheduled backward from the official deadline. Adjust dates to fit your life — we'll keep you on track."
        actions={
          !locked && (
            <>
              <ActionButton action={regenerateScheduleAction} fields={{ applicationId: selected.app.id }} variant="secondary">Recalculate plan</ActionButton>
              <ActionButton action={regenerateScheduleAction} fields={{ applicationId: selected.app.id, reset: "1" }} variant="ghost" confirm="Reset all your custom dates to the recommended schedule?">Reset my custom dates</ActionButton>
            </>
          )
        }
      />

      {apps.length > 1 && (
        <form method="get" className="mb-6 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="application">Application</Label>
            <Select id="application" name="application" defaultValue={selected.app.id} className="w-auto min-w-64">
              {apps.map((a) => <option key={a.app.id} value={a.app.id}>{a.sch.name}</option>)}
            </Select>
          </div>
          <Button type="submit" variant="secondary">Show</Button>
        </form>
      )}

      <Card className="mb-6">
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Official deadline</p>
            <p className="mt-1 font-display text-xl">{formatDate(deadlineDay)}</p>
            <p className="text-xs text-muted">{deadlineDay ? `${diffDays(deadlineDay, today)} days from today` : ""}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Tasks completed</p>
            <p className="mt-1 font-display text-xl">{counts.completed} / {ms.length}</p>
            <Progress value={milestoneProgress(ms)} label="Milestone progress" className="mt-2" tone="success" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Overdue</p>
            <p className={cn("mt-1 font-display text-xl", counts.overdue && "text-danger-700")}>{counts.overdue}</p>
            <p className="text-xs text-muted">{counts.overdue ? "Catch up, or adjust the dates below" : "Nothing overdue — well done"}</p>
          </div>
        </CardBody>
      </Card>

      {notice && (
        <Alert tone="warning" title="Your schedule is compressed" className="mb-6">
          {notice.warnings.map((w) => <p key={w}>{w}</p>)}
          {notice.prioritisation.length > 0 && (
            <>
              <p className="mt-2 font-semibold">Recommended priority plan</p>
              <ol className="list-decimal pl-5">{notice.prioritisation.map((p) => <li key={p}>{p}</li>)}</ol>
            </>
          )}
        </Alert>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Planner views" className="flex rounded-lg border border-line bg-white p-1">
          {(["list", "timeline", "calendar"] as const).map((v) => (
            <Link key={v} href={href({ view: v })} aria-current={view === v ? "page" : undefined} className={cn("rounded-md px-3 py-1.5 text-sm font-semibold capitalize", view === v ? "bg-navy-900 text-ivory" : "text-navy-800 hover:bg-ivory-200")}>{v}</Link>
          ))}
        </nav>
        {view !== "calendar" && (
          <nav aria-label="Filter tasks" className="flex flex-wrap gap-2 text-sm">
            {["all", "upcoming", "overdue", "completed"].map((f) => (
              <Link key={f} href={href({ filter: f })} aria-current={filter === f ? "page" : undefined} className={cn("rounded-full border px-3 py-1 font-medium capitalize", filter === f ? "border-navy-900 bg-navy-900 text-ivory" : "border-line bg-white hover:bg-ivory-200")}>{f}</Link>
            ))}
          </nav>
        )}
      </div>

      {ms.length === 0 ? (
        <EmptyState icon={CalendarClock} title="No tasks yet" description="Recalculate your plan to generate milestones from the deadline." />
      ) : view === "timeline" ? (
        <Timeline items={filtered} today={today} deadline={deadlineDay} />
      ) : view === "calendar" ? (
        <Calendar items={withStatus} today={today} month={sp.month} hrefFor={(m) => href({ month: m })} />
      ) : (
        <ul className="space-y-3">
          {filtered.map((m) => (
            <li key={m.id} className={cn("rounded-[var(--radius-card)] border bg-white p-4 sm:p-5", m.effective === "overdue" ? "border-red-200" : "border-line")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {m.name}
                    {m.isCritical && <Badge tone="danger"><Flame className="size-3" aria-hidden /> Critical path</Badge>}
                    {m.isCompressed && <Badge tone="warning"><Zap className="size-3" aria-hidden /> Compressed</Badge>}
                    {!m.isRequired && <Badge>Optional</Badge>}
                    {m.isCustomDate && <Badge tone="info">Your dates</Badge>}
                  </p>
                  {m.description && <p className="mt-1 text-sm text-muted">{m.description}</p>}
                  <p className="mt-2 text-sm">{formatDate(m.startDate)} → <strong>{formatDate(m.dueDate)}</strong> <span className="text-muted">· {m.durationDays} day{m.durationDays === 1 ? "" : "s"}{m.plannedDurationDays !== m.durationDays ? ` (planned ${m.plannedDurationDays})` : ""}</span></p>
                  {m.dependsOn.length > 0 && <p className="mt-1 text-xs text-muted">After: {m.dependsOn.map((d) => byId.get(d)?.name).filter(Boolean).join(", ")}</p>}
                  {m.completionNotes && <p className="mt-2 rounded-lg bg-ivory-200/70 p-2 text-sm">Note: {m.completionNotes}</p>}
                </div>
                <MilestoneBadge status={m.effective} />
              </div>
              {!locked && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {m.status !== "completed" && <ActionButton action={milestoneAction} fields={{ milestoneId: m.id, status: "completed" }} size="sm">Mark complete</ActionButton>}
                  {m.status === "upcoming" && <ActionButton action={milestoneAction} fields={{ milestoneId: m.id, status: "in_progress" }} size="sm" variant="secondary">Start</ActionButton>}
                  {m.status !== "blocked" && m.status !== "completed" && <ActionButton action={milestoneAction} fields={{ milestoneId: m.id, status: "blocked" }} size="sm" variant="ghost">I&apos;m blocked</ActionButton>}
                  {(m.status === "completed" || m.status === "blocked") && <ActionButton action={milestoneAction} fields={{ milestoneId: m.id, status: "in_progress" }} size="sm" variant="ghost">{m.status === "completed" ? "Reopen" : "Unblock"}</ActionButton>}
                  <details className="w-full">
                    <summary className="cursor-pointer text-sm font-semibold text-royal-700">Adjust dates or add a note</summary>
                    <ActionForm action={milestoneAction} className="mt-3 grid gap-3 sm:grid-cols-2">
                      <input type="hidden" name="milestoneId" value={m.id} />
                      <div className="space-y-1.5"><Label htmlFor={`s-${m.id}`}>Start</Label><Input id={`s-${m.id}`} type="date" name="startDate" defaultValue={m.startDate} min={today} max={deadlineDay ?? undefined} /></div>
                      <div className="space-y-1.5"><Label htmlFor={`d-${m.id}`}>Due</Label><Input id={`d-${m.id}`} type="date" name="dueDate" defaultValue={m.dueDate} min={today} max={deadlineDay ?? undefined} /></div>
                      <div className="space-y-1.5 sm:col-span-2"><Label htmlFor={`n-${m.id}`}>Notes</Label><Textarea id={`n-${m.id}`} name="completionNotes" defaultValue={m.completionNotes ?? ""} className="min-h-16" /></div>
                      <SubmitButton size="sm" variant="secondary" className="sm:col-span-2 sm:justify-self-start">Save changes</SubmitButton>
                    </ActionForm>
                  </details>
                </div>
              )}
            </li>
          ))}
          {filtered.length === 0 && <li className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">No tasks in this view.</li>}
        </ul>
      )}
    </>
  );
}

function Timeline({ items, today, deadline }: { items: (Awaited<ReturnType<typeof milestonesForApplication>>[number] & { effective: ReturnType<typeof effectiveStatus> })[]; today: string; deadline: string | null }) {
  if (!items.length) return <p className="text-sm text-muted">No tasks in this view.</p>;
  const start = items.reduce((a, m) => (m.startDate < a ? m.startDate : a), today < items[0].startDate ? today : items[0].startDate);
  const end = deadline ?? items.reduce((a, m) => (m.dueDate > a ? m.dueDate : a), items[0].dueDate);
  const span = Math.max(1, diffDays(end, start) + 1);
  const pct = (d: string) => (diffDays(d, start) / span) * 100;
  const color: Record<string, string> = { completed: "bg-success-700", overdue: "bg-danger-700", due_today: "bg-gold-500", in_progress: "bg-royal-600", blocked: "bg-warning-700", upcoming: "bg-navy-700" };
  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-white p-4">
      <div className="min-w-[640px]">
        <div className="mb-2 flex justify-between text-xs text-muted"><span>{formatDate(start)}</span><span>Deadline {formatDate(end)}</span></div>
        <div className="relative space-y-2">
          <div aria-hidden className="absolute inset-y-0 w-px bg-gold-500" style={{ left: `calc(${pct(today)}% + 11rem)` }} />
          {items.map((m) => (
            <div key={m.id} className="flex items-center gap-2">
              <p className="w-44 shrink-0 truncate text-sm" title={m.name}>{m.name}</p>
              <div className="relative h-6 flex-1 rounded bg-ivory-200/70">
                <div className={cn("absolute top-0 h-6 rounded", color[m.effective])} style={{ left: `${pct(m.startDate)}%`, width: `${Math.max(1.5, ((diffDays(m.dueDate, m.startDate) + 1) / span) * 100)}%` }} title={`${m.startDate} → ${m.dueDate}`} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">The gold line marks today. Bars are coloured by status.</p>
      </div>
    </div>
  );
}

function Calendar({ items, today, month, hrefFor }: { items: (Awaited<ReturnType<typeof milestonesForApplication>>[number] & { effective: ReturnType<typeof effectiveStatus> })[]; today: string; month?: string; hrefFor: (m: string) => string }) {
  const ym = month && /^\d{4}-\d{2}$/.test(month) ? month : (items.find((m) => m.effective !== "completed")?.dueDate ?? today).slice(0, 7);
  const first = `${ym}-01`;
  const firstN = parseDay(first);
  const weekday = (new Date(firstN * 86_400_000).getUTCDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(weekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => addDays(first, i))];
  while (cells.length % 7) cells.push(null);
  const prev = addDays(first, -1).slice(0, 7);
  const next = addDays(first, daysInMonth).slice(0, 7);
  const label = new Date(firstN * 86_400_000).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <Link href={hrefFor(prev)} className="rounded-lg px-3 py-1.5 text-sm font-semibold hover:bg-ivory-200">← Previous</Link>
        <h2 className="font-semibold">{label}</h2>
        <Link href={hrefFor(next)} className="rounded-lg px-3 py-1.5 text-sm font-semibold hover:bg-ivory-200">Next →</Link>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-line text-xs" role="grid" aria-label={`Tasks due in ${label}`}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} role="columnheader" className="bg-ivory px-1 py-1.5 text-center font-semibold text-muted">{d}</div>)}
        {cells.map((d, i) => {
          const due = d ? items.filter((m) => m.dueDate === d) : [];
          return (
            <div key={i} role="gridcell" className={cn("min-h-20 bg-white p-1", d === today && "bg-gold-50")}>
              {d && <p className={cn("text-right text-[11px]", d === today ? "font-bold text-gold-700" : "text-muted")}>{Number(d.slice(8))}</p>}
              {due.map((m) => (
                <p key={m.id} className={cn("mt-0.5 truncate rounded px-1 py-0.5 text-[11px] font-medium", m.effective === "completed" ? "bg-success-100 text-success-700 line-through" : m.effective === "overdue" ? "bg-danger-100 text-danger-700" : "bg-navy-50 text-navy-800")} title={m.name}>{m.name}</p>
              ))}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted">Tasks appear on their due date.</p>
    </div>
  );
}
