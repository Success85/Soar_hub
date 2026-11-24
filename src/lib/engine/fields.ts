/**
 * Catalogue of applicant data points that eligibility criteria may reference.
 *
 * This is NOT scholarship logic: it only describes *where* a value comes from, how to
 * ask for it, and how sensitive it is. Which fields a scholarship checks, with which
 * operator and which required value, lives entirely in the database
 * (scholarship_criteria) and is configured by administrators.
 */
export type FieldType = "number" | "string" | "boolean" | "date" | "enum" | "string_list";

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldDefinition {
  key: string;
  label: string;
  type: FieldType;
  /** profile column (camelCase) the value is read from, if any */
  profileKey?: string;
  /** derived fields are computed; they are asked via `askVia` */
  derived?: boolean;
  askVia?: string;
  question: string;
  help?: string;
  why: string;
  options?: FieldOption[];
  sensitive: boolean;
  /** whether the applicant can supply the value via a question (false: e.g. uploaded documents) */
  askable: boolean;
  group: "personal" | "location" | "academic" | "background" | "programme" | "documents";
}

export const EDUCATION_LEVELS: FieldOption[] = [
  { value: "secondary_in_progress", label: "Currently in secondary school (SS1–SS3)" },
  { value: "secondary_completed", label: "Completed secondary school" },
  { value: "undergraduate_in_progress", label: "Currently in university/polytechnic" },
  { value: "undergraduate_completed", label: "Completed a first degree" },
  { value: "postgraduate", label: "Postgraduate study" },
  { value: "other", label: "Other" },
];

