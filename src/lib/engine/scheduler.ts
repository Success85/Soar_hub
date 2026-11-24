/**
 * Backward deadline scheduler over a directed acyclic graph of milestone templates.
 *
 * Dates are calendar days ("YYYY-MM-DD"). A task occupies [start, due] inclusive, so
 * due = start + duration - 1, and every prerequisite must be due strictly before its
 * dependant starts. Sink tasks (nothing depends on them) are due on the deadline.
 *
 * If the time available is shorter than the critical path, the scheduler never invents
 * dates in the past: it compresses durations (optional tasks first, then proportionally),
 * flags every compressed task, explains the risk, and returns a prioritisation plan.
 */

export type Priority = "low" | "medium" | "high" | "critical";

export interface TaskTemplate {
  key: string;
  name: string;
  description?: string | null;
  durationDays: number;
  dependsOn: string[];
  priority?: Priority;
  isRequired?: boolean;
  sortOrder?: number;
}

export interface ScheduledTask {
  key: string;
  name: string;
  description: string | null;
  startDate: string;
  dueDate: string;
  durationDays: number;
  plannedDurationDays: number;
  dependsOn: string[];
  priority: Priority;
  isRequired: boolean;
  isCritical: boolean;
  isCompressed: boolean;
  sortOrder: number;
}

export interface ScheduleResult {
  tasks: ScheduledTask[];
  compressed: boolean;
  feasible: boolean;
  availableDays: number;
  requiredDays: number;
  bufferDays: number;
  warnings: string[];
  prioritisation: string[];
}

export class ScheduleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScheduleError";
  }
}

/* ---------------- date helpers (UTC calendar days) ---------------- */

