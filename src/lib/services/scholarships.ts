import "server-only";
import { and, asc, desc, eq, gte, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  applications,
  essayRubrics,
  savedScholarships,
  scholarshipCriteria,
  scholarshipCriteriaGroups,
  scholarshipDocumentRequirements,
  scholarshipFiles,
  scholarshipMilestoneTemplates,
  scholarshipRevisions,
  scholarships,
  scholarshipSources,
} from "@/lib/db/schema";
import { validateCriteria, type Criterion } from "@/lib/engine/eligibility";
import { topologicalOrder, ScheduleError } from "@/lib/engine/scheduler";
import { AppError, NotFoundError } from "@/lib/errors";
import { audit, trackActivity } from "./audit";
import { recalculateForScholarship } from "./eligibility";
import { recalculateForDeadlineChange } from "./planner";

export type Scholarship = typeof scholarships.$inferSelect;
export type ScholarshipStatus = Scholarship["status"];

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}

const optText = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v : null));
const optUrl = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v : null))
  .refine((v) => !v || /^https:\/\/[^\s]+$/i.test(v), "Must be an https:// link");

export const scholarshipSchema = z.object({
  name: z.string().trim().min(3, "Name is required").max(250),
  slug: z.string().trim().max(250).optional(),
  partnerUniversity: z.string().trim().min(2, "Partner university is required").max(250),
  country: z.string().trim().min(2, "Country is required").max(80),
  city: optText,
  programmeLevel: z.enum(["undergraduate", "masters", "doctoral", "other"]).default("undergraduate"),
  scholarshipType: z.string().trim().min(2).max(120).default("Fully funded"),
  programmes: z.array(z.string().trim().min(1).max(120)).max(60).default([]),
  summary: optText,
  description: z.string().trim().max(20000).default(""),
  tuitionCoverage: optText,
  livingAllowance: optText,
  accommodationBenefits: optText,
  travelBenefits: optText,
  otherBenefits: optText,
  openingDate: z.coerce.date().nullish(),
  deadline: z.coerce.date().nullish(),
  timezone: z.string().trim().default("Africa/Lagos"),
  applicationUrl: optUrl,
  isFeatured: z.boolean().default(false),
  windowStatus: z.enum(["open", "opens_soon", "closed", "not_announced", "paused"]).default("open"),
  category: z.enum(["ug_africa", "ug_extra_africa", "ug_outside_africa", "pg_africa", "pg_outside_africa"]).nullish(),
  currentWindow: optText,
  nextWindow: optText,
  keyEligibility: optText,
  logoUrl: optText.refine((v) => !v || /^(https:\/\/|\/logos\/)/.test(v), "Use an https:// image URL or a /logos/ file"),
  howToApply: optText,
  contactEmail: z.string().trim().email("Enter a valid email").nullish().or(z.literal("").transform(() => null)),
  researchSources: optText,
});
export type ScholarshipInput = z.infer<typeof scholarshipSchema>;

/* ------------------------------------------------------------------ */
/* Public discovery                                                    */
/* ------------------------------------------------------------------ */

export interface ScholarshipFilters {
  q?: string;
  institution?: string;
  country?: string;
  programme?: string;
  type?: string;
  deadline?: "30" | "90" | "any";
  window?: string;
  category?: string;
  level?: string;
  sort?: "status" | "deadline" | "newest" | "name";
  page?: number;
  pageSize?: number;
}

/** Only verified + published + active scholarships are shown to applicants. */
export const publicWhere = () => and(eq(scholarships.status, "published"), eq(scholarships.isActive, true));

