/**
 * Mastercard Foundation Scholars Program partner opportunities — research snapshot of 24 Nov 2026,
 * supplied by the SOAR Hub team. Imported with `npm run db:import-scholarships`.
 *
 * Every entry keeps the team's wording for windows and eligibility. Rules are only encoded where the
 * source states them; anything not stated stays as text ("Key eligibility") rather than being invented.
 * Official URLs are institution domains; deep links to each MCF page should be confirmed by an admin.
 */
type Op = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "not_in" | "is_true" | "is_false" | "between";

export interface SeedCriterion {
  name: string;
  fieldKey: string;
  operator: Op;
  requiredValue?: unknown;
  severity?: "absolute" | "important" | "advisory";
  isFixable?: boolean;
  isRequired?: boolean;
  group?: string;
  description?: string;
  failExplanation?: string;
  recommendedAction?: string;
  questionText?: string;
  answerType?: string;
}

export interface SeedScholarship {
  n: number;
  slug: string;
  name: string;
  university: string;
  country: string;
  city?: string;
  category: "ug_africa" | "ug_outside_africa" | "ug_extra_africa" | "pg_africa" | "pg_outside_africa";
  level: "undergraduate" | "masters";
  fields: string[];
  fieldsText: string;
  windowStatus: "open" | "opens_soon" | "closed" | "not_announced" | "paused";
  currentWindow: string;
  nextWindow: string;
  deadline?: string; // YYYY-MM-DD, interpreted as 23:59 Lagos time
  keyEligibility: string;
  howToApply: string;
  officialName: string;
  officialUrl: string;
  applicationUrl?: string;
  contactEmail?: string;
  researchSources: string;
  groups?: { key: string; name: string; logic: "and" | "or" }[];
  criteria: SeedCriterion[];
  requirements?: SeedRequirement[];
}

export interface SeedRequirement {
  section?: "admission" | "scholarship";
  category: string;
  name: string;
  description?: string;
  isRequired?: boolean;
}

/* ---------------- country lists ---------------- */

export const AFRICAN_COUNTRIES = [
  "Algeria", "Angola", "Benin", "Botswana", "Burkina Faso", "Burundi", "Cabo Verde", "Cape Verde", "Cameroon",
  "Central African Republic", "Chad", "Comoros", "Congo", "Republic of the Congo", "Democratic Republic of the Congo", "DRC",
  "Côte d'Ivoire", "Cote d'Ivoire", "Ivory Coast", "Djibouti", "Egypt", "Equatorial Guinea", "Eritrea", "Eswatini", "Swaziland",
  "Ethiopia", "Gabon", "Gambia", "The Gambia", "Ghana", "Guinea", "Guinea-Bissau", "Kenya", "Lesotho", "Liberia", "Libya",
  "Madagascar", "Malawi", "Mali", "Mauritania", "Mauritius", "Morocco", "Mozambique", "Namibia", "Niger", "Nigeria", "Rwanda",
  "São Tomé and Príncipe", "Sao Tome and Principe", "Senegal", "Seychelles", "Sierra Leone", "Somalia", "South Africa",
  "South Sudan", "Sudan", "Tanzania", "Togo", "Tunisia", "Uganda", "Zambia", "Zimbabwe",
];
const NORTH_AFRICA = ["Algeria", "Egypt", "Libya", "Morocco", "Tunisia"];
export const SUB_SAHARAN_COUNTRIES = AFRICAN_COUNTRIES.filter((c) => !NORTH_AFRICA.includes(c));
/** Francophone sub-Saharan countries (French as an official language) — used for the 2iE call. */
export const FRANCOPHONE_SSA = [
  "Benin", "Burkina Faso", "Burundi", "Cameroon", "Central African Republic", "Chad", "Comoros", "Congo", "Republic of the Congo",
  "Democratic Republic of the Congo", "DRC", "Côte d'Ivoire", "Cote d'Ivoire", "Ivory Coast", "Djibouti", "Equatorial Guinea",
  "Gabon", "Guinea", "Madagascar", "Mali", "Niger", "Rwanda", "Senegal", "Seychelles", "Togo",
];
/** Uganda + East African Community partner states. */
export const EAC_COUNTRIES = ["Uganda", "Kenya", "Tanzania", "Rwanda", "Burundi", "South Sudan", "Democratic Republic of the Congo", "DRC", "Somalia"];

/* ---------------- reusable rules ---------------- */

const africanCitizen = (src = "Key eligibility (official call)"): SeedCriterion => ({
  name: "African citizenship",
  fieldKey: "country_of_citizenship",
  operator: "in",
  requiredValue: AFRICAN_COUNTRIES,
  severity: "absolute",
  isFixable: false,
  description: "Applicants must hold the citizenship of an African country.",
  failExplanation: "This scholarship is open only to citizens of African countries.",
  recommendedAction: `Check your citizenship in your profile. ${src}.`,
});
const livesInAfrica: SeedCriterion = {
  name: "Lives in Africa",
  fieldKey: "country_of_residence",
  operator: "in",
  requiredValue: AFRICAN_COUNTRIES,
  severity: "absolute",
  isFixable: false,
  description: "Applicants must currently live in an African country.",
};
const financialNeed: SeedCriterion = {
  name: "Financial need",
  fieldKey: "demonstrates_financial_need",
  operator: "is_true",
  severity: "important",
  description: "The programme supports applicants who could not afford university without significant help.",
};
const noFirstDegree: SeedCriterion = {
  name: "No previous bachelor's degree",
  fieldKey: "education_level",
  operator: "not_in",
  requiredValue: ["undergraduate_completed", "postgraduate"],
  severity: "absolute",
  isFixable: false,
  description: "For a first undergraduate degree only.",
};
const secondaryLevel: SeedCriterion = {
  name: "Completed or completing secondary school",
  fieldKey: "education_level",
  operator: "in",
  requiredValue: ["secondary_in_progress", "secondary_completed"],
  severity: "important",
  description: "Undergraduate entry is for secondary school leavers.",
};
const hasBachelors: SeedCriterion = {
  name: "Completed bachelor's degree",
  fieldKey: "education_level",
  operator: "in",
  requiredValue: ["undergraduate_completed", "postgraduate"],
  severity: "absolute",
  isFixable: false,
  description: "A completed first degree is required for master's study.",
  recommendedAction: "If you finish your degree before the course starts, check the official page — some accept final-year students.",
};
const noMasters: SeedCriterion = {
  name: "No previous master's degree",
  fieldKey: "education_level",
  operator: "neq",
  requiredValue: "postgraduate",
  severity: "absolute",
  isFixable: false,
};
const ageMax = (max: number, name = `Age ${max} or younger`, extra?: Partial<SeedCriterion>): SeedCriterion => ({
  name,
  fieldKey: "age",
  operator: "lte",
  requiredValue: max,
  severity: "absolute",
  isFixable: false,
  ...extra,
});
const ageUnder = (limit: number): SeedCriterion => ({ name: `Under ${limit}`, fieldKey: "age", operator: "lt", requiredValue: limit, severity: "absolute", isFixable: false });
/** (age ≤ hardMax) AND (age ≤ baseMax OR refugee/displaced OR disability) */
const tieredAge = (baseMax: number, hardMax: number, key: string, withDisability = true): { groups: SeedScholarship["groups"]; criteria: SeedCriterion[] } => ({
  groups: [{ key, name: `Age ${baseMax} or younger (${hardMax} for refugees/displaced${withDisability ? "/persons with disabilities" : ""})`, logic: "or" }],
  criteria: [
    ageMax(hardMax, `Absolute age limit: ${hardMax}`, { description: `No applicant may be older than ${hardMax}.` }),
    { ...ageMax(baseMax, `Age ${baseMax} or younger`), group: key, severity: "important" },
    { name: "Refugee or displaced (extended age limit)", fieldKey: "is_refugee_or_displaced", operator: "is_true", group: key, severity: "important", isFixable: false },
    ...(withDisability ? [{ name: "Person with a disability (extended age limit)", fieldKey: "has_disability", operator: "is_true" as const, group: key, severity: "important" as const, isFixable: false }] : []),
  ],
});
const citizenOf = (countries: string[], label: string): SeedCriterion => ({
  name: `Citizenship: ${label}`,
  fieldKey: "country_of_citizenship",
  operator: "in",
  requiredValue: countries,
  severity: "absolute",
  isFixable: false,
  failExplanation: `This call is restricted to ${label}.`,
  recommendedAction: "Look at other partner institutions open to all African citizens.",
});
const customYes = (key: string, name: string, question: string, extra?: Partial<SeedCriterion>): SeedCriterion => ({
  name,
  fieldKey: `custom.${key}`,
  operator: "is_true",
  questionText: question,
  answerType: "boolean",
  severity: "important",
  ...extra,
});
const customNo = (key: string, name: string, question: string, extra?: Partial<SeedCriterion>): SeedCriterion => ({ ...customYes(key, name, question, extra), operator: "is_false" });
const gradYears = (from: number, to: number): SeedCriterion => ({
  name: `Finished secondary school ${from}–${to}`,
  fieldKey: "graduation_year",
  operator: "between",
  requiredValue: [from, to],
  severity: "absolute",
  isFixable: false,
});
const noOtherScholarship = customNo("other_scholarship", "No other scholarship", "Do you already hold another scholarship for this study?");

