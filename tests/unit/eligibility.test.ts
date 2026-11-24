import { describe, expect, it } from "vitest";
import { and3, buildFacts, calculateAge, evaluate, evaluateOperator, or3, planQuestions, validateCriteria, type Criterion } from "@/lib/engine/eligibility";

const c = (over: Partial<Criterion>): Criterion => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  name: "Test",
  fieldKey: "age",
  operator: "lte",
  requiredValue: 29,
  severity: "important",
  isFixable: true,
  isRequired: true,
  ...over,
});

describe("operators", () => {
  it.each([
    ["eq", "Nigeria", "nigeria", "eligible"],
    ["eq", "Ghana", "Nigeria", "ineligible"],
    ["neq", "Ghana", "Nigeria", "eligible"],
    ["gt", 30, 29, "eligible"],
    ["gt", 29, 29, "ineligible"],
    ["gte", 29, 29, "eligible"],
    ["lt", 28, 29, "eligible"],
    ["lte", 30, 29, "ineligible"],
    ["in", "Lagos", ["Lagos", "Kano"], "eligible"],
    ["in", "Oyo", ["Lagos", "Kano"], "ineligible"],
    ["not_in", "Oyo", ["Lagos"], "eligible"],
    ["not_in", ["WASSCE", "NECO"], ["NECO"], "ineligible"],
    ["contains", ["WASSCE", "UTME"], ["WASSCE"], "eligible"],
    ["contains", ["UTME"], ["WASSCE"], "ineligible"],
    ["contains", "Computer Science", "science", "eligible"],
    ["between", 20, [16, 29], "eligible"],
    ["between", 30, [16, 29], "ineligible"],
    ["between", 15, [16, null], "ineligible"],
    ["age_between", 17, [17, 29], "eligible"],
    ["is_true", true, null, "eligible"],
    ["is_true", false, null, "ineligible"],
    ["is_false", false, null, "eligible"],
    ["matches", "080-1234", "^\\d{3}-", "eligible"],
  ] as const)("%s(%j, %j) → %s", (op, value, req, expected) => {
    expect(evaluateOperator(op, value, req)).toBe(expected);
  });

  it("returns undetermined for missing data instead of ineligible", () => {
    for (const op of ["eq", "neq", "gt", "gte", "lt", "lte", "in", "not_in", "contains", "is_true", "is_false", "between", "matches"] as const) {
      expect(evaluateOperator(op, null, 1)).toBe("undetermined");
      expect(evaluateOperator(op, undefined, 1)).toBe("undetermined");
      expect(evaluateOperator(op, "  ", 1)).toBe("undetermined");
    }
  });

  it("exists / not_exists", () => {
    expect(evaluateOperator("exists", "x", null)).toBe("eligible");
    expect(evaluateOperator("exists", null, null)).toBe("undetermined");
    expect(evaluateOperator("not_exists", null, null)).toBe("eligible");
    expect(evaluateOperator("not_exists", "x", null)).toBe("ineligible");
  });

  it("invalid regex is undetermined, not a crash", () => {
    expect(evaluateOperator("matches", "abc", "([")).toBe("undetermined");
  });
});

describe("three-valued logic", () => {
  it("AND", () => {
    expect(and3(["eligible", "eligible"])).toBe("eligible");
    expect(and3(["eligible", "undetermined"])).toBe("undetermined");
    expect(and3(["undetermined", "ineligible"])).toBe("ineligible");
  });
  it("OR", () => {
    expect(or3(["ineligible", "eligible"])).toBe("eligible");
    expect(or3(["ineligible", "undetermined"])).toBe("undetermined");
    expect(or3(["ineligible", "ineligible"])).toBe("ineligible");
  });
});