export async function listPublicScholarships(f: ScholarshipFilters = {}) {
  const conds: SQL[] = [publicWhere()!];
  if (f.q) {
    const like = `%${f.q.replace(/[%_]/g, "")}%`;
    conds.push(or(ilike(scholarships.name, like), ilike(scholarships.partnerUniversity, like), ilike(scholarships.description, like), sql`array_to_string(${scholarships.programmes}, ' ') ILIKE ${like}`)!);
  }
  if (f.institution) conds.push(eq(scholarships.partnerUniversity, f.institution));
  if (f.country) conds.push(eq(scholarships.country, f.country));
  if (f.type) conds.push(eq(scholarships.scholarshipType, f.type));
  if (f.window) conds.push(eq(scholarships.windowStatus, f.window as never));
  if (f.category) conds.push(eq(scholarships.category, f.category as never));
  if (f.level) conds.push(eq(scholarships.programmeLevel, f.level as never));
  if (f.programme) conds.push(sql`${f.programme} = ANY(${scholarships.programmes})`);
  if (f.deadline && f.deadline !== "any") {
    conds.push(gte(scholarships.deadline, new Date()));
    conds.push(sql`${scholarships.deadline} <= now() + (${Number(f.deadline)} || ' days')::interval`);
  }
  const windowRank = sql`CASE ${scholarships.windowStatus} WHEN 'open' THEN 0 WHEN 'opens_soon' THEN 1 WHEN 'not_announced' THEN 2 WHEN 'closed' THEN 3 ELSE 4 END`;
  const upcoming = sql`CASE WHEN ${scholarships.deadline} >= now() THEN ${scholarships.deadline} END ASC NULLS LAST`;
  const order =
    f.sort === "name" ? [asc(scholarships.name)] : f.sort === "newest" ? [desc(scholarships.publishedAt)] : f.sort === "deadline" ? [upcoming, windowRank] : [windowRank, upcoming, asc(scholarships.name)];
  const pageSize = Math.min(f.pageSize ?? 12, 100);
  const page = Math.max(1, f.page ?? 1);
  const where = and(...conds);
  const [rows, [{ count }]] = await Promise.all([
    db.select().from(scholarships).where(where).orderBy(...order).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(scholarships).where(where),
  ]);
  return { rows, total: count, page, pageSize };
}

export async function publicFacets() {
  const rows = await db.select({ u: scholarships.partnerUniversity, c: scholarships.country, t: scholarships.scholarshipType, p: scholarships.programmes, w: scholarships.windowStatus, g: scholarships.category, l: scholarships.programmeLevel }).from(scholarships).where(publicWhere());
  const uniq = (xs: string[]) => [...new Set(xs)].sort();
  const countBy = (xs: (string | null)[]) => xs.reduce<Record<string, number>>((a, x) => (x ? { ...a, [x]: (a[x] ?? 0) + 1 } : a), {});
  return { institutions: uniq(rows.map((r) => r.u)), countries: uniq(rows.map((r) => r.c)), types: uniq(rows.map((r) => r.t)), programmes: uniq(rows.flatMap((r) => r.p)), windows: countBy(rows.map((r) => r.w)), categories: countBy(rows.map((r) => r.g)), levels: countBy(rows.map((r) => r.l)), total: rows.length };
}

export async function getScholarshipBundle(where: { slug?: string; id?: string }) {
  const [s] = await db
    .select()
    .from(scholarships)
    .where(where.id ? eq(scholarships.id, where.id) : eq(scholarships.slug, where.slug!))
    .limit(1);
  if (!s) return null;
  const [sources, criteria, groups, requirements, milestones, files, rubric] = await Promise.all([
    db.select().from(scholarshipSources).where(eq(scholarshipSources.scholarshipId, s.id)).orderBy(desc(scholarshipSources.isPrimary)),
    db.select().from(scholarshipCriteria).where(eq(scholarshipCriteria.scholarshipId, s.id)).orderBy(asc(scholarshipCriteria.sortOrder)),
    db.select().from(scholarshipCriteriaGroups).where(eq(scholarshipCriteriaGroups.scholarshipId, s.id)).orderBy(asc(scholarshipCriteriaGroups.sortOrder)),
    db.select().from(scholarshipDocumentRequirements).where(eq(scholarshipDocumentRequirements.scholarshipId, s.id)).orderBy(asc(scholarshipDocumentRequirements.sortOrder)),
    db.select().from(scholarshipMilestoneTemplates).where(eq(scholarshipMilestoneTemplates.scholarshipId, s.id)).orderBy(asc(scholarshipMilestoneTemplates.sortOrder)),
    db.select().from(scholarshipFiles).where(eq(scholarshipFiles.scholarshipId, s.id)),
    db.select().from(essayRubrics).where(and(eq(essayRubrics.scholarshipId, s.id), eq(essayRubrics.isActive, true))).orderBy(desc(essayRubrics.version)).limit(1),
  ]);
  return { scholarship: s, sources, criteria, groups, requirements, milestones, files, rubric: rubric[0] ?? null };
}

