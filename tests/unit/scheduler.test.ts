import { describe, expect, it } from "vitest";
import { addDays, backwardSchedule, dayInTimezone, diffDays, effectiveStatus, milestoneProgress, ScheduleError, topologicalOrder, type TaskTemplate } from "@/lib/engine/scheduler";

const T = (key: string, durationDays: number, dependsOn: string[] = [], extra: Partial<TaskTemplate> = {}): TaskTemplate => ({ key, name: key, durationDays, dependsOn, ...extra });

const plan: TaskTemplate[] = [
  T("draft", 7),
  T("referee", 3),
  T("revise", 5, ["draft"]),
  T("docs", 4),
  T("final_essay", 3, ["revise"]),
  T("cv", 2, ["docs"]),
  T("letter", 10, ["referee"]),
  T("review", 2, ["final_essay", "cv", "letter"]),
  T("submit", 1, ["review"]),
];

describe("dependency graph", () => {
  it("orders prerequisites first", () => {
    const order = topologicalOrder(plan);
    expect(order.indexOf("draft")).toBeLessThan(order.indexOf("revise"));
    expect(order.indexOf("review")).toBeLessThan(order.indexOf("submit"));
  });
  it("rejects cycles, unknown deps, self-deps and bad durations", () => {
    expect(() => topologicalOrder([T("a", 1, ["b"]), T("b", 1, ["a"])])).toThrow(/cycle/);
    expect(() => topologicalOrder([T("a", 1, ["zzz"])])).toThrow(/unknown/);
    expect(() => topologicalOrder([T("a", 1, ["a"])])).toThrow(/itself/);
    expect(() => topologicalOrder([T("a", 0)])).toThrow(/at least one day/);
    expect(() => topologicalOrder([T("a", 1), T("a", 2)])).toThrow(/Duplicate/);
  });
});

describe("backward scheduling", () => {
  it("works backward from the deadline with dependencies respected", () => {
    const r = backwardSchedule(plan, "2027-03-31", "2026-11-23");
    expect(r.compressed).toBe(false);
    const by = Object.fromEntries(r.tasks.map((t) => [t.key, t]));
    expect(by.submit.dueDate).toBe("2027-03-31");
    expect(by.submit.startDate).toBe("2027-03-31");
    expect(by.review.dueDate).toBe("2027-03-30");
    for (const t of r.tasks) {
      for (const d of t.dependsOn) expect(diffDays(t.startDate, by[d].dueDate)).toBeGreaterThanOrEqual(1);
      expect(diffDays(t.dueDate, t.startDate) + 1).toBe(t.durationDays);
    }
    // critical path: draft(7) → revise(5) → final_essay(3) → review(2) → submit(1) = 18 days
    expect(r.requiredDays).toBe(18);
    expect(by.draft.isCritical).toBe(true);
    expect(by.letter.isCritical).toBe(false);
    expect(by.cv.isCritical).toBe(false);
  });

  it("compresses and warns when the deadline is too close, never using past dates", () => {
    const today = "2026-11-23";
    const r = backwardSchedule(plan, addDays(today, 7), today);
    expect(r.compressed).toBe(true);
    expect(r.warnings.join(" ")).toMatch(/compressed/);
    expect(r.prioritisation.length).toBeGreaterThan(0);
    for (const t of r.tasks) expect(diffDays(t.startDate, today)).toBeGreaterThanOrEqual(0);
    expect(r.tasks.some((t) => t.isCompressed)).toBe(true);
    expect(r.tasks.find((t) => t.key === "submit")!.dueDate).toBe(addDays(today, 7));
  });

  it("shrinks optional tasks first", () => {
    const tasks = [T("a", 5, [], { isRequired: false }), T("b", 3, ["a"]), T("c", 1, ["b"])];
    const r = backwardSchedule(tasks, "2026-12-07", "2026-12-01"); // 7 days available, 9 needed
    const a = r.tasks.find((t) => t.key === "a")!;
    expect(a.durationDays).toBe(1);
    expect(r.tasks.find((t) => t.key === "b")!.durationDays).toBe(3);
  });

  it("flags infeasible plans rather than inventing impossible dates", () => {
    const chain = [T("a", 2), T("b", 2, ["a"]), T("c", 2, ["b"]), T("d", 1, ["c"])];
    const r = backwardSchedule(chain, "2026-12-02", "2026-12-01");
    expect(r.feasible).toBe(false);
    expect(r.warnings.join(" ")).toMatch(/overlap/);
    for (const t of r.tasks) expect(diffDays(t.startDate, "2026-12-01")).toBeGreaterThanOrEqual(0);
  });

  it("refuses when the deadline has passed", () => {
    expect(() => backwardSchedule(plan, "2026-01-01", "2026-11-23")).toThrow(ScheduleError);
  });
});

describe("safety buffer", () => {
  it("finishes early when there is slack, but never when compressed", () => {
    const r = backwardSchedule(plan, "2027-03-31", "2026-11-23", { bufferDays: "auto" });
    expect(r.bufferDays).toBe(7);
    expect(r.tasks.find((t) => t.key === "submit")!.dueDate).toBe("2027-03-24");
    const tight = backwardSchedule(plan, addDays("2026-11-23", 7), "2026-11-23", { bufferDays: "auto" });
    expect(tight.bufferDays).toBe(0);
  });
});

describe("status & progress", () => {
  it("derives due today / overdue", () => {
    expect(effectiveStatus({ status: "upcoming", dueDate: "2026-11-23" }, "2026-11-23")).toBe("due_today");
    expect(effectiveStatus({ status: "in_progress", dueDate: "2026-11-20" }, "2026-11-23")).toBe("overdue");
    expect(effectiveStatus({ status: "completed", dueDate: "2026-11-20" }, "2026-11-23")).toBe("completed");
    expect(effectiveStatus({ status: "blocked", dueDate: "2026-11-20" }, "2026-11-23")).toBe("blocked");
  });
  it("weights required milestones", () => {
    expect(milestoneProgress([{ status: "completed", isRequired: true }, { status: "upcoming", isRequired: false }])).toBe(67);
    expect(milestoneProgress([])).toBe(0);
  });
  it("computes calendar day in a timezone", () => {
    expect(dayInTimezone(new Date("2026-11-23T23:30:00Z"), "Africa/Lagos")).toBe("2026-11-24");
  });
});