export const INCOME_BANDS: FieldOption[] = [
  { value: "very_low", label: "Very low (household struggles to meet basic needs)" },
  { value: "low", label: "Low" },
  { value: "lower_middle", label: "Lower-middle" },
  { value: "middle", label: "Middle" },
  { value: "upper", label: "Upper" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

export const EMPLOYMENT_STATUSES: FieldOption[] = [
  { value: "student", label: "Student" },
  { value: "unemployed", label: "Not currently employed" },
  { value: "employed_part_time", label: "Employed part-time" },
  { value: "employed_full_time", label: "Employed full-time" },
  { value: "self_employed", label: "Self-employed" },
  { value: "other", label: "Other" },
];

export const QUALIFICATIONS: FieldOption[] = [
  { value: "WASSCE", label: "WASSCE (WAEC)" },
  { value: "NECO", label: "NECO SSCE" },
  { value: "GCE", label: "GCE O-Level" },
  { value: "UTME", label: "JAMB UTME" },
  { value: "A_LEVEL", label: "A-Levels" },
  { value: "IB", label: "International Baccalaureate" },
  { value: "SAT", label: "SAT" },
  { value: "OND", label: "OND / National Diploma" },
  { value: "OTHER", label: "Other" },
];

export const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta",
  "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi",
  "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto",
  "Taraba", "Yobe", "Zamfara",
];

export const GENDERS: FieldOption[] = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "non_binary", label: "Non-binary" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

export const DOCUMENT_CATEGORIES: FieldOption[] = [
  { value: "academic_transcript", label: "Academic transcript" },
  { value: "certificate", label: "Certificate" },
  { value: "cv", label: "CV / Résumé" },
  { value: "passport", label: "Passport" },
  { value: "identification", label: "Identification" },
  { value: "essay", label: "Essay" },
  { value: "recommendation_letter", label: "Recommendation letter" },
  { value: "financial_documentation", label: "Financial documentation" },
  { value: "other", label: "Other" },
];

export const FIELDS: FieldDefinition[] = [
  {
    key: "age",
    label: "Age",
    type: "number",
    derived: true,
    askVia: "date_of_birth",
    question: "What is your date of birth?",
    why: "Many scholarships have an age limit. We calculate your age from your date of birth.",
    sensitive: false,
    askable: true,
    group: "personal",
  },
  {
    key: "age_at_deadline",
    label: "Age at the application deadline",
    type: "number",
    derived: true,
    askVia: "date_of_birth",
    question: "What is your date of birth?",
    why: "Some scholarships measure age on the application deadline.",
    sensitive: false,
    askable: true,
    group: "personal",
  },
  {
    key: "date_of_birth",
    label: "Date of birth",
    type: "date",
    profileKey: "dateOfBirth",
    question: "What is your date of birth?",
    why: "Used to calculate your age for age-limited scholarships.",
    sensitive: false,
    askable: true,
    group: "personal",
  },
  {
    key: "gender",
    label: "Gender",
    type: "enum",
    profileKey: "gender",
    options: GENDERS,
    question: "How do you describe your gender?",
    why: "Only asked because a scholarship you're checking has a gender-specific criterion. You can choose not to answer.",
    sensitive: true,
    askable: true,
    group: "personal",
  },
  {
    key: "country_of_citizenship",
    label: "Country of citizenship",
    type: "string",
    profileKey: "countryOfCitizenship",
    question: "Which country are you a citizen of?",
    why: "Scholarships often target citizens of specific countries.",
    sensitive: false,
    askable: true,
    group: "location",
  },
  {
    key: "country_of_residence",
    label: "Country of residence",
    type: "string",
    profileKey: "countryOfResidence",
    question: "Which country do you currently live in?",
    why: "Some scholarships require applicants to live in a particular country.",
    sensitive: false,
    askable: true,
    group: "location",
  },
  {
    key: "state_of_origin",
    label: "State of origin",
    type: "string",
    profileKey: "stateOfOrigin",
    options: NIGERIAN_STATES.map((s) => ({ value: s, label: s })),
    question: "What is your state of origin?",
    why: "A few scholarships prioritise applicants from particular states or regions.",
    sensitive: false,
    askable: true,
    group: "location",
  },
  {
    key: "education_level",
    label: "Current education level",
    type: "enum",
    profileKey: "educationLevel",
    options: EDUCATION_LEVELS,
    question: "What is your current level of education?",
    why: "Undergraduate scholarships usually require you to have completed (or be completing) secondary school.",
    sensitive: false,
    askable: true,
    group: "academic",
  },
  {
    key: "qualifications",
    label: "Academic qualifications",
    type: "string_list",
    profileKey: "qualifications",
    options: QUALIFICATIONS,
    question: "Which qualifications have you obtained (or will obtain)?",
    why: "Universities list the secondary-school qualifications they accept.",
    sensitive: false,
    askable: true,
    group: "academic",
  },
  {
    key: "credit_passes",
    label: "Number of credit passes",
    type: "number",
    profileKey: "creditPasses",
    question: "How many credit passes (C6 or better) do you have in WASSCE/NECO, including English and Mathematics?",
    why: "Many universities set a minimum number of credit passes.",
    sensitive: false,
    askable: true,
    group: "academic",
  },
  {
    key: "grade_average",
    label: "Grade average (percentage)",
    type: "number",
    profileKey: "gradeAverage",
    question: "What is your overall grade average as a percentage (0–100)?",
    help: "If you have a GPA, convert it to a percentage or use your school's stated equivalent.",
    why: "Some scholarships set a minimum academic average.",
    sensitive: false,
    askable: true,
    group: "academic",
  },
  {
    key: "graduation_year",
    label: "Secondary school graduation year",
    type: "number",
    profileKey: "graduationYear",
    question: "In which year did (or will) you finish secondary school?",
    why: "Some programmes only accept recent school leavers.",
    sensitive: false,
    askable: true,
    group: "academic",
  },
  {
    key: "first_generation",
    label: "First-generation university student",
    type: "boolean",
    profileKey: "firstGeneration",
    question: "Would you be the first person in your immediate family to attend university?",
    why: "Several programmes prioritise first-generation students.",
    sensitive: false,
    askable: true,
    group: "background",
  },
  {
    key: "household_income_band",
    label: "Household income level",
    type: "enum",
    profileKey: "householdIncomeBand",
    options: INCOME_BANDS,
    question: "Which best describes your household's income level?",
    why: "Need-based scholarships consider financial circumstances. This stays private to you and SOAR Hub staff with permission.",
    sensitive: true,
    askable: true,
    group: "background",
  },
  {
    key: "demonstrates_financial_need",
    label: "Financial need",
    type: "boolean",
    profileKey: "demonstratesFinancialNeed",
    question: "Would you be unable to attend university without significant financial support?",
    why: "Fully funded scholarships are often reserved for applicants with financial need.",
    sensitive: true,
    askable: true,
    group: "background",
  },
  {
    key: "has_disability",
    label: "Disability status",
    type: "boolean",
    profileKey: "hasDisability",
    question: "Do you identify as a person with a disability?",
    why: "Only asked when a scholarship has a criterion about this. Answering is optional and kept confidential.",
    sensitive: true,
    askable: true,
    group: "background",
  },
  {
    key: "is_refugee_or_displaced",
    label: "Refugee or displaced status",
    type: "boolean",
    profileKey: "isRefugeeOrDisplaced",
    question: "Are you a refugee or have you been forcibly displaced from your home?",
    why: "Only asked when a scholarship has a criterion about this. Answering is optional and kept confidential.",
    sensitive: true,
    askable: true,
    group: "background",
  },
  {
    key: "employment_status",
    label: "Employment status",
    type: "enum",
    profileKey: "employmentStatus",
    options: EMPLOYMENT_STATUSES,
    question: "What is your current employment status?",
    why: "Some programmes are designed for students or recent school leavers.",
    sensitive: false,
    askable: true,
    group: "background",
  },
  {
    key: "preferred_programme",
    label: "Preferred programme of study",
    type: "string",
    profileKey: "preferredProgramme",
    question: "What would you like to study?",
    why: "Scholarships may only cover certain programmes.",
    sensitive: false,
    askable: true,
    group: "programme",
  },
  {
    key: "uploaded_document_categories",
    label: "Documents uploaded",
    type: "string_list",
    derived: true,
    options: DOCUMENT_CATEGORIES,
    question: "Upload the required document in your Documents workspace.",
    why: "Some criteria require a document to be available.",
    sensitive: false,
    askable: false,
    group: "documents",
  },
];

export const FIELD_MAP: Record<string, FieldDefinition> = Object.fromEntries(FIELDS.map((f) => [f.key, f]));

export const CUSTOM_PREFIX = "custom.";
export const isCustomField = (key: string) => key.startsWith(CUSTOM_PREFIX);

export function getField(key: string): FieldDefinition | undefined {
  return FIELD_MAP[key];
}

export function fieldLabel(key: string): string {
  if (isCustomField(key)) return key.slice(CUSTOM_PREFIX.length).replace(/[_-]+/g, " ");
  return FIELD_MAP[key]?.label ?? key;
}

export function optionLabel(fieldKey: string, value: unknown): string {
  const f = FIELD_MAP[fieldKey];
  if (Array.isArray(value)) return value.map((v) => optionLabel(fieldKey, v)).join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined || value === "") return "Not provided";
  const opt = f?.options?.find((o) => o.value === value);
  return opt ? opt.label : String(value);
}