export function isPubliclyVisible(s: Scholarship) {
  return s.status === "published" && s.isActive;
}

export async function toggleSaved(userId: string, scholarshipId: string): Promise<boolean> {
  const existing = await db.select().from(savedScholarships).where(and(eq(savedScholarships.userId, userId), eq(savedScholarships.scholarshipId, scholarshipId))).limit(1);
  if (existing[0]) {
    await db.delete(savedScholarships).where(and(eq(savedScholarships.userId, userId), eq(savedScholarships.scholarshipId, scholarshipId)));
    await trackActivity("scholarship.unsaved", { userId, entityType: "scholarship", entityId: scholarshipId });
    return false;
  }
  const [s] = await db.select().from(scholarships).where(eq(scholarships.id, scholarshipId)).limit(1);
  if (!s || !isPubliclyVisible(s)) throw new NotFoundError("Scholarship");
  await db.insert(savedScholarships).values({ userId, scholarshipId }).onConflictDoNothing();
  await trackActivity("scholarship.saved", { userId, entityType: "scholarship", entityId: scholarshipId });
  return true;
}

export async function savedFor(userId: string) {
  return db
    .select({ s: scholarships, savedAt: savedScholarships.createdAt })
    .from(savedScholarships)
    .innerJoin(scholarships, eq(scholarships.id, savedScholarships.scholarshipId))
    .where(eq(savedScholarships.userId, userId))
    .orderBy(desc(savedScholarships.createdAt));
}

/* ------------------------------------------------------------------ */
/* Admin CRUD                                                          */
/* ------------------------------------------------------------------ */

async function snapshot(scholarshipId: string, changedBy: string | null, reason: string) {
  const bundle = await getScholarshipBundle({ id: scholarshipId });
  if (!bundle) return;
  await db.insert(scholarshipRevisions).values({ scholarshipId, snapshot: JSON.parse(JSON.stringify(bundle)), changedBy, reason });
}

async function uniqueSlug(base: string, ignoreId?: string): Promise<string> {
  const root = slugify(base) || "scholarship";
  let slug = root;
  for (let i = 2; i < 200; i++) {
    const rows = await db.select({ id: scholarships.id }).from(scholarships).where(eq(scholarships.slug, slug)).limit(1);
    if (!rows[0] || rows[0].id === ignoreId) return slug;
    slug = `${root}-${i}`;
  }
  return `${root}-${Date.now()}`;
}

export async function createScholarship(input: ScholarshipInput, actorId: string) {
  const data = scholarshipSchema.parse(input);
  const slug = await uniqueSlug(data.slug || data.name);
  const [s] = await db.insert(scholarships).values({ ...data, slug, status: "draft", createdBy: actorId, updatedBy: actorId }).returning();
  await audit({ eventType: "scholarship.created", actorId, actorRole: "admin", targetType: "scholarship", targetId: s.id, newState: { name: s.name, slug } });
  await snapshot(s.id, actorId, "created");
  return s;
}

