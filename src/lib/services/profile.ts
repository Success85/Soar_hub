import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { consents, profiles, users } from "@/lib/db/schema";
import { calculateAge } from "@/lib/engine/eligibility";
import { AppError } from "@/lib/errors";
import { audit } from "./audit";

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v === undefined ? undefined : v ? v : null));

export const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker")
    .nullish()
    .refine((v) => !v || (calculateAge(v) !== null && calculateAge(v)! >= 10 && calculateAge(v)! <= 100), "Enter a valid date of birth"),
  gender: z.enum(["female", "male", "non_binary", "prefer_not_to_say"]).nullish(),
  stateOfOrigin: nullableText(60),
  countryOfCitizenship: nullableText(60),
  countryOfResidence: nullableText(60),
  phone: z
    .string()
    .trim()
    .max(30)
    .nullish()
    .transform((v) => (v === undefined ? undefined : v ? v : null))
    .refine((v) => !v || /^[+\d][\d\s()-]{6,}$/.test(v), "Enter a valid phone number"),
  educationLevel: z.enum(["secondary_in_progress", "secondary_completed", "undergraduate_in_progress", "undergraduate_completed", "postgraduate", "other"]).nullish(),
  currentSchool: nullableText(200),
  graduationYear: z.coerce.number().int().min(1990).max(2040).nullish(),
  qualifications: z.array(z.string().max(30)).max(12).nullish(),
  creditPasses: z.coerce.number().int().min(0).max(15).nullish(),
  gradeAverage: z.coerce.number().min(0).max(100).nullish(),
  academicResultsSummary: nullableText(2000),
  firstGeneration: z.boolean().nullish(),
  householdIncomeBand: z.enum(["very_low", "low", "lower_middle", "middle", "upper", "prefer_not_to_say"]).nullish(),
  demonstratesFinancialNeed: z.boolean().nullish(),
  hasDisability: z.boolean().nullish(),
  isRefugeeOrDisplaced: z.boolean().nullish(),
  employmentStatus: z.enum(["student", "unemployed", "employed_part_time", "employed_full_time", "self_employed", "other"]).nullish(),
  preferredProgramme: nullableText(200),
  careerInterests: nullableText(2000),
  personalBackground: nullableText(4000),
  dataProcessingConsent: z.boolean().optional(),
});
export type ProfileInput = z.input<typeof profileSchema>;

export type ProfileRow = typeof profiles.$inferSelect;

/** Profile fields that drive the completion meter (sensitive fields are optional and never counted). */
export const COMPLETION_FIELDS: { key: keyof ProfileRow | "dataProcessingConsent"; label: string; section: string }[] = [
  { key: "dateOfBirth", label: "Date of birth", section: "personal" },
  { key: "countryOfCitizenship", label: "Country of citizenship", section: "personal" },
  { key: "countryOfResidence", label: "Country of residence", section: "personal" },
  { key: "stateOfOrigin", label: "State of origin", section: "personal" },
  { key: "phone", label: "Phone number", section: "personal" },
  { key: "educationLevel", label: "Current education level", section: "education" },
  { key: "currentSchool", label: "School", section: "education" },
  { key: "graduationYear", label: "Graduation year", section: "education" },
  { key: "qualifications", label: "Academic qualifications", section: "education" },
  { key: "creditPasses", label: "Credit passes", section: "education" },
  { key: "firstGeneration", label: "First-generation status", section: "background" },
  { key: "employmentStatus", label: "Employment status", section: "background" },
  { key: "preferredProgramme", label: "Preferred programme", section: "goals" },
  { key: "careerInterests", label: "Career interests", section: "goals" },
  { key: "personalBackground", label: "Personal background", section: "goals" },
  { key: "dataProcessingConsent", label: "Consent to process your data", section: "consent" },
];

export function profileCompletion(p: Partial<ProfileRow> | null, hasConsent: boolean) {
  const missing = COMPLETION_FIELDS.filter((f) => {
    if (f.key === "dataProcessingConsent") return !hasConsent;
    const v = p?.[f.key as keyof ProfileRow];
    return v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
  });
  const percent = Math.round(((COMPLETION_FIELDS.length - missing.length) / COMPLETION_FIELDS.length) * 100);
  const nextAction = missing.length === 0 ? "Your profile is complete. Check your eligibility for a scholarship." : `Add your ${missing[0].label.toLowerCase()} to strengthen your profile.`;
  return { percent, missing, nextAction };
}