const TAGDEV_HOW = "Apply for admission to the university, then submit the TAGDev 2.0 scholarship application on the RUFORUM RIMS platform when the call opens.";

/* ---------------- dataset ---------------- */

export const MCF_SCHOLARSHIPS: SeedScholarship[] = [
  {
    n: 1, slug: "mcf-alu-rwanda", name: "Mastercard Foundation Scholars Program — African Leadership University (ALU)", university: "African Leadership University (ALU)", country: "Rwanda", city: "Kigali",
    category: "ug_africa", level: "undergraduate", fields: ["Software Engineering", "Entrepreneurial Leadership"], fieldsText: "Bachelor's: Software Engineering; Entrepreneurial Leadership",
    windowStatus: "open", currentWindow: "Closes 30 Nov 2026 (January 2027 intake)", nextWindow: "Not announced (next intake round)", deadline: "2026-11-30",
    keyEligibility: "African applicants; full scholarship with extra focus on women, refugees and people with disabilities. Apply to ALU and indicate interest in the scholarship.",
    howToApply: "Apply for admission to ALU and indicate your interest in the Mastercard Foundation scholarship on the application.",
    officialName: "ALU – MCF Scholars", officialUrl: "https://www.alueducation.com", applicationUrl: "https://www.alueducation.com", researchSources: "UNHCR Rwanda list; ALU page",
    criteria: [africanCitizen(), secondaryLevel],
  },
  {
    n: 2, slug: "mcf-alche-mauritius", name: "Mastercard Foundation Scholars Program — African Leadership College of Higher Education (ALCHE)", university: "African Leadership College of Higher Education (ALCHE)", country: "Mauritius",
    category: "ug_africa", level: "undergraduate", fields: ["Entrepreneurial Leadership", "Computer Science", "International Business & Trade", "Software Engineering"], fieldsText: "Bachelor's: Entrepreneurial Leadership; Computer Science; International Business & Trade; Software Engineering",
    windowStatus: "open", currentWindow: "International applicants: 14 Nov 2026 (passed). Mauritian applicants: 23 Jan 2027", nextWindow: "International round (est.): ~June 2027 — the last October-intake round closed 19 Jun 2026", deadline: "2027-01-23",
    keyEligibility: "Talented Africans facing financial barriers. Apply to ALCHE, then complete the scholarship eligibility section.",
    howToApply: "Apply through the ALCHE admissions application, then complete the scholarship eligibility section.",
    officialName: "ALCHE", officialUrl: "https://www.alueducation.com", researchSources: "Scholars4Dev (Nov 2026); June 2026 round",
    criteria: [
      africanCitizen(),
      { ...citizenOf(["Mauritius"], "Mauritian applicants for the round closing 23 Jan 2027"), name: "Current round: Mauritian applicants only", failExplanation: "The international round closed on 14 Nov 2026; only Mauritian applicants can apply in the current round.", recommendedAction: "Prepare now for the next international round, estimated around June 2027." },
      financialNeed,
    ],
  },
  {
    n: 3, slug: "mcf-ashesi-ghana", name: "Mastercard Foundation Scholars Program — Ashesi University", university: "Ashesi University", country: "Ghana", city: "Berekuso",
    category: "ug_africa", level: "undergraduate", fields: ["Business Administration", "Computer Science", "Management Information Systems", "Engineering"], fieldsText: "Bachelor's: Business Admin; Computer Science; MIS; Engineering",
    windowStatus: "open", currentWindow: "Rolling rounds closing in June, August, October and December; the December 2026 round is open", nextWindow: "Next rounds (est.): June & August 2027 (September intake)",
    keyEligibility: "African citizen; excellent academic record; financial need; leadership and community service. You are considered automatically when you apply for admission + financial aid.",
    howToApply: "Apply for admission and financial aid through Ashesi admissions — you are considered for the scholarship automatically.",
    officialName: "Ashesi admissions", officialUrl: "https://www.ashesi.edu.gh", applicationUrl: "https://www.ashesi.edu.gh", researchSources: "UNHCR Rwanda list; UNHCR – eligibility; Scholars4Dev",
    criteria: [africanCitizen(), secondaryLevel, financialNeed, customYes("leadership_service", "Leadership and community service", "Have you shown leadership or done community service (e.g. led a club, volunteered, supported your community)?")],
  },
  {
    n: 4, slug: "mcf-auc-egypt-undergraduate", name: "Mastercard Foundation Scholars Program — American University in Cairo (Undergraduate)", university: "American University in Cairo (AUC)", country: "Egypt", city: "Cairo",
    category: "ug_africa", level: "undergraduate", fields: ["Any major"], fieldsText: "Bachelor's: any major",
    windowStatus: "opens_soon", currentWindow: "Fall 2027: early deadline 1 Feb 2027; regular deadline 1 Jun 2027", nextWindow: "—", deadline: "2027-02-01",
    keyEligibility: "Live in Africa and hold an African citizenship; financial need; meet AUC admission requirements; not a transfer student. Submit the AUC application, then the separate MCF application.",
    howToApply: "Submit the AUC undergraduate application, then the separate Mastercard Foundation scholarship form.",
    officialName: "AUC – MCF Scholars", officialUrl: "https://www.aucegypt.edu", applicationUrl: "https://www.aucegypt.edu", researchSources: "AUC page; Scholars4Dev",
    criteria: [africanCitizen(), livesInAfrica, financialNeed, noFirstDegree, customNo("transfer_student", "Not a transfer student", "Are you currently studying at, or transferring from, another university?", { severity: "absolute" })],
  },
  {
    n: 5, slug: "mcf-knust-ghana", name: "Mastercard Foundation Scholars Program — Kwame Nkrumah University of Science and Technology (KNUST)", university: "Kwame Nkrumah University of Science and Technology (KNUST)", country: "Ghana", city: "Kumasi",
    category: "ug_africa", level: "undergraduate", fields: ["Engineering", "Agriculture", "Midwifery", "Mathematics", "Other fields"], fieldsText: "Bachelor's: many fields incl. engineering, agriculture, midwifery, maths",
    windowStatus: "closed", currentWindow: "Last call: Feb–30 May 2025; no 2026/27 date posted", nextWindow: "Est. ~Feb 2027 (calls usually open Feb–Mar, close May–Jun)",
    keyEligibility: "Academically talented, economically disadvantaged Africans; not enrolled in any tertiary institution; must also gain KNUST admission; priority for women, displaced people and people with disabilities. Free; form sent by courier.",
    howToApply: "Download the form from the KNUST MCF site when the call opens and send it by courier. You must also gain KNUST admission.",
    officialName: "MCF at KNUST", officialUrl: "https://www.knust.edu.gh", researchSources: "KNUST MCF site; 2025 call",
    criteria: [africanCitizen(), financialNeed, customNo("enrolled_tertiary", "Not enrolled in a tertiary institution", "Are you currently enrolled at a university, polytechnic or college?", { severity: "absolute" })],
  },
  (() => {
    const age = tieredAge(28, 32, "mak_ug_age");
    return {
      n: 6, slug: "mcf-makerere-undergraduate", name: "Mastercard Foundation Scholars Program — Makerere University (Undergraduate)", university: "Makerere University", country: "Uganda", city: "Kampala",
      category: "ug_africa" as const, level: "undergraduate" as const, fields: ["Agriculture", "Engineering", "Computing", "Health", "Law", "Business"], fieldsText: "Bachelor's: priority programmes (agriculture, engineering, computing, health, law, business…)",
      windowStatus: "closed" as const, currentWindow: "2026/27 closed 5 Jun 2026", nextWindow: "Est. Mar–Jun 2027 (the 2026 call opened ~March)",
      keyEligibility: "28 or younger (32 for refugees, IDPs, PWD); applied to Makerere main campus (private scheme); no prior degree; no other scholarship; financial need; leadership/community service.",
      howToApply: "Apply to Makerere main campus (private scheme), then apply on the Makerere MCF portal.",
      officialName: "Makerere MCF portal", officialUrl: "https://www.mak.ac.ug", researchSources: "Makerere UG call 2026/27",
      groups: age.groups,
      criteria: [...age.criteria, noFirstDegree, financialNeed, noOtherScholarship, customYes("leadership_service", "Leadership and community service", "Have you shown leadership or done community service?")],
    };
  })(),
  {
    n: 7, slug: "mcf-ugb-senegal", name: "Mastercard Foundation Scholars Program — Université Gaston Berger (UGB)", university: "Université Gaston Berger (UGB)", country: "Senegal", city: "Saint-Louis",
    category: "ug_africa", level: "undergraduate", fields: ["Digital", "Agriculture", "Health", "Engineering"], fieldsText: "Bachelor's (Licence): digital, agriculture, health, engineering",
    windowStatus: "not_announced", currentWindow: "No 2026/27 date posted; last recruitment started Feb 2025", nextWindow: "Est. early 2027 (unconfirmed)",
    keyEligibility: "Science/technical bacheliers (Senegalese and foreign) facing barriers; target of 70% women. Paper file at UGB rectorate or Dakar office.",
    howToApply: "Submit a paper application file at the UGB rectorate or the Dakar office (see the recruitment guide).",
    officialName: "MCF at UGB", officialUrl: "https://www.ugb.sn", researchSources: "UGB guide; Scholars4Dev",
    criteria: [secondaryLevel, customYes("science_bac", "Science or technical baccalaureate", "Do you hold (or are you sitting) a science or technical baccalaureate / science-based secondary qualification?", { severity: "absolute" }), financialNeed],
  },
  {
    n: 8, slug: "mcf-um6p-morocco", name: "Mastercard Foundation Scholars Program — Université Mohammed VI Polytechnique (UM6P)", university: "Université Mohammed VI Polytechnique (UM6P)", country: "Morocco", city: "Ben Guerir",
    category: "ug_africa", level: "undergraduate", fields: ["Agriculture", "Engineering", "Architecture", "Computer Science", "Data/AI"], fieldsText: "Bachelor's & Master's — young African women only: agriculture, engineering, architecture, CS, data/AI",
    windowStatus: "closed", currentWindow: "2026/27 deadlines ended June 2026", nextWindow: "Follows the UM6P admissions calendar — est. early 2027",
    keyEligibility: "Young African women; pass UM6P admission (online application + exam), then a separate scholarship application; English B2.",
    howToApply: "Apply through UM6P admissions (online application + entrance exam), then submit the separate scholarship application.",
    officialName: "MCF at UM6P", officialUrl: "https://www.um6p.ma", researchSources: "UM6P page; Scholars4Dev",
    criteria: [
      africanCitizen(),
      { name: "Young women only", fieldKey: "gender", operator: "eq", requiredValue: "female", severity: "absolute", isFixable: false, description: "This programme is for young African women." },
      customYes("english_b2", "English level B2", "Is your English at B2 level or higher (upper-intermediate)?", { severity: "important" }),
    ],
  },
  {
    n: 9, slug: "mcf-uac-benin", name: "Mastercard Foundation Scholars Program — Université d'Abomey-Calavi (UAC)", university: "Université d'Abomey-Calavi (UAC)", country: "Benin", city: "Abomey-Calavi",
    category: "ug_africa", level: "undergraduate", fields: ["Engineering (EPAC)", "Agronomy (FSA)", "Sciences (FAST)", "Computing (IFRI)", "Economics (FASEG)"], fieldsText: "Licence & Master: engineering (EPAC), agronomy (FSA), sciences (FAST), computing (IFRI), economics (FASEG)",
    windowStatus: "not_announced", currentWindow: "2026/27 call for new bacheliers (date not posted)", nextWindow: "Est. after 2027 Bac results (unconfirmed)",
    keyEligibility: "Beninese new bacheliers facing social and economic hardship.",
    howToApply: "No official online form found — application files are submitted at the programme office on campus.",
    officialName: "Foundation directory", officialUrl: "https://www.uac.bj", researchSources: "2026/27 call; Setondji",
    criteria: [citizenOf(["Benin"], "Beninese citizens"), secondaryLevel, financialNeed],
  },
  {
    n: 10, slug: "mcf-uct-south-africa", name: "Mastercard Foundation Scholars Program — University of Cape Town (UCT)", university: "University of Cape Town (UCT)", country: "South Africa", city: "Cape Town",
    category: "ug_africa", level: "undergraduate", fields: ["First bachelor's", "PG diploma", "Honours", "Coursework master's"], fieldsText: "First bachelor's (also PG diploma, honours, coursework master's)",
    windowStatus: "closed", currentWindow: "2027 intake: UG 30 Sep 2026; PG 31 Oct 2026", nextWindow: "2028 intake est. ~Aug–Sep 2027",
    keyEligibility: "African citizen (incl. South Africa); first bachelor's; academic talent; significant social/economic barriers; leadership. Apply to UCT separately; must get an offer.",
    howToApply: "Complete the MCF form and apply to UCT separately — you must receive a UCT offer.",
    officialName: "UCT MCF", officialUrl: "https://www.uct.ac.za", applicationUrl: "https://www.uct.ac.za", researchSources: "UCT page",
    criteria: [africanCitizen(), noFirstDegree, financialNeed],
  },
  {
    n: 11, slug: "mcf-up-south-africa", name: "Mastercard Foundation Scholars Program — University of Pretoria (UP)", university: "University of Pretoria (UP)", country: "South Africa", city: "Pretoria",
    category: "ug_africa", level: "undergraduate", fields: ["Natural & Agricultural Sciences", "Economic & Management Sciences", "Humanities", "EBIT", "Law", "Education"], fieldsText: "Bachelor's, Honours, Master's: Natural & Agric Sciences, EMS, Humanities, EBIT, Law, Education",
    windowStatus: "closed", currentWindow: "2027: UG 31 Aug 2026; PG 30 Sep 2026", nextWindow: "2028 applications open 1 Apr 2027",
    keyEligibility: "Apply and be admitted to UP first; academically gifted African youth facing economic/social barriers; maintain a high average.",
    howToApply: "Apply and be admitted to UP first, then use the UG or PG form on the UP MCF page.",
    officialName: "UP MCF", officialUrl: "https://www.up.ac.za", researchSources: "UP how to apply; Scholars4Dev",
    criteria: [africanCitizen(), financialNeed],
  },
  (() => {
    const age = tieredAge(28, 30, "ur_age", false);
    age.groups![0].name = "Age 28 or younger (30 for protracted circumstances)";
    age.criteria[2] = { ...age.criteria[2], name: "Refugee/displaced or protracted circumstances (extended age limit)" };
    return {
      n: 12, slug: "mcf-university-of-rwanda", name: "Mastercard Foundation Scholars Program — University of Rwanda (UR)", university: "University of Rwanda (UR)", country: "Rwanda", city: "Kigali",
      category: "ug_africa" as const, level: "undergraduate" as const, fields: ["STEM"], fieldsText: "Bachelor's (STEM focus, young women prioritised)",
      windowStatus: "closed" as const, currentWindow: "2026/27 UG closed 12 Oct 2026", nextWindow: "Est. ~Sep–Oct 2027",
      keyEligibility: "Rwandan or any African citizen, refugee or displaced youth; 28 or younger (30 for protracted circumstances); meet UR admission; leadership & community engagement; refugees/PWD need proof of status.",
      howToApply: "Apply on the University of Rwanda recruitment portal when the call opens.",
      officialName: "MCF at UR", officialUrl: "https://ur.ac.rw", researchSources: "2026/27 UG call",
      groups: [...age.groups!, { key: "ur_cit", name: "African citizen, refugee or displaced youth", logic: "or" as const }],
      criteria: [
        ...age.criteria,
        { ...africanCitizen(), group: "ur_cit", severity: "important" as const },
        { name: "Refugee or displaced youth", fieldKey: "is_refugee_or_displaced", operator: "is_true" as const, group: "ur_cit", severity: "important" as const, isFixable: false },
        secondaryLevel,
        customYes("leadership_service", "Leadership & community engagement", "Have you shown leadership or community engagement?"),
      ],
      requirements: [{ category: "identification", name: "Proof of refugee or disability status (if applicable)", isRequired: false }],
    };
  })(),
  {
    n: 13, slug: "mcf-uwc-south-africa", name: "Mastercard Foundation Scholars Program — University of the Western Cape (UWC)", university: "University of the Western Cape (UWC)", country: "South Africa", city: "Cape Town",
    category: "ug_africa", level: "undergraduate", fields: ["Humanities", "Economics", "Sciences", "Education"], fieldsText: "Bachelor's & Master's (humanities, economics, sciences, education…)",
    windowStatus: "paused", currentWindow: "\"Not accepting applications until further notice\"", nextWindow: "Not announced",
    keyEligibility: "Apply to UWC first; second undergraduate/master's degree not eligible; evidence of social and economic barriers.",
    howToApply: "Applications are paused. When they reopen: apply to UWC first, then to the scholarship.",
    officialName: "UWC MCF", officialUrl: "https://www.uwc.ac.za", researchSources: "UWC page",
    criteria: [noFirstDegree, financialNeed],
  },
  (() => {
    const age = tieredAge(29, 32, "usiu_age");
    return {
      n: 14, slug: "mcf-usiu-africa-kenya", name: "Mastercard Foundation Scholars Program — United States International University-Africa (USIU-Africa)", university: "United States International University-Africa (USIU-Africa)", country: "Kenya", city: "Nairobi",
      category: "ug_africa" as const, level: "undergraduate" as const, fields: ["Software Engineering", "Data Science", "Pharmacy", "Finance", "International Relations", "Psychology"], fieldsText: "Bachelor's: 13 programmes incl. Software Eng., Data Science, Pharmacy, Finance, IR, Psychology",
      windowStatus: "closed" as const, currentWindow: "No open call (Nov 2026)", nextWindow: "Est. Feb–Mar 2027 for the Sept 2027 intake (calls run Oct–Nov for May, Feb–Mar for Sept)",
      keyEligibility: "29 or younger (32 for refugees/PWD); first-time undergraduate from Africa (no diploma holders); min. C+; socio-economic barriers; leadership & give-back. Apply by email when a call is open.",
      howToApply: "When a call is open, email the completed form to mcfsp-applications@usiu.ac.ke.",
      officialName: "USIU MCF", officialUrl: "https://www.usiu.ac.ke", contactEmail: "mcfsp-applications@usiu.ac.ke", researchSources: "USIU page",
      groups: age.groups,
      criteria: [
        ...age.criteria,
        africanCitizen(),
        noFirstDegree,
        customNo("diploma_holder", "Not a diploma holder", "Do you already hold a post-secondary diploma?", { severity: "absolute" }),
        customYes("min_c_plus", "Minimum mean grade C+", "Is your secondary-school mean grade C+ or better (or the equivalent)?", { severity: "absolute" }),
        financialNeed,
      ],
    };
  })(),
  {
    n: 15, slug: "mcf-2ie-burkina-faso", name: "Mastercard Foundation Scholars Program — 2iE (International Institute for Water and Environmental Engineering)", university: "2iE – International Institute for Water and Environmental Engineering", country: "Burkina Faso", city: "Ouagadougou",
    category: "ug_africa", level: "undergraduate", fields: ["Engineering (Bachelor Centrale-2iE)", "Infrastructure (online Bachelor BGIS)", "Specialised master's"], fieldsText: "Bachelor Centrale-2iE (engineering); online Bachelor BGIS (infrastructure); specialised master's",
    windowStatus: "closed", currentWindow: "2026/27 calls closed 31 Aug 2026", nextWindow: "Est. ~Jun–Aug 2027",
    keyEligibility: "Nationals of francophone sub-Saharan countries from disadvantaged backgrounds; priority for women, PWD, refugees, IDPs; not already studying at 2iE.",
    howToApply: "Apply on the 2iE application platform when the call opens.",
    officialName: "2iE", officialUrl: "https://www.2ie-edu.org", researchSources: "2026 Bachelor call; BGIS call",
    criteria: [citizenOf(FRANCOPHONE_SSA, "nationals of francophone sub-Saharan countries"), financialNeed, customNo("studying_2ie", "Not already studying at 2iE", "Are you already studying at 2iE?", { severity: "absolute" })],
  },
  {
    n: 16, slug: "mcf-tagdev-gulu-university", name: "Mastercard Foundation TAGDev 2.0 — Gulu University", university: "Gulu University", country: "Uganda", city: "Gulu",
    category: "ug_africa", level: "undergraduate", fields: ["Food Bioscience & Agribusiness", "Environmental Science & NRM", "ICT", "Quantitative Economics"], fieldsText: "BSc Food Bioscience & Agribusiness; Env. Science & NRM; ICT; Quantitative Economics",
    windowStatus: "closed", currentWindow: "2026/27 closed 1 May 2026", nextWindow: "Est. Mar–May 2027 (TAGDev calls open ~March)",
    keyEligibility: "Ugandan or East African Protocol national; under 30; economically disadvantaged/conflict-affected; interest in agriculture & entrepreneurship; no other scholarship.",
    howToApply: "Apply for Gulu University admission and submit the scholarship application on RUFORUM RIMS.",
    officialName: "Gulu TAGDev call", officialUrl: "https://gu.ac.ug", researchSources: "Gulu call PDF",
    criteria: [citizenOf(EAC_COUNTRIES, "Ugandan or East African Community nationals"), ageUnder(30), financialNeed, noOtherScholarship, customYes("agri_interest", "Interest in agriculture & entrepreneurship", "Are you interested in agriculture and entrepreneurship?")],
  },
  {
    n: 17, slug: "mcf-tagdev-egerton-university", name: "Mastercard Foundation TAGDev 2.0 — Egerton University", university: "Egerton University", country: "Kenya", city: "Njoro",
    category: "ug_africa", level: "undergraduate", fields: ["Agriculture", "Natural Resources Management", "Animal Science"], fieldsText: "BSc Agriculture; Natural Resources Mgmt; Animal Science",
    windowStatus: "closed", currentWindow: "2026/27 closed 1 May 2026", nextWindow: "Est. Mar–May 2027",
    keyEligibility: "Economically disadvantaged; meet Egerton admission; TAGDev standard rules (under 30 for UG; no other scholarship). Check the call for nationality rules.",
    howToApply: TAGDEV_HOW,
    officialName: "Egerton TAGDev", officialUrl: "https://www.egerton.ac.ke", researchSources: "Egerton 2026 call; programmes",
    criteria: [ageUnder(30), financialNeed, noOtherScholarship],
  },
  {
    n: 18, slug: "mcf-tagdev-university-of-cape-coast", name: "Mastercard Foundation TAGDev 2.0 — University of Cape Coast", university: "University of Cape Coast (UCC)", country: "Ghana", city: "Cape Coast",
    category: "ug_africa", level: "undergraduate", fields: ["Agriculture", "Agricultural Extension & Community Development", "Agribusiness", "Horticulture"], fieldsText: "BSc Agriculture; Ag. Extension & Community Dev.; Agribusiness; Horticulture",
    windowStatus: "closed", currentWindow: "2026/27 closed 1 May 2026", nextWindow: "Est. Mar–May 2027",
    keyEligibility: "Ghanaian nationals or refugees resident in Ghana; under 30; secondary school completed 2022–2025; economically disadvantaged.",
    howToApply: TAGDEV_HOW,
    officialName: "UCC TAGDev", officialUrl: "https://ucc.edu.gh", researchSources: "UCC call PDF",
    groups: [{ key: "ucc_cit", name: "Ghanaian national, or refugee resident in Ghana", logic: "or" }],
    criteria: [
      { ...citizenOf(["Ghana"], "Ghanaian nationals"), group: "ucc_cit" },
      { name: "Refugee resident in Ghana", fieldKey: "is_refugee_or_displaced", operator: "is_true", group: "ucc_cit", severity: "absolute", isFixable: false },
      ageUnder(30), gradYears(2022, 2025), financialNeed,
    ],
  },
  {
    n: 19, slug: "mcf-tagdev-africa-university", name: "Mastercard Foundation TAGDev 2.0 — Africa University", university: "Africa University", country: "Zimbabwe", city: "Mutare",
    category: "ug_africa", level: "undergraduate", fields: ["Agribusiness Management", "Software Engineering"], fieldsText: "BSc Agribusiness Management; BSc Software Engineering",
    windowStatus: "closed", currentWindow: "2026/27 closed 1 May 2026", nextWindow: "Est. Mar–May 2027",
    keyEligibility: "African national living in Africa; under 30; secondary/diploma completed 2022–2025; economically disadvantaged; no other scholarship.",
    howToApply: TAGDEV_HOW,
    officialName: "Africa University", officialUrl: "https://africau.edu", researchSources: "Africa University call PDF",
    criteria: [africanCitizen(), livesInAfrica, ageUnder(30), gradYears(2022, 2025), financialNeed, noOtherScholarship],
  },
  {
    n: 20, slug: "mcf-tagdev-una-benin", name: "Mastercard Foundation TAGDev 2.0 — National University of Agriculture (UNA)", university: "National University of Agriculture (UNA)", country: "Benin", city: "Porto-Novo",
    category: "ug_africa", level: "undergraduate", fields: ["Agro-processing", "Animal production", "Agribusiness", "Horticulture", "Agro-equipment", "Extension"], fieldsText: "Licence: agro-processing, animal production, agribusiness, horticulture, agro-equipment, extension",
    windowStatus: "closed", currentWindow: "2026/27 closed 1 May 2026", nextWindow: "Est. Mar–May 2027",
    keyEligibility: "Beninese candidates from disadvantaged areas (conflict-area residents in Benin encouraged); under 25 for Licence; science Bac (C or D).",
    howToApply: TAGDEV_HOW,
    officialName: "UNA", officialUrl: "https://www.ruforum.org", researchSources: "UNA call PDF (FR)",
    criteria: [citizenOf(["Benin"], "Beninese candidates"), ageUnder(25), customYes("science_bac_cd", "Science baccalaureate (series C or D)", "Do you hold a science baccalaureate, series C or D?", { severity: "absolute" }), financialNeed],
  },
  {
    n: 21, slug: "mcf-earth-university-costa-rica", name: "Mastercard Foundation Scholars Program — EARTH University", university: "EARTH University", country: "Costa Rica", city: "Guácimo",
    category: "ug_outside_africa", level: "undergraduate", fields: ["Agricultural Sciences"], fieldsText: "Bachelor's: Agricultural Sciences (4 years)",
    windowStatus: "open", currentWindow: "Open until 31 Jan 2027", nextWindow: "—", deadline: "2027-01-31",
    keyEligibility: "Resident and graduating secondary student of a sub-Saharan African country; English requirements; admissions tests, interview and socio-economic study.",
    howToApply: "Apply through EARTH admissions: application, admissions tests, interview and a socio-economic study.",
    officialName: "EARTH – Foundation page", officialUrl: "https://www.earth.ac.cr", applicationUrl: "https://www.earth.ac.cr", researchSources: "Scholars4Dev; last cycle",
    criteria: [
      { ...livesInAfrica, name: "Resident of a sub-Saharan African country", requiredValue: SUB_SAHARAN_COUNTRIES, description: "Applicants must live in a sub-Saharan African country." },
      secondaryLevel,
      customYes("english_requirement", "Meets English requirements", "Can you meet EARTH's English language requirements?"),
    ],
  },
  {
    n: 22, slug: "mcf-aub-lebanon", name: "Mastercard Foundation Scholars Program — American University of Beirut (AUB)", university: "American University of Beirut (AUB)", country: "Lebanon", city: "Beirut",
    category: "ug_outside_africa", level: "undergraduate", fields: ["Health Sciences"], fieldsText: "Bachelor's & Master's (Faculty of Health Sciences focus)",
    windowStatus: "not_announced", currentWindow: "Last UG call closed 6 Nov 2025; 2026/27 master's closed 26 Mar 2026", nextWindow: "2027/28 not announced — the last UG call opened ~October",
    keyEligibility: "35 or younger; English proof (RUSE: TOEFL, IELTS, Duolingo…); leadership; commit to all programme workshops.",
    howToApply: "Watch the AUB MCF page for the next call.",
    officialName: "AUB MCF", officialUrl: "https://www.aub.edu.lb", researchSources: "2025/26 call; Scholars4Dev",
    criteria: [ageMax(35), customYes("english_proof", "English proficiency proof", "Can you provide English proficiency proof (TOEFL, IELTS, Duolingo or similar)?")],
  },
  {
    n: 23, slug: "mcf-queens-university-canada", name: "Mastercard Foundation Scholars Program — Queen's University", university: "Queen's University", country: "Canada", city: "Kingston",
    category: "ug_outside_africa", level: "undergraduate", fields: ["Bachelor's"], fieldsText: "Bachelor's",
    windowStatus: "closed", currentWindow: "Listed as closed by the Foundation", nextWindow: "Not announced",
    keyEligibility: "Not posted.",
    howToApply: "Not posted — check the Mastercard Foundation page for updates.",
    officialName: "Foundation page", officialUrl: "https://mastercardfdn.org", researchSources: "Foundation page",
    criteria: [],
  },
  {
    n: 24, slug: "mcf-tagdev-uganda-martyrs-university", name: "Mastercard Foundation TAGDev 2.0 — Uganda Martyrs University", university: "Uganda Martyrs University (UMU)", country: "Uganda", city: "Nkozi",
    category: "ug_extra_africa", level: "undergraduate", fields: ["Agricultural Economics & Management"], fieldsText: "BSc Agricultural Economics & Management",
    windowStatus: "closed", currentWindow: "2026/27 closed 1 May 2026", nextWindow: "Est. Mar–May 2027",
    keyEligibility: "Ugandan or East African Protocol national; under 30; secondary/diploma 2021–2024; economically disadvantaged.",
    howToApply: TAGDEV_HOW,
    officialName: "UMU", officialUrl: "https://umu.ac.ug", researchSources: "UMU call PDF",
    criteria: [citizenOf(EAC_COUNTRIES, "Ugandan or East African Community nationals"), ageUnder(30), gradYears(2021, 2024), financialNeed],
  },
  {
    n: 25, slug: "mcf-tagdev-must-malawi", name: "Mastercard Foundation TAGDev 2.0 — Malawi University of Science and Technology", university: "Malawi University of Science and Technology (MUST)", country: "Malawi", city: "Thyolo",
    category: "ug_extra_africa", level: "undergraduate", fields: ["Food Science & Technology"], fieldsText: "BSc Food Science & Technology",
    windowStatus: "closed", currentWindow: "2026/27 closed 1 May 2026", nextWindow: "Est. Mar–May 2027",
    keyEligibility: "Malawian nationals and refugees/displaced people resident in Malawi; economically disadvantaged.",
    howToApply: "Follow the MUST call PDF when the next call opens.",
    officialName: "MUST", officialUrl: "https://www.must.ac.mw", researchSources: "MUST call PDF; ScholarDigger",
    groups: [{ key: "must_cit", name: "Malawian national, or refugee/displaced person resident in Malawi", logic: "or" }],
    criteria: [
      { ...citizenOf(["Malawi"], "Malawian nationals"), group: "must_cit" },
      { name: "Refugee or displaced person resident in Malawi", fieldKey: "is_refugee_or_displaced", operator: "is_true", group: "must_cit", severity: "absolute", isFixable: false },
      financialNeed,
    ],
  },
  {
    n: 26, slug: "mcf-cmu-africa-rwanda", name: "Mastercard Foundation Scholars Program — Carnegie Mellon University Africa (CMU-Africa)", university: "Carnegie Mellon University Africa (CMU-Africa)", country: "Rwanda", city: "Kigali",
    category: "pg_africa", level: "masters", fields: ["MS Information Technology", "MS Electrical & Computer Engineering", "MS Engineering Artificial Intelligence"], fieldsText: "Master's: MS IT; MS Electrical & Computer Eng.; MS Engineering AI",
    windowStatus: "open", currentWindow: "Early deadline 15 Dec 2026 (test-fee cover); final deadline 15 Jan 2027", nextWindow: "—", deadline: "2027-01-15",
    keyEligibility: "African citizen; admitted to an eligible CMU-Africa master's; social/economic barriers; academic talent, commitment to giving back, leadership potential.",
    howToApply: "Apply to an eligible CMU-Africa master's programme; apply by 15 Dec 2026 to have test fees covered.",
    officialName: "CMU-Africa MCF", officialUrl: "https://www.africa.engineering.cmu.edu", applicationUrl: "https://www.africa.engineering.cmu.edu", researchSources: "CMU-Africa page; Scholars4Dev",
    criteria: [africanCitizen(), hasBachelors, financialNeed],
  },
  {
    n: 27, slug: "mcf-auc-egypt-masters", name: "Mastercard Foundation Scholars Program — American University in Cairo (Master's)", university: "American University in Cairo (AUC)", country: "Egypt", city: "Cairo",
    category: "pg_africa", level: "masters", fields: ["Any graduate field"], fieldsText: "Master's: any graduate field (starting Spring 2027)",
    windowStatus: "opens_soon", currentWindow: "22 Dec 2026 – 17 Jan 2027; then 6 Apr – 6 May 2027", nextWindow: "—", deadline: "2027-01-17",
    keyEligibility: "Live in Africa + African citizenship; 35 or younger; bachelor's GPA 3.2/4.0 or equivalent; financial need; meet AUC graduate admission; not a transfer student.",
    howToApply: "Submit the AUC graduate application, then the separate Mastercard Foundation form.",
    officialName: "AUC – MCF Scholars", officialUrl: "https://www.aucegypt.edu", applicationUrl: "https://www.aucegypt.edu", researchSources: "AUC page; Scholars4Dev",
    criteria: [
      africanCitizen(), livesInAfrica, ageMax(35), hasBachelors, financialNeed,
      customYes("gpa_32", "Bachelor's GPA 3.2/4.0 or equivalent", "Is your bachelor's GPA at least 3.2 out of 4.0 (or the equivalent, e.g. Second Class Upper)?", { severity: "absolute" }),
      customNo("transfer_student", "Not a transfer student", "Are you transferring from another graduate programme?", { severity: "absolute" }),
    ],
  },
  {
    n: 28, slug: "mcf-aims-rwanda", name: "Mastercard Foundation Scholars Program — AIMS Rwanda", university: "AIMS Rwanda (African Institute for Mathematical Sciences)", country: "Rwanda", city: "Kigali",
    category: "pg_africa", level: "masters", fields: ["Mathematical Sciences", "Big data", "Computer security", "Financial mathematics"], fieldsText: "Master's in Mathematical Sciences (structured or co-op: big data, computer security, financial maths)",
    windowStatus: "not_announced", currentWindow: "2026/27 round closed (last AIMS network deadline 15 Mar 2026)", nextWindow: "Est. Dec 2026 – Mar 2027 (AIMS calls usually open ~1 Dec)",
    keyEligibility: "Nationals of African countries; strong bachelor's in maths, science or engineering; women strongly encouraged. Full bursary for admitted students.",
    howToApply: "Apply through the AIMS network application when it opens (MCF at AIMS).",
    officialName: "AIMS Rwanda", officialUrl: "https://aims.ac.rw", researchSources: "AIMS–NEI MCF page; Scholars4Dev; deadline record",
    criteria: [africanCitizen(), hasBachelors, customYes("stem_degree", "Bachelor's in maths, science or engineering", "Is your bachelor's degree in mathematics, a science or engineering?", { severity: "absolute" })],
  },
  {
    n: 29, slug: "mcf-ughe-rwanda", name: "Mastercard Foundation Scholars Program — University of Global Health Equity (UGHE)", university: "University of Global Health Equity (UGHE)", country: "Rwanda", city: "Butaro",
    category: "pg_africa", level: "masters", fields: ["MSc Global Health Delivery"], fieldsText: "MSc Global Health Delivery",
    windowStatus: "not_announced", currentWindow: "Last window: 14 Nov 2025 – 18 Jan 2026", nextWindow: "Est. Nov 2026 – Jan 2027 (Class of 2028 call not yet seen)",
    keyEligibility: "35 or younger (exceptions for disability); resident & citizen of, or refugee in, an African country; completed bachelor's; no master's degree; full-time.",
    howToApply: "Use the UGHE online form when the next call opens.",
    officialName: "UGHE", officialUrl: "https://ughe.org", researchSources: "UGHE MGHD call PDF",
    groups: [{ key: "ughe_age", name: "35 or younger (exceptions for disability)", logic: "or" }, { key: "ughe_cit", name: "African citizen, or refugee in an African country", logic: "or" }],
    criteria: [
      { ...ageMax(35), group: "ughe_age", severity: "important" },
      { name: "Person with a disability (age exception)", fieldKey: "has_disability", operator: "is_true", group: "ughe_age", severity: "important", isFixable: false },
      { ...africanCitizen(), group: "ughe_cit", severity: "important" },
      { name: "Refugee in an African country", fieldKey: "is_refugee_or_displaced", operator: "is_true", group: "ughe_cit", severity: "important", isFixable: false },
      livesInAfrica, hasBachelors, noMasters,
    ],
  },
  (() => {
    const age = tieredAge(35, 40, "mak_pg_age");
    return {
      n: 30, slug: "mcf-makerere-masters", name: "Mastercard Foundation Scholars Program — Makerere University (Master's)", university: "Makerere University", country: "Uganda", city: "Kampala",
      category: "pg_africa" as const, level: "masters" as const, fields: ["Priority master's programmes"], fieldsText: "Master's: priority programmes (13 places in 2026/27)",
      windowStatus: "closed" as const, currentWindow: "2026/27 closed 5 Jun 2026", nextWindow: "Est. Mar–Jun 2027",
      keyEligibility: "35 or younger (40 for refugees, IDPs, PWD); completed undergraduate studies in Africa; no master's started/completed; applied to Makerere; financial need; no other scholarship.",
      howToApply: "Apply to a Makerere master's programme, then apply on the Makerere MCF portal.",
      officialName: "Makerere MCF portal", officialUrl: "https://www.mak.ac.ug", researchSources: "Makerere master's call",
      groups: age.groups,
      criteria: [...age.criteria, hasBachelors, noMasters, customYes("degree_in_africa", "Undergraduate studies completed in Africa", "Did you complete your undergraduate degree at an institution in Africa?", { severity: "absolute" }), financialNeed, noOtherScholarship],
    };
  })(),
  {
    n: 31, slug: "mcf-university-of-cambridge", name: "Mastercard Foundation Scholars Program — University of Cambridge", university: "University of Cambridge", country: "United Kingdom", city: "Cambridge",
    category: "pg_outside_africa", level: "masters", fields: ["One-year postgraduate courses (not MBA, MFin, MAcc, MCL)"], fieldsText: "Any full-time one-year postgraduate course (not MBA, MFin, MAcc, MCL)",
    windowStatus: "open", currentWindow: "Your course's funding deadline: early Dec 2026 or early Jan 2027", nextWindow: "—",
    keyEligibility: "African citizen and resident; first-class degree for most courses (some accept a good 2:1); commitment to climate resilience/sustainability and giving back.",
    howToApply: "Apply to an eligible Cambridge course by its funding deadline (check your course page).",
    officialName: "Cambridge MCF", officialUrl: "https://www.cam.ac.uk", applicationUrl: "https://www.cam.ac.uk", researchSources: "Cambridge eligibility; Scholars4Dev",
    criteria: [africanCitizen(), livesInAfrica, hasBachelors, customYes("first_class", "First-class degree (or good 2:1 for some courses)", "Do you have (or expect) a first-class degree, or a strong 2:1 if your course accepts it?", { severity: "important" }), customYes("climate_commitment", "Commitment to climate resilience & giving back", "Can you show commitment to climate resilience/sustainability and to giving back to your community?")],
  },
  {
    n: 32, slug: "mcf-sciences-po-france", name: "Mastercard Foundation Scholars Program — Sciences Po", university: "Sciences Po", country: "France", city: "Paris",
    category: "pg_outside_africa", level: "masters", fields: ["Two-year master's programmes"], fieldsText: "Two-year master's only (no dual degrees, one-year master's or journalism)",
    windowStatus: "open", currentWindow: "Final deadline 14 Dec 2026 (23 Nov round passed); results April 2027", nextWindow: "—", deadline: "2026-12-14",
    keyEligibility: "African citizen with no non-African second citizenship; under 35 on 1 Sep 2027; apply through the single Sciences Po master's + MCF procedure.",
    howToApply: "Apply through the Sciences Po graduate admission platform (single master's + MCF procedure).",
    officialName: "Sciences Po MCF", officialUrl: "https://www.sciencespo.fr", applicationUrl: "https://www.sciencespo.fr", researchSources: "Sciences Po 2027 call; Scholars4Dev",
    criteria: [
      africanCitizen(), hasBachelors,
      customNo("non_african_citizenship", "No non-African second citizenship", "Do you hold a second citizenship from a country outside Africa?", { severity: "absolute", isFixable: false }),
      customYes("under_35_sep_2027", "Under 35 on 1 September 2027", "Will you be younger than 35 on 1 September 2027?", { severity: "absolute", isFixable: false }),
    ],
  },
  {
    n: 33, slug: "mcf-uc-berkeley", name: "Mastercard Foundation Scholars Program — University of California, Berkeley", university: "University of California, Berkeley", country: "United States", city: "Berkeley",
    category: "pg_outside_africa", level: "masters", fields: ["Engineering", "Design", "Public Policy", "Journalism", "LLM", "Development Practice"], fieldsText: "Master's (two years or less): engineering, design, public policy, journalism, LLM, development practice and more",
    windowStatus: "open", currentWindow: "Most programme deadlines in December 2026; first admission round only", nextWindow: "Recruits through fall 2028",
    keyEligibility: "Apply to an eligible master's in its first round; admitted applicants are then nominated. Undergraduates not eligible.",
    howToApply: "Apply to an eligible Berkeley master's in its first admission round; admitted applicants are nominated for the scholarship.",
    officialName: "Berkeley MCF", officialUrl: "https://www.berkeley.edu", applicationUrl: "https://www.berkeley.edu", researchSources: "Berkeley apply page; Scholars4Dev",
    criteria: [hasBachelors],
  },
  {
    n: 34, slug: "mcf-university-of-oxford", name: "Mastercard Foundation Scholars Program — University of Oxford (AfOx)", university: "University of Oxford", country: "United Kingdom", city: "Oxford",
    category: "pg_outside_africa", level: "masters", fields: ["Food systems", "Health", "Water & energy", "Governance", "Entrepreneurship"], fieldsText: "One-year taught master's (food systems, health, water & energy, governance, entrepreneurship)",
    windowStatus: "open", currentWindow: "Your course's main Dec/Jan funding deadline (reported ~6 Jan 2027)", nextWindow: "—", deadline: "2027-01-06",
    keyEligibility: "African nationality and residence; apply to Oxford by the funding deadline; conditional-offer holders are invited to the AfOx scholarship application and interview.",
    howToApply: "Apply to Oxford graduate admissions by your course's funding deadline; conditional-offer holders are invited to the AfOx scholarship application and interview.",
    officialName: "Oxford MCF (AfOx)", officialUrl: "https://www.ox.ac.uk", applicationUrl: "https://www.ox.ac.uk", researchSources: "AfOx page; 2027/28 deadline",
    criteria: [africanCitizen(), livesInAfrica, hasBachelors],
  },
  {
    n: 35, slug: "mcf-university-of-edinburgh", name: "Mastercard Foundation Scholars Program — University of Edinburgh", university: "University of Edinburgh", country: "United Kingdom", city: "Edinburgh",
    category: "pg_outside_africa", level: "masters", fields: ["Sustainability-focused master's (on-campus & online)", "Online PG diplomas"], fieldsText: "Sustainability-focused master's (on-campus & online) and online PG diplomas",
    windowStatus: "closed", currentWindow: "2027/28: info session (15–24 Sep 2026) required; documents by 19 Nov 2026", nextWindow: "2028/29 est. info sessions ~Sep 2027",
    keyEligibility: "Resident and citizen of, or refugee in, an African country; 2:1 or higher; born on/after 1 Jan 1992 (2027/28); no prior postgraduate degree; leadership; climate ambition.",
    howToApply: "Attend a required information session, then submit documents by the deadline (see Edinburgh eligibility).",
    officialName: "Edinburgh MCF", officialUrl: "https://www.ed.ac.uk", researchSources: "Edinburgh eligibility; process change",
    groups: [{ key: "ed_cit", name: "African citizen, or refugee in an African country", logic: "or" }],
    criteria: [
      { ...africanCitizen(), group: "ed_cit", severity: "important" },
      { name: "Refugee in an African country", fieldKey: "is_refugee_or_displaced", operator: "is_true", group: "ed_cit", severity: "important", isFixable: false },
      livesInAfrica,
      { name: "Born on or after 1 January 1992 (2027/28)", fieldKey: "date_of_birth", operator: "gte", requiredValue: "1992-01-01", severity: "absolute", isFixable: false },
      hasBachelors, noMasters,
      customYes("two_one", "2:1 degree or higher", "Do you have a 2:1 (Second Class Upper) degree or higher?", { severity: "absolute" }),
    ],
  },
];