export async function updateScholarship(id: string, input: ScholarshipInput, actorId: string) {
  const data = scholarshipSchema.parse(input);
  const [prev] = await db.select().from(scholarships).where(eq(scholarships.id, id)).limit(1);
  if (!prev) throw new NotFoundError("Scholarship");
  const slug = data.slug ? await uniqueSlug(data.slug, id) : prev.slug;
  // Material edits to a published record send it back for verification.
  const material = prev.deadline?.getTime() !== data.deadline?.getTime() || prev.applicationUrl !== data.applicationUrl;
  const [s] = await db
    .update(scholarships)
    .set({ ...data, slug, updatedBy: actorId, updatedAt: new Date() })
    .where(eq(scholarships.id, id))
    .returning();
  await audit({
    eventType: "scholarship.updated",
    actorId,
    actorRole: "admin",
    targetType: "scholarship",
    targetId: id,
    previousState: { name: prev.name, deadline: prev.deadline, applicationUrl: prev.applicationUrl, status: prev.status },
    newState: { name: s.name, deadline: s.deadline, applicationUrl: s.applicationUrl, status: s.status },
    metadata: { material },
  });
  await snapshot(id, actorId, "updated");
  if (prev.deadline?.getTime() !== s.deadline?.getTime() && s.deadline) await recalculateForDeadlineChange(id, actorId);
  return s;
}

/** Publication rules: verified primary source, valid criteria, at least one required document, future deadline. */
export async function publicationProblems(id: string): Promise<string[]> {
  const b = await getScholarshipBundle({ id });
  if (!b) return ["Scholarship not found"];
  const p: string[] = [];
  const primary = b.sources.find((s) => s.isPrimary) ?? b.sources[0];
  if (!primary) p.push("Add the official source link from the partner university website.");
  else if (primary.verificationStatus !== "verified") p.push("The official source must be verified by an administrator.");
  if (!b.scholarship.lastVerifiedAt) p.push("Record the date this information was last verified.");
  const w = b.scholarship.windowStatus;
  if ((w === "open" || w === "opens_soon") && !b.scholarship.deadline && !b.scholarship.currentWindow) p.push("Open windows need an official deadline or a description of the current window.");
  if (b.scholarship.deadline && b.scholarship.deadline.getTime() < Date.now() && (w === "open" || w === "opens_soon")) p.push("The deadline is in the past — mark the window closed or update the deadline.");
  if (!b.scholarship.keyEligibility && b.criteria.length === 0) p.push("Add the key eligibility (text or rules).");
  p.push(...validateCriteria(b.criteria as unknown as Criterion[], b.groups));
  if (b.milestones.length) {
    try {
      topologicalOrder(b.milestones.map((m) => ({ key: m.key, name: m.name, durationDays: m.durationDays, dependsOn: m.dependsOn })));
    } catch (e) {
      if (e instanceof ScheduleError) p.push(`Milestone template: ${e.message}`);
    }
  }
  return p;
}

type StatusAction = "submit_for_verification" | "verify" | "publish" | "unpublish" | "deactivate" | "reactivate" | "archive" | "expire";

