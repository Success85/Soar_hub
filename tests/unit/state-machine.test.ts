import { describe, expect, it } from "vitest";
import { allowedTransitions, canTransition } from "@/lib/engine/state-machine";

describe("application state machine", () => {
  it("allows the happy path", () => {
    expect(canTransition("draft", "screening", { actor: "applicant" }).ok).toBe(true);
    expect(canTransition("screening", "eligible", { actor: "system", assessmentVerdict: "likely_eligible" }).ok).toBe(true);
    expect(canTransition("eligible", "in_progress", { actor: "applicant" }).ok).toBe(true);
    expect(canTransition("in_progress", "submitted", { actor: "applicant", missingDocuments: [], incompleteMilestones: [] }).ok).toBe(true);
    expect(canTransition("submitted", "shortlisted", { actor: "admin" }).ok).toBe(true);
    expect(canTransition("shortlisted", "outcome", { actor: "admin", outcome: "awarded" }).ok).toBe(true);
  });

  it("rejects invalid transitions", () => {
    const r = canTransition("draft", "submitted", { actor: "applicant" });
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/can't move/);
    expect(canTransition("outcome", "draft", { actor: "admin" }).ok).toBe(false);
  });

  it("guards submission on documents and milestones", () => {
    const r = canTransition("in_progress", "submitted", { actor: "applicant", missingDocuments: ["Transcript"], incompleteMilestones: ["Final review"] });
    expect(r.ok).toBe(false);
    expect(r.errors).toHaveLength(2);
  });

  it("blocks submission when the assessment is not eligible", () => {
    expect(canTransition("in_progress", "submitted", { actor: "applicant", assessmentVerdict: "not_eligible" }).ok).toBe(false);
  });

  it("only the system/admin decides screening results; admins must give reasons", () => {
    expect(canTransition("screening", "eligible", { actor: "applicant" }).ok).toBe(false);
    expect(canTransition("screening", "eligible", { actor: "system", assessmentVerdict: "more_info_needed" }).ok).toBe(false);
    expect(canTransition("screening", "eligible", { actor: "admin" }).ok).toBe(false);
    expect(canTransition("screening", "eligible", { actor: "admin", reason: "Verified with university" }).ok).toBe(true);
  });

  it("outcome requires a value", () => {
    expect(canTransition("submitted", "outcome", { actor: "applicant" }).ok).toBe(false);
  });

  it("lists allowed transitions by actor", () => {
    expect(allowedTransitions("screening", "applicant")).toEqual([]);
    expect(allowedTransitions("submitted", "admin")).toEqual(["shortlisted", "outcome"]);
  });
});