/* ---------------- document checklists ---------------- */

export const OFFICIAL_DOCS_NOTE = "Visit the official page for full and up-to-date information on the application documents.";

/** Undergraduate checklist (based on the ALU Rwanda / ALCHE Mauritius requirements for Nigerian applicants). */
export function undergraduateDocuments(country: string): SeedRequirement[] {
  return [
    { section: "admission", category: "academic_transcript", name: "Grade 10–12 results", description: "Your senior secondary results for Grades 10, 11 and 12 (SS1–SS3)." },
    { section: "admission", category: "certificate", name: "WAEC result (notarised by a lawyer)", description: "Your WASSCE result, certified/notarised by a lawyer." },
    { section: "admission", category: "identification", name: "NIN (National Identification Number)", description: "NIN slip or card." },
    { section: "admission", category: "identification", name: "Birth certificate" },
    { section: "admission", category: "passport", name: "International passport", description: "Data page of a valid international passport." },
    ...(country === "Rwanda"
      ? [{ section: "admission" as const, category: "certificate", name: "Equivalence certificate (Rwanda)", description: "Rwandan equivalence certificate for your secondary-school qualification." }]
      : []),
    { section: "admission", category: "other", name: "Police character certificate" },
    { section: "admission", category: "recommendation_letter", name: "Recommendation letter 1 (at least 250 words)", description: "Request it from a teacher or mentor through the Referees page." },
    { section: "admission", category: "recommendation_letter", name: "Recommendation letter 2 (at least 250 words)", description: "A second letter from a different referee." },
    { section: "scholarship", category: "financial_documentation", name: "Sponsor's bank statement" },
    { section: "scholarship", category: "financial_documentation", name: "High school fees receipts" },
    { section: "scholarship", category: "financial_documentation", name: "Sponsor's job declaration document", description: "A document stating your sponsor's employment or occupation." },
    { section: "scholarship", category: "recommendation_letter", name: "Recommendation letters for the scholarship application", description: "Usually the same two letters as your admission application.", isRequired: false },
    { section: "scholarship", category: "essay", name: "Essay (500 words)", description: "Draft it in the Essays workspace, then upload the final version as PDF or Word." },
    { section: "scholarship", category: "other", name: "5-minute video", description: "Video files can't be uploaded here — upload a PDF or Word file with the link to your video." },
  ];
}

/** Master's checklist. */
export const MASTERS_DOCUMENTS: SeedRequirement[] = [
  { section: "admission", category: "essay", name: "Leadership essay", description: "Draft it in the Essays workspace, then upload the final version as PDF or Word." },
  { section: "admission", category: "essay", name: "Statement of purpose (SOP)", description: "Draft it in the Essays workspace, then upload the final version as PDF or Word." },
  { section: "admission", category: "cv", name: "CV" },
  { section: "admission", category: "academic_transcript", name: "First-degree transcript" },
];

export function documentsFor(s: SeedScholarship): SeedRequirement[] {
  const base = s.level === "masters" ? MASTERS_DOCUMENTS : undergraduateDocuments(s.country);
  return [...base, ...(s.requirements ?? [])];
}