export async function changeScholarshipStatus(id: string, action: StatusAction, actorId: string) {
  const [s] = await db.select().from(scholarships).where(eq(scholarships.id, id)).limit(1);
  if (!s) throw new NotFoundError("Scholarship");
  const set: Partial<typeof scholarships.$inferInsert> = { updatedBy: actorId, updatedAt: new Date() };
  switch (action) {
    case "submit_for_verification":
      set.status = "pending_verification";
      break;
    case "verify": {
      const [src] = await db.select().from(scholarshipSources).where(eq(scholarshipSources.scholarshipId, id)).orderBy(desc(scholarshipSources.isPrimary)).limit(1);
      if (!src) throw new AppError("Add an official source before verifying.", 400);
      await db.update(scholarshipSources).set({ verificationStatus: "verified", verifiedBy: actorId, verifiedAt: new Date(), updatedAt: new Date() }).where(eq(scholarshipSources.scholarshipId, id));
      set.status = s.status === "published" ? "published" : "verified";
      set.lastVerifiedAt = new Date();
      set.verifiedBy = actorId;
      break;
    }
    case "publish": {
      const problems = await publicationProblems(id);
      if (problems.length) throw new AppError(`This scholarship can't be published yet: ${problems.join(" ")}`, 409, "not_publishable");
      set.status = "published";
      set.isActive = true;
      set.publishedAt = s.publishedAt ?? new Date();
      break;
    }
    case "unpublish":
      set.status = "verified";
      break;
    case "deactivate":
      set.status = "deactivated";
      set.isActive = false;
      break;
    case "reactivate":
      set.status = "draft";
      set.isActive = true;
      break;
    case "archive":
      set.status = "archived";
      set.isActive = false;
      break;
    case "expire":
      set.status = "expired";
      break;
  }
  await db.update(scholarships).set(set).where(eq(scholarships.id, id));
  await audit({ eventType: `scholarship.${action}`, actorId, actorRole: "admin", targetType: "scholarship", targetId: id, previousState: { status: s.status, isActive: s.isActive }, newState: { status: set.status ?? s.status, isActive: set.isActive ?? s.isActive } });
  await snapshot(id, actorId, action);
}

export async function duplicateScholarship(id: string, actorId: string) {
  const b = await getScholarshipBundle({ id });
  if (!b) throw new NotFoundError("Scholarship");
  const { id: _id, slug: _slug, createdAt: _c, updatedAt: _u, publishedAt: _p, lastVerifiedAt: _l, verifiedBy: _v, ...rest } = b.scholarship;
  void _id; void _slug; void _c; void _u; void _p; void _l; void _v;
  const name = `${rest.name} (copy)`;
  const [copy] = await db.insert(scholarships).values({ ...rest, name, slug: await uniqueSlug(name), status: "draft", isFeatured: false, createdBy: actorId, updatedBy: actorId }).returning();
  const groupIdMap = new Map<string, string>();
  for (const g of b.groups) {
    const [ng] = await db.insert(scholarshipCriteriaGroups).values({ scholarshipId: copy.id, name: g.name, logic: g.logic, sortOrder: g.sortOrder }).returning();
    groupIdMap.set(g.id, ng.id);
  }
  for (const c of b.criteria) {
    const { id: cid, scholarshipId: _s, createdAt: _cc, updatedAt: _uu, groupId, ...cr } = c;
    void cid; void _s; void _cc; void _uu;
    await db.insert(scholarshipCriteria).values({ ...cr, scholarshipId: copy.id, groupId: groupId ? groupIdMap.get(groupId) ?? null : null });
  }
  for (const r of b.requirements) await db.insert(scholarshipDocumentRequirements).values({ scholarshipId: copy.id, category: r.category, name: r.name, description: r.description, isRequired: r.isRequired, sortOrder: r.sortOrder });
  for (const m of b.milestones) await db.insert(scholarshipMilestoneTemplates).values({ scholarshipId: copy.id, key: m.key, name: m.name, description: m.description, durationDays: m.durationDays, dependsOn: m.dependsOn, priority: m.priority, isRequired: m.isRequired, sortOrder: m.sortOrder });
  for (const src of b.sources) await db.insert(scholarshipSources).values({ scholarshipId: copy.id, sourceName: src.sourceName, url: src.url, isPrimary: src.isPrimary, verificationStatus: "unverified" });
  await audit({ eventType: "scholarship.duplicated", actorId, actorRole: "admin", targetType: "scholarship", targetId: copy.id, metadata: { from: id } });
  return copy;
}

/* ---------------- criteria ---------------- */