const DAY = 86_400_000;
export function parseDay(d: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) throw new ScheduleError(`Invalid date: ${d}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY;
}
export function formatDay(n: number): string {
  return new Date(n * DAY).toISOString().slice(0, 10);
}
export function addDays(d: string, n: number): string {
  return formatDay(parseDay(d) + n);
}
export function diffDays(a: string, b: string): number {
  return parseDay(a) - parseDay(b);
}
/** Calendar day of an instant in a given IANA timezone. */
export function dayInTimezone(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/* ---------------- graph validation ---------------- */

/** Returns keys in topological order (prerequisites first). Throws on unknown deps or cycles. */
export function topologicalOrder(tasks: TaskTemplate[]): string[] {
  const keys = new Set<string>();
  for (const t of tasks) {
    if (!t.key?.trim()) throw new ScheduleError("Every milestone needs a key.");
    if (keys.has(t.key)) throw new ScheduleError(`Duplicate milestone key “${t.key}”.`);
    keys.add(t.key);
    if (!Number.isInteger(t.durationDays) || t.durationDays < 1) throw new ScheduleError(`Milestone “${t.name}” must last at least one day.`);
  }
  const indeg = new Map<string, number>();
  const succ = new Map<string, string[]>();
  for (const t of tasks) {
    indeg.set(t.key, indeg.get(t.key) ?? 0);
    for (const dep of t.dependsOn) {
      if (!keys.has(dep)) throw new ScheduleError(`Milestone “${t.name}” depends on unknown milestone “${dep}”.`);
      if (dep === t.key) throw new ScheduleError(`Milestone “${t.name}” cannot depend on itself.`);
      indeg.set(t.key, (indeg.get(t.key) ?? 0) + 1);
      succ.set(dep, [...(succ.get(dep) ?? []), t.key]);
    }
  }
  const order = tasks.filter((t) => (indeg.get(t.key) ?? 0) === 0).sort(bySort).map((t) => t.key);
  const queue = [...order];
  const result: string[] = [];
  const bySortKey = new Map(tasks.map((t) => [t.key, t]));
  while (queue.length) {
    const k = queue.shift()!;
    result.push(k);
    const next = (succ.get(k) ?? []).map((s) => bySortKey.get(s)!).sort(bySort);
    for (const n of next) {
      indeg.set(n.key, indeg.get(n.key)! - 1);
      if (indeg.get(n.key) === 0) queue.push(n.key);
    }
  }
  if (result.length !== tasks.length) {
    const stuck = tasks.filter((t) => !result.includes(t.key)).map((t) => t.name);
    throw new ScheduleError(`Milestone dependencies contain a cycle involving: ${stuck.join(", ")}.`);
  }
  return result;
}

function bySort(a: TaskTemplate, b: TaskTemplate) {
  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.key.localeCompare(b.key);
}

/* ---------------- core scheduling ---------------- */

interface Offsets {
  /** offset from deadline (0 = deadline day, negative = earlier) */
  start: Map<string, number>;
  due: Map<string, number>;
}

function backward(tasks: TaskTemplate[], order: string[], dur: Map<string, number>): Offsets {
  const succ = new Map<string, string[]>();
  for (const t of tasks) for (const d of t.dependsOn) succ.set(d, [...(succ.get(d) ?? []), t.key]);
  const start = new Map<string, number>();
  const due = new Map<string, number>();
  for (const k of [...order].reverse()) {
    const s = succ.get(k) ?? [];
    const lf = s.length === 0 ? 0 : Math.min(...s.map((x) => start.get(x)! - 1));
    due.set(k, lf);
    start.set(k, lf - dur.get(k)! + 1);
  }
  return { start, due };
}

/** Length (days) of the longest dependency chain ending at a sink. */
function span(o: Offsets): number {
  return -Math.min(...o.start.values()) + 1;
}

function criticalKeys(tasks: TaskTemplate[], order: string[], dur: Map<string, number>, o: Offsets): Set<string> {
  // forward pass from the earliest start: a task is critical when it has no slack
  const earliest = Math.min(...o.start.values());
  const es = new Map<string, number>();
  const byKey = new Map(tasks.map((t) => [t.key, t]));
  for (const k of order) {
    const deps = byKey.get(k)!.dependsOn;
    es.set(k, deps.length === 0 ? earliest : Math.max(...deps.map((d) => es.get(d)! + dur.get(d)!)));
  }
  return new Set(order.filter((k) => es.get(k) === o.start.get(k)));
}

export interface ScheduleOptions {
  /** Days to finish before the deadline. "auto" = a third of the slack, capped at 7 days. */
  bufferDays?: number | "auto";
}

export function backwardSchedule(templates: TaskTemplate[], deadline: string, today: string, opts: ScheduleOptions = {}): ScheduleResult {
  if (templates.length === 0) throw new ScheduleError("No milestones to schedule.");
  const order = topologicalOrder(templates);
  const available = diffDays(deadline, today) + 1;
  const warnings: string[] = [];
  if (available < 1) {
    throw new ScheduleError("The official deadline for this scholarship has already passed, so a schedule can't be created.");
  }

  const planned = new Map(templates.map((t) => [t.key, t.durationDays]));
  const dur = new Map(planned);
  let offsets = backward(templates, order, dur);
  const required = span(offsets);
  let compressed = false;
  let feasible = true;

  if (required > available) {
    compressed = true;
    // 1) optional tasks first: shrink them to a single day
    for (const t of templates) if (t.isRequired === false) dur.set(t.key, 1);
    offsets = backward(templates, order, dur);
    // 2) proportional compression of everything else
    if (span(offsets) > available) {
      const factor = available / span(offsets);
      for (const t of templates) dur.set(t.key, Math.max(1, Math.floor(dur.get(t.key)! * factor)));
      offsets = backward(templates, order, dur);
    }
    // 3) trim the longest remaining tasks one day at a time
    let guard = 10_000;
    while (span(offsets) > available && guard-- > 0) {
      const longest = [...dur.entries()].filter(([, d]) => d > 1).sort((a, b) => b[1] - a[1])[0];
      if (!longest) break;
      dur.set(longest[0], longest[1] - 1);
      offsets = backward(templates, order, dur);
    }
    if (span(offsets) > available) feasible = false;
  }

  let buffer = 0;
  if (!compressed && opts.bufferDays !== undefined) {
    const slack = available - required;
    buffer = opts.bufferDays === "auto" ? Math.min(7, Math.floor(slack / 3)) : Math.max(0, Math.min(opts.bufferDays, slack));
  }
  const critical = criticalKeys(templates, order, dur, offsets);
  const deadlineN = parseDay(deadline) - buffer;
  const todayN = parseDay(today);
  const byKey = new Map(templates.map((t) => [t.key, t]));

  const tasks: ScheduledTask[] = order.map((k, i) => {
    const t = byKey.get(k)!;
    let s = deadlineN + offsets.start.get(k)!;
    let d = deadlineN + offsets.due.get(k)!;
    // never schedule in the past: stack remaining work from today
    if (s < todayN) s = todayN;
    if (d < todayN) d = todayN;
    const isCompressed = dur.get(k)! < planned.get(k)! || !feasible;
    return {
      key: k,
      name: t.name,
      description: t.description ?? null,
      startDate: formatDay(s),
      dueDate: formatDay(d),
      durationDays: d - s + 1,
      plannedDurationDays: planned.get(k)!,
      dependsOn: t.dependsOn,
      priority: critical.has(k) && compressed ? "critical" : t.priority ?? "medium",
      isRequired: t.isRequired !== false,
      isCritical: critical.has(k),
      isCompressed,
      sortOrder: i,
    };
  });

  const prioritisation: string[] = [];
  if (compressed) {
    warnings.push(
      `Your full plan needs about ${required} days, but only ${available} day${available === 1 ? "" : "s"} remain before the deadline. We've compressed ${tasks.filter((t) => t.isCompressed).length} task(s) so every date is still in the future.`,
    );
    if (!feasible) {
      warnings.push("Even after compression, some tasks overlap on the same days. Submitting a strong application is still possible, but you'll need to work on several tasks at once.");
    }
    warnings.push("Compressed schedules carry real risk — especially for tasks that depend on other people (referees, schools issuing transcripts). Start those today.");
    const crit = tasks.filter((t) => t.isCritical && t.isRequired);
    prioritisation.push("Focus first on tasks that depend on other people: request reference letters and transcripts immediately.");
    for (const t of crit) prioritisation.push(`${t.name} — due ${t.dueDate}${t.isCompressed ? " (compressed)" : ""}`);
    const optional = tasks.filter((t) => !t.isRequired);
    if (optional.length) prioritisation.push(`If time runs short, these optional tasks can be shortened or skipped: ${optional.map((t) => t.name).join(", ")}.`);
  }

  return { tasks, compressed, feasible, availableDays: available, requiredDays: required, bufferDays: buffer, warnings, prioritisation };
}

/* ---------------- effective status ---------------- */

export type StoredMilestoneStatus = "upcoming" | "in_progress" | "completed" | "blocked";
export type EffectiveMilestoneStatus = StoredMilestoneStatus | "due_today" | "overdue";

export function effectiveStatus(m: { status: StoredMilestoneStatus; dueDate: string }, today: string): EffectiveMilestoneStatus {
  if (m.status === "completed") return "completed";
  if (m.status === "blocked") return "blocked";
  const diff = diffDays(m.dueDate, today);
  if (diff < 0) return "overdue";
  if (diff === 0) return "due_today";
  return m.status;
}

/** Progress (0–100) weighting required milestones double. */
export function milestoneProgress(ms: { status: StoredMilestoneStatus; isRequired: boolean }[]): number {
  if (ms.length === 0) return 0;
  let total = 0;
  let done = 0;
  for (const m of ms) {
    const w = m.isRequired ? 2 : 1;
    total += w;
    if (m.status === "completed") done += w;
  }
  return Math.round((done / total) * 100);
}
