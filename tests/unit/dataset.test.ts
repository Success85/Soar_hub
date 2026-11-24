import { describe, expect, it } from "vitest";
import { documentsFor, MCF_SCHOLARSHIPS } from "@/lib/data/mcf-scholarships";
import { buildFacts, evaluate, validateCriteria, type Criterion } from "@/lib/engine/eligibility";

const toEngine = (s: (typeof MCF_SCHOLARSHIPS)[number]) => ({
  criteria: s.criteria.map((c, i) => ({ ...c, id: `c${i}`, severity: c.severity ?? "important", isFixable: c.isFixable ?? true, isRequired: c.isRequired ?? true, groupId: c.group ?? null, requiredValue: c.requiredValue ?? null }) as Criterion),
  groups: (s.groups ?? []).map((g) => ({ id: g.key, name: g.name, logic: g.logic })),
});

describe("Mastercard Foundation dataset (24 Nov 2026)", () => {
  it("has 35 entries with unique slugs and numbers", () => {
    expect(MCF_SCHOLARSHIPS).toHaveLength(35);
    expect(new Set(MCF_SCHOLARSHIPS.map((s) => s.slug)).size).toBe(35);
    expect(MCF_SCHOLARSHIPS.map((s) => s.n)).toEqual(Array.from({ length: 35 }, (_, i) => i + 1));
  });
  it("every rule set is valid and every source is https", () => {
    for (const s of MCF_SCHOLARSHIPS) {
      const { criteria, groups } = toEngine(s);
      expect(validateCriteria(criteria, groups), s.slug).toEqual([]);
      expect(s.officialUrl, s.slug).toMatch(/^https:\/\//);
      if (s.windowStatus === "open" && !s.deadline) expect(s.currentWindow, s.slug).toBeTruthy();
    }
  });
  it("tiered age limits: refugees get the extended limit, no one exceeds the hard cap", () => {
    const mak = toEngine(MCF_SCHOLARSHIPS.find((s) => s.slug === "mcf-makerere-undergraduate")!);
    const now = new Date("2026-11-24T00:00:00Z");
    const facts = (dob: string, refugee: boolean) => ({ ...buildFacts({ profile: { dateOfBirth: dob, isRefugeeOrDisplaced: refugee, hasDisability: false, educationLevel: "secondary_completed", demonstratesFinancialNeed: true }, now }), "custom.other_scholarship": false, "custom.leadership_service": true });
    expect(evaluate(mak.criteria, facts("1996-01-01", false), mak.groups).overall).toBe("not_eligible"); // 30, not refugee
    expect(evaluate(mak.criteria, facts("1996-01-01", true), mak.groups).overall).toBe("likely_eligible"); // 30, refugee
    expect(evaluate(mak.criteria, facts("1990-01-01", true), mak.groups).overall).toBe("not_eligible"); // 36 > 32
  });
  it("nationality-restricted calls exclude other nationals", () => {
    const uac = toEngine(MCF_SCHOLARSHIPS.find((s) => s.slug === "mcf-uac-benin")!);
    const r = evaluate(uac.criteria, { country_of_citizenship: "Nigeria", education_level: "secondary_completed", demonstrates_financial_need: true }, uac.groups);
    expect(r.overall).toBe("not_eligible");
  });

  it("undergraduate and master's opportunities get the right document checklists", () => {
    for (const s of MCF_SCHOLARSHIPS) {
      const names = documentsFor(s).map((d) => d.name);
      if (s.level === "masters") {
        expect(names, s.slug).toEqual(expect.arrayContaining(["Leadership essay", "Statement of purpose (SOP)", "CV", "First-degree transcript"]));
        expect(names.some((n) => n.includes("WAEC")), s.slug).toBe(false);
      } else {
        expect(names, s.slug).toEqual(expect.arrayContaining(["WAEC result (notarised by a lawyer)", "NIN (National Identification Number)", "Police character certificate", "Sponsor's bank statement", "Essay (500 words)", "5-minute video"]));
        expect(names.filter((n) => n.startsWith("Recommendation letter ")).length, s.slug).toBe(2);
        expect(names.includes("Equivalence certificate (Rwanda)"), s.slug).toBe(s.country === "Rwanda");
      }
    }
  });
});