export const criterionSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(150),
  description: optText,
  fieldKey: z.string().trim().min(1).max(100),
  operator: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "in", "not_in", "contains", "exists", "not_exists", "is_true", "is_false", "between", "age_between", "matches"]),
  requiredValue: z.unknown().nullable().optional(),
  severity: z.enum(["absolute", "important", "advisory"]),
  isFixable: z.boolean(),
  isRequired: z.boolean(),
  passExplanation: optText,
  failExplanation: optText,
  recommendedAction: optText,
  sourceReference: optText,
  questionText: optText,
  answerType: optText,
  answerOptions: z.array(z.string()).nullish(),
  groupKey: z.string().nullish(),
});
export const groupSchema = z.object({ key: z.string(), name: z.string().trim().min(1).max(150), logic: z.enum(["and", "or"]) });
export const criteriaPayloadSchema = z.object({ criteria: z.array(criterionSchema).max(50), groups: z.array(groupSchema).max(20) });

/** Replaces the full criteria set atomically (supports 20+ criteria and AND/OR groups). */
export async function saveCriteria(scholarshipId: string, payload: z.infer<typeof criteriaPayloadSchema>, actorId: string) {
  const data = criteriaPayloadSchema.parse(payload);
  const asEngine: Criterion[] = data.criteria.map((c, i) => ({ ...c, id: c.id ?? `new-${i}`, groupId: c.groupKey ?? null, requiredValue: c.requiredValue ?? null, answerOptions: c.answerOptions ?? null }));
  const problems = validateCriteria(asEngine, data.groups.map((g) => ({ id: g.key, name: g.name, logic: g.logic })));
  if (problems.length) throw new AppError(problems.join(" "), 400, "invalid_criteria");
  const prev = await db.select().from(scholarshipCriteria).where(eq(scholarshipCriteria.scholarshipId, scholarshipId));
  await db.transaction(async (tx) => {
    await tx.delete(scholarshipCriteria).where(eq(scholarshipCriteria.scholarshipId, scholarshipId));
    await tx.delete(scholarshipCriteriaGroups).where(eq(scholarshipCriteriaGroups.scholarshipId, scholarshipId));
    const gmap = new Map<string, string>();
    for (const [i, g] of data.groups.entries()) {
      const [row] = await tx.insert(scholarshipCriteriaGroups).values({ scholarshipId, name: g.name, logic: g.logic, sortOrder: i }).returning();
      gmap.set(g.key, row.id);
    }
    for (const [i, c] of data.criteria.entries()) {
      await tx.insert(scholarshipCriteria).values({
        scholarshipId,
        groupId: c.groupKey ? gmap.get(c.groupKey) ?? null : null,
        name: c.name,
        description: c.description,
        fieldKey: c.fieldKey,
        operator: c.operator,
        requiredValue: (c.requiredValue ?? null) as object,
        severity: c.severity,
        isFixable: c.isFixable,
        isRequired: c.isRequired,
        passExplanation: c.passExplanation,
        failExplanation: c.failExplanation,
        recommendedAction: c.recommendedAction,
        sourceReference: c.sourceReference,
        questionText: c.questionText,
        answerType: c.answerType,
        answerOptions: c.answerOptions ?? null,
        sortOrder: i,
      });
    }
    await tx.update(scholarships).set({ updatedBy: actorId, updatedAt: new Date() }).where(eq(scholarships.id, scholarshipId));
    await audit({ eventType: "scholarship.criteria_updated", actorId, actorRole: "admin", targetType: "scholarship", targetId: scholarshipId, previousState: { count: prev.length, criteria: prev.map((p) => ({ name: p.name, fieldKey: p.fieldKey, operator: p.operator, requiredValue: p.requiredValue })) }, newState: { count: data.criteria.length } }, tx);
  });
  await snapshot(scholarshipId, actorId, "criteria");
  await recalculateForScholarship(scholarshipId);
}

/* ---------------- documents, milestones, sources, rubric ---------------- */