describe("evaluate()", () => {
  const criteria = [
    c({ id: "age", name: "Age limit", severity: "absolute", isFixable: false }),
    c({ id: "cit", name: "Citizenship", fieldKey: "country_of_citizenship", operator: "eq", requiredValue: "Nigeria", severity: "absolute" }),
    c({ id: "need", name: "Financial need", fieldKey: "demonstrates_financial_need", operator: "is_true", requiredValue: null }),
    c({ id: "q1", name: "WASSCE", fieldKey: "qualifications", operator: "contains", requiredValue: ["WASSCE"], groupId: "g" }),
    c({ id: "q2", name: "NECO", fieldKey: "qualifications", operator: "contains", requiredValue: ["NECO"], groupId: "g" }),
    c({ id: "adv", name: "Advisory", fieldKey: "first_generation", operator: "is_true", requiredValue: null, isRequired: false, severity: "advisory" }),
  ];
  const groups = [{ id: "g", name: "Secondary qualification", logic: "or" as const }];

  it("likely eligible when all required criteria pass (advisory ignored)", () => {
    const r = evaluate(criteria, { age: 19, country_of_citizenship: "Nigeria", demonstrates_financial_need: true, qualifications: ["NECO"], first_generation: false }, groups);
    expect(r.overall).toBe("likely_eligible");
    expect(r.groupVerdicts.g).toBe("eligible");
    expect(r.summary).toMatch(/not a guarantee/);
  });

  it("more info needed when data missing", () => {
    const r = evaluate(criteria, { age: 19, country_of_citizenship: "Nigeria" }, groups);
    expect(r.overall).toBe("more_info_needed");
    const need = r.results.find((x) => x.criterionId === "need")!;
    expect(need.verdict).toBe("undetermined");
    expect(need.explanation).toMatch(/don't have enough information/);
    expect(need.isFixable).toBe(true);
  });

  it("not eligible with absolute explanation", () => {
    const r = evaluate(criteria, { age: 31, country_of_citizenship: "Nigeria", demonstrates_financial_need: true, qualifications: ["WASSCE"] }, groups);
    expect(r.overall).toBe("not_eligible");
    const age = r.results.find((x) => x.criterionId === "age")!;
    expect(age.isAbsolute).toBe(true);
    expect(age.isFixable).toBe(false);
    expect(age.explanation).toMatch(/absolute criterion/);
  });

  it("ineligible beats undetermined", () => {
    const r = evaluate(criteria, { age: 35 }, groups);
    expect(r.overall).toBe("not_eligible");
  });

  it("uses admin-supplied explanations", () => {
    const r = evaluate([c({ passExplanation: "Your age meets this scholarship's requirements." })], { age: 20 });
    expect(r.results[0].explanation).toBe("Your age meets this scholarship's requirements.");
  });
});

describe("facts", () => {
  it("calculates age correctly around birthdays", () => {
    expect(calculateAge("2000-06-15", new Date("2026-06-14T12:00:00Z"))).toBe(25);
    expect(calculateAge("2000-06-15", new Date("2026-06-15T12:00:00Z"))).toBe(26);
    expect(calculateAge(null)).toBeNull();
    expect(calculateAge("garbage")).toBeNull();
  });
  it("builds derived and custom facts", () => {
    const f = buildFacts({ profile: { dateOfBirth: "2005-01-01", creditPasses: "6", countryOfCitizenship: "Nigeria" }, documentCategories: ["cv"], customAnswers: { "custom.leadership": true, ignored: 1 }, deadline: new Date("2027-01-02T00:00:00Z"), now: new Date("2026-11-23T00:00:00Z") });
    expect(f.age).toBe(21);
    expect(f.age_at_deadline).toBe(22);
    expect(f.credit_passes).toBe(6);
    expect(f.uploaded_document_categories).toEqual(["cv"]);
    expect(f["custom.leadership"]).toBe(true);
    expect(f.ignored).toBeUndefined();
  });
});

describe("adaptive questions", () => {
  const setA = {
    scholarshipId: "A",
    groups: [],
    criteria: [
      c({ id: "a1", fieldKey: "age", severity: "absolute" }),
      c({ id: "a2", fieldKey: "household_income_band", operator: "in", requiredValue: ["very_low", "low"] }),
      c({ id: "a3", fieldKey: "credit_passes", operator: "gte", requiredValue: 5 }),
    ],
  };
  const setB = {
    scholarshipId: "B",
    groups: [],
    criteria: [c({ id: "b1", fieldKey: "credit_passes", operator: "gte", requiredValue: 6 }), c({ id: "b2", fieldKey: "country_of_citizenship", operator: "eq", requiredValue: "Nigeria", severity: "absolute" })],
  };

  it("asks non-sensitive questions before sensitive ones, and absolute/shared fields first", () => {
    const qs = planQuestions([setA, setB], {});
    const keys = qs.map((q) => q.fieldKey);
    expect(keys[keys.length - 1]).toBe("household_income_band");
    expect(keys.indexOf("credit_passes")).toBeLessThan(keys.indexOf("household_income_band"));
    // age is asked via date_of_birth
    expect(keys).toContain("date_of_birth");
    expect(keys).not.toContain("age");
  });

  it("never asks for known information", () => {
    const qs = planQuestions([setA], { credit_passes: 7, date_of_birth: "2004-01-01", age: 22 });
    expect(qs.map((q) => q.fieldKey)).toEqual(["household_income_band"]);
  });

  it("eliminates scholarships early when a definite disqualifier exists", () => {
    const qs = planQuestions([setA, setB], { country_of_citizenship: "Ghana" });
    // B is decided (ineligible) so b1's credit_passes question only serves A
    const cp = qs.find((q) => q.fieldKey === "credit_passes")!;
    expect(cp.scholarshipIds).toEqual(["A"]);
  });

  it("skips moot members of a satisfied OR group", () => {
    const set = {
      scholarshipId: "C",
      groups: [{ id: "g", name: "Either", logic: "or" as const }],
      criteria: [c({ id: "x", fieldKey: "first_generation", operator: "is_true", groupId: "g" }), c({ id: "y", fieldKey: "credit_passes", operator: "gte", requiredValue: 5, groupId: "g" }), c({ id: "z", fieldKey: "graduation_year", operator: "gte", requiredValue: 2024 })],
    };
    const qs = planQuestions([set], { first_generation: true });
    expect(qs.map((q) => q.fieldKey)).toEqual(["graduation_year"]);
  });
});

describe("validateCriteria", () => {
  it("catches configuration errors", () => {
    const errs = validateCriteria([
      c({ name: "", fieldKey: "nope" }),
      c({ operator: "between", requiredValue: [30, 20] }),
      c({ operator: "in", requiredValue: [] }),
      c({ fieldKey: "custom.x", operator: "is_true", questionText: "" }),
    ]);
    expect(errs.join("\n")).toMatch(/name is required/);
    expect(errs.join("\n")).toMatch(/unknown field/);
    expect(errs.join("\n")).toMatch(/minimum is greater/);
    expect(errs.join("\n")).toMatch(/at least one allowed/);
    expect(errs.join("\n")).toMatch(/custom criteria need a question/);
  });
  it("accepts a valid set", () => {
    expect(validateCriteria([c({})])).toEqual([]);
  });
});