export async function getProfileBundle(userId: string) {
  const [row] = await db.select({ profile: profiles, user: users }).from(users).leftJoin(profiles, eq(profiles.userId, users.id)).where(eq(users.id, userId)).limit(1);
  if (!row) throw new AppError("Account not found", 404);
  const consent = await db
    .select({ id: consents.id })
    .from(consents)
    .where(and(eq(consents.userId, userId), eq(consents.type, "data_processing"), isNull(consents.revokedAt)))
    .limit(1);
  const hasConsent = consent.length > 0;
  return { user: row.user, profile: row.profile, hasConsent, completion: profileCompletion(row.profile, hasConsent) };
}

const SENSITIVE = new Set(["dateOfBirth", "gender", "householdIncomeBand", "demonstratesFinancialNeed", "hasDisability", "isRefugeeOrDisplaced", "phone"]);

/** Updates a profile, records consent, audits the changed fields and returns their keys. */
export async function updateProfile(userId: string, input: ProfileInput, actor: { id: string; role: string }): Promise<string[]> {
  const data = profileSchema.parse(input);
  const { firstName, lastName, dataProcessingConsent, ...fields } = data;
  const changed: string[] = [];

  await db.transaction(async (tx) => {
    const [current] = await tx.select().from(profiles).where(eq(profiles.userId, userId)).for("update").limit(1);
    if (!current) await tx.insert(profiles).values({ userId });
    const update: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined) continue;
      const prev = current?.[k as keyof ProfileRow];
      const norm = k === "gradeAverage" && v !== null ? String(Number(v).toFixed(2)) : v;
      const prevNorm = k === "gradeAverage" && prev !== null && prev !== undefined ? String(Number(prev).toFixed(2)) : prev;
      if (JSON.stringify(prevNorm ?? null) !== JSON.stringify(norm ?? null)) {
        update[k] = norm;
        changed.push(k);
      }
    }
    if (Object.keys(update).length) {
      await tx.update(profiles).set({ ...update, updatedAt: new Date() }).where(eq(profiles.userId, userId));
    }
    if (firstName || lastName) {
      const [u] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
      const nameUpdate: Record<string, string> = {};
      if (firstName && firstName !== u.firstName) nameUpdate.firstName = firstName;
      if (lastName && lastName !== u.lastName) nameUpdate.lastName = lastName;
      if (Object.keys(nameUpdate).length) {
        await tx.update(users).set({ ...nameUpdate, updatedAt: new Date() }).where(eq(users.id, userId));
        changed.push(...Object.keys(nameUpdate));
      }
    }
    if (dataProcessingConsent !== undefined) {
      const active = await tx
        .select()
        .from(consents)
        .where(and(eq(consents.userId, userId), eq(consents.type, "data_processing"), isNull(consents.revokedAt)))
        .limit(1);
      if (dataProcessingConsent && !active[0]) {
        await tx.insert(consents).values({ userId, type: "data_processing", version: "2026-11" });
        changed.push("dataProcessingConsent");
      } else if (!dataProcessingConsent && active[0]) {
        await tx.update(consents).set({ revokedAt: new Date() }).where(eq(consents.id, active[0].id));
        changed.push("dataProcessingConsent");
      }
    }
    if (changed.length) {
      const visible = Object.fromEntries(Object.entries(update).filter(([k]) => !SENSITIVE.has(k)));
      await audit(
        {
          eventType: "profile.updated",
          actorId: actor.id,
          actorRole: actor.role,
          targetType: "profile",
          targetId: userId,
          metadata: { changedFields: changed },
          previousState: current ? Object.fromEntries(Object.keys(visible).map((k) => [k, current[k as keyof ProfileRow]])) : null,
          newState: visible,
        },
        tx,
      );
    }
  });
  return changed;
}

export async function markOnboardingStep(userId: string, step: "welcome" | "completed"): Promise<void> {
  await db
    .update(profiles)
    .set(step === "welcome" ? { welcomeSeenAt: new Date() } : { onboardingCompletedAt: new Date() })
    .where(eq(profiles.userId, userId));
}