export const requirementSchema = z.object({
  category: z.enum(["academic_transcript", "certificate", "cv", "passport", "identification", "essay", "recommendation_letter", "financial_documentation", "other"]),
  name: z.string().trim().min(1).max(200),
  description: optText,
  section: z.enum(["admission", "scholarship"]).default("admission"),
  isRequired: z.boolean(),
});

export async function saveRequirements(scholarshipId: string, list: z.input<typeof requirementSchema>[], actorId: string) {
  const data = z.array(requirementSchema).max(30).parse(list);
  const existing = await db.select().from(scholarshipDocumentRequirements).where(eq(scholarshipDocumentRequirements.scholarshipId, scholarshipId));
  await db.transaction(async (tx) => {
    // update in place by position so documents already linked to a requirement keep their link
    for (const [i, r] of data.entries()) {
      const prev = existing[i];
      if (prev) await tx.update(scholarshipDocumentRequirements).set({ ...r, sortOrder: i }).where(eq(scholarshipDocumentRequirements.id, prev.id));
      else await tx.insert(scholarshipDocumentRequirements).values({ ...r, scholarshipId, sortOrder: i });
    }
    const extra = existing.slice(data.length).map((e) => e.id);
    if (extra.length) await tx.delete(scholarshipDocumentRequirements).where(inArray(scholarshipDocumentRequirements.id, extra));
    await audit({ eventType: "scholarship.requirements_updated", actorId, actorRole: "admin", targetType: "scholarship", targetId: scholarshipId, newState: { requirements: data.map((d) => d.name) } }, tx);
  });
  await snapshot(scholarshipId, actorId, "requirements");
}

export const milestoneTemplateSchema = z.object({
  key: z.string().trim().regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers and underscores").max(80),
  name: z.string().trim().min(1).max(200),
  description: optText,
  durationDays: z.coerce.number().int().min(1).max(180),
  dependsOn: z.array(z.string()).default([]),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  isRequired: z.boolean().default(true),
});

export async function saveMilestoneTemplates(scholarshipId: string | null, list: z.infer<typeof milestoneTemplateSchema>[], actorId: string) {
  const data = z.array(milestoneTemplateSchema).max(40).parse(list);
  if (data.length) {
    try {
      topologicalOrder(data.map((d) => ({ ...d })));
    } catch (e) {
      if (e instanceof ScheduleError) throw new AppError(e.message, 400);
      throw e;
    }
    if (!data.some((d) => d.key === "submit")) throw new AppError("Include a final milestone with key “submit”.", 400);
  }
  await db.transaction(async (tx) => {
    await tx.delete(scholarshipMilestoneTemplates).where(scholarshipId ? eq(scholarshipMilestoneTemplates.scholarshipId, scholarshipId) : isNull(scholarshipMilestoneTemplates.scholarshipId));
    for (const [i, m] of data.entries()) await tx.insert(scholarshipMilestoneTemplates).values({ ...m, scholarshipId, sortOrder: i });
    await audit({ eventType: "scholarship.milestones_updated", actorId, actorRole: "admin", targetType: "scholarship", targetId: scholarshipId ?? "global", newState: { keys: data.map((d) => d.key) } }, tx);
  });
  if (scholarshipId) await snapshot(scholarshipId, actorId, "milestones");
}

export const sourceSchema = z.object({
  sourceName: z.string().trim().min(2).max(250),
  url: z.string().trim().regex(/^https:\/\/[^\s]+$/i, "Must be an https:// link to the official website"),
  notes: optText,
});

export async function addSource(scholarshipId: string, input: z.infer<typeof sourceSchema>, actorId: string) {
  const data = sourceSchema.parse(input);
  const existing = await db.select({ id: scholarshipSources.id }).from(scholarshipSources).where(eq(scholarshipSources.scholarshipId, scholarshipId));
  const [row] = await db.insert(scholarshipSources).values({ ...data, scholarshipId, isPrimary: existing.length === 0 }).returning();
  await audit({ eventType: "scholarship.source_added", actorId, actorRole: "admin", targetType: "scholarship", targetId: scholarshipId, newState: data });
  return row;
}

export async function removeSource(sourceId: string, actorId: string) {
  const [src] = await db.delete(scholarshipSources).where(eq(scholarshipSources.id, sourceId)).returning();
  if (src) await audit({ eventType: "scholarship.source_removed", actorId, actorRole: "admin", targetType: "scholarship", targetId: src.scholarshipId, previousState: { url: src.url } });
}

export async function markSourceOutdated(sourceId: string, actorId: string) {
  const [src] = await db.update(scholarshipSources).set({ verificationStatus: "outdated", updatedAt: new Date() }).where(eq(scholarshipSources.id, sourceId)).returning();
  if (src) await audit({ eventType: "scholarship.source_outdated", actorId, actorRole: "admin", targetType: "scholarship", targetId: src.scholarshipId });
}

export async function saveRubric(scholarshipId: string, input: { values: string | null; dimensions: { key: string; label: string; guidance?: string }[] }, actorId: string) {
  const dims = z.array(z.object({ key: z.string().min(1).max(60), label: z.string().min(1).max(120), guidance: z.string().max(500).optional() })).min(1).max(20).parse(input.dimensions);
  const [prev] = await db.select().from(essayRubrics).where(and(eq(essayRubrics.scholarshipId, scholarshipId), eq(essayRubrics.isActive, true))).orderBy(desc(essayRubrics.version)).limit(1);
  await db.update(essayRubrics).set({ isActive: false }).where(eq(essayRubrics.scholarshipId, scholarshipId));
  const [row] = await db.insert(essayRubrics).values({ scholarshipId, version: (prev?.version ?? 0) + 1, values: input.values, dimensions: dims, createdBy: actorId }).returning();
  await audit({ eventType: "scholarship.rubric_updated", actorId, actorRole: "admin", targetType: "scholarship", targetId: scholarshipId, newState: { version: row.version } });
  return row;
}

export async function adminListScholarships(f: { q?: string; status?: string; page?: number }) {
  const conds: SQL[] = [];
  if (f.q) conds.push(or(ilike(scholarships.name, `%${f.q}%`), ilike(scholarships.partnerUniversity, `%${f.q}%`))!);
  if (f.status) conds.push(eq(scholarships.status, f.status as ScholarshipStatus));
  const where = conds.length ? and(...conds) : undefined;
  const page = Math.max(1, f.page ?? 1);
  const [rows, [{ count }]] = await Promise.all([
    db
      .select({ s: scholarships, apps: sql<number>`(select count(*)::int from ${applications} a where a.scholarship_id = ${scholarships.id} and a.deleted_at is null)` })
      .from(scholarships)
      .where(where)
      .orderBy(desc(scholarships.updatedAt))
      .limit(25)
      .offset((page - 1) * 25),
    db.select({ count: sql<number>`count(*)::int` }).from(scholarships).where(where),
  ]);
  return { rows, total: count, page };
}

export async function revisions(scholarshipId: string) {
  return db.select().from(scholarshipRevisions).where(eq(scholarshipRevisions.scholarshipId, scholarshipId)).orderBy(desc(scholarshipRevisions.createdAt)).limit(50);
}

/** Cron: published scholarships whose deadline has passed become "expired" (history preserved). */
export async function expirePastDeadlines(): Promise<number> {
  const rows = await db
    .update(scholarships)
    .set({ windowStatus: "closed", updatedAt: new Date() })
    .where(and(eq(scholarships.status, "published"), inArray(scholarships.windowStatus, ["open", "opens_soon"]), sql`${scholarships.deadline} < now()`))
    .returning({ id: scholarships.id });
  for (const r of rows) await audit({ eventType: "scholarship.window_closed", actorRole: "system", targetType: "scholarship", targetId: r.id, ip: null });
  return rows.length;
}
