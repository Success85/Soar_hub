import "server-only";
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { contactMessages, contentCategories, contentTags, educationalResources, resourceTags, users } from "@/lib/db/schema";
import { AppError, NotFoundError } from "@/lib/errors";
import { audit } from "./audit";
import { enqueueNotification } from "./notifications";
import { rateLimit } from "./rate-limit";
import { slugify } from "./scholarships";
import { getSettings } from "./settings";
import { idempotencyKey } from "@/lib/engine/notification-keys";

export const CONTENT_TYPES = [
  { value: "article", label: "Article" },
  { value: "guide", label: "Application guide" },
  { value: "essay_guide", label: "Essay guide" },
  { value: "cv_guide", label: "CV guide" },
  { value: "interview_guide", label: "Interview guide" },
  { value: "faq", label: "FAQ" },
  { value: "video", label: "Video" },
  { value: "download", label: "Downloadable resource" },
  { value: "webinar", label: "Webinar" },
  { value: "announcement", label: "Announcement" },
] as const;

const optText = z
  .string()
  .trim()
  .nullish()
  .transform((v) => v || null);

export const resourceSchema = z.object({
  title: z.string().trim().min(3).max(250),
  slug: z.string().trim().max(250).optional(),
  categoryId: z.string().uuid().nullish(),
  type: z.enum(CONTENT_TYPES.map((t) => t.value) as [string, ...string[]]),
  description: optText,
  body: z.string().max(100000).default(""),
  featuredImageUrl: optText.refine((v) => !v || /^(https:\/\/|\/previews\/)/.test(v), "Use an https:// image URL (or a /previews/ image)"),
  externalUrl: optText.refine((v) => !v || /^(https:\/\/|\/downloads\/)/.test(v), "Use an https:// link (or a /downloads/ file)"),
  authorName: optText,
  status: z.enum(["draft", "published", "archived"]),
  visibility: z.enum(["public", "applicants"]),
  publishedAt: z.coerce.date().nullish(),
  seoTitle: optText,
  seoDescription: optText,
  tags: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
});

async function setTags(resourceId: string, names: string[]) {
  await db.delete(resourceTags).where(eq(resourceTags.resourceId, resourceId));
  for (const name of [...new Set(names.map((n) => n.trim()).filter(Boolean))]) {
    const slug = slugify(name);
    const [tag] = await db.insert(contentTags).values({ name, slug }).onConflictDoUpdate({ target: contentTags.slug, set: { name } }).returning();
    await db.insert(resourceTags).values({ resourceId, tagId: tag.id }).onConflictDoNothing();
  }
}

export async function saveResource(id: string | null, input: z.input<typeof resourceSchema>, actorId: string) {
  const data = resourceSchema.parse(input);
  const { tags, ...rest } = data;
  const slugBase = slugify(rest.slug || rest.title);
  const clash = await db.select({ id: educationalResources.id }).from(educationalResources).where(eq(educationalResources.slug, slugBase)).limit(1);
  const slug = clash[0] && clash[0].id !== id ? `${slugBase}-${Date.now().toString(36)}` : slugBase;
  const publishedAt = rest.status === "published" ? rest.publishedAt ?? new Date() : rest.publishedAt ?? null;
  let row;
  if (id) {
    [row] = await db.update(educationalResources).set({ ...rest, type: rest.type as never, slug, publishedAt, updatedAt: new Date() }).where(eq(educationalResources.id, id)).returning();
    if (!row) throw new NotFoundError("Resource");
  } else {
    [row] = await db.insert(educationalResources).values({ ...rest, type: rest.type as never, slug, publishedAt, authorId: actorId }).returning();
  }
  await setTags(row.id, tags);
  await audit({ eventType: id ? "content.updated" : "content.created", actorId, actorRole: "admin", targetType: "resource", targetId: row.id, newState: { title: row.title, status: row.status } });
  return row;
}

export async function deleteResource(id: string, actorId: string) {
  await db.update(educationalResources).set({ status: "archived", updatedAt: new Date() }).where(eq(educationalResources.id, id));
  await audit({ eventType: "content.archived", actorId, actorRole: "admin", targetType: "resource", targetId: id });
}

export async function listCategories() {
  return db.select().from(contentCategories).orderBy(asc(contentCategories.name));
}

export async function saveCategory(input: { name: string; description?: string | null }, actorId: string) {
  const name = input.name.trim();
  if (name.length < 2) throw new AppError("Enter a category name.", 400);
  const [row] = await db.insert(contentCategories).values({ name, slug: slugify(name), description: input.description ?? null }).onConflictDoUpdate({ target: contentCategories.slug, set: { name, description: input.description ?? null } }).returning();
  await audit({ eventType: "content.category_saved", actorId, actorRole: "admin", targetType: "content_category", targetId: row.id });
  return row;
}

export async function listResources(f: { q?: string; category?: string; tag?: string; type?: string; includeApplicantOnly?: boolean; admin?: boolean; status?: string; limit?: number }) {
  const conds: SQL[] = [];
  if (!f.admin) {
    conds.push(eq(educationalResources.status, "published"));
    conds.push(sql`${educationalResources.publishedAt} <= now()`);
    if (!f.includeApplicantOnly) conds.push(eq(educationalResources.visibility, "public"));
  } else if (f.status) conds.push(eq(educationalResources.status, f.status as never));
  if (f.q) conds.push(or(ilike(educationalResources.title, `%${f.q}%`), ilike(educationalResources.description, `%${f.q}%`), ilike(educationalResources.body, `%${f.q}%`))!);
  if (f.type) conds.push(eq(educationalResources.type, f.type as never));
  if (f.category) conds.push(sql`${educationalResources.categoryId} = (SELECT id FROM content_categories WHERE slug = ${f.category})`);
  if (f.tag) conds.push(sql`EXISTS (SELECT 1 FROM resource_tags rt JOIN content_tags t ON t.id = rt.tag_id WHERE rt.resource_id = ${educationalResources.id} AND t.slug = ${f.tag})`);
  const rows = await db
    .select({ r: educationalResources, category: { name: contentCategories.name, slug: contentCategories.slug }, tags: sql<string[]>`ARRAY(SELECT t.name FROM resource_tags rt JOIN content_tags t ON t.id = rt.tag_id WHERE rt.resource_id = ${educationalResources.id} ORDER BY t.name)` })
    .from(educationalResources)
    .leftJoin(contentCategories, eq(contentCategories.id, educationalResources.categoryId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(educationalResources.publishedAt), desc(educationalResources.updatedAt))
    .limit(f.limit ?? 60);
  return rows;
}

export async function getResource(slugOrId: { slug?: string; id?: string }) {
  const [row] = await db
    .select({ r: educationalResources, category: { name: contentCategories.name, slug: contentCategories.slug }, author: { firstName: users.firstName, lastName: users.lastName } })
    .from(educationalResources)
    .leftJoin(contentCategories, eq(contentCategories.id, educationalResources.categoryId))
    .leftJoin(users, eq(users.id, educationalResources.authorId))
    .where(slugOrId.id ? eq(educationalResources.id, slugOrId.id) : eq(educationalResources.slug, slugOrId.slug!))
    .limit(1);
  if (!row) return null;
  const tags = await db.select({ name: contentTags.name, slug: contentTags.slug }).from(resourceTags).innerJoin(contentTags, eq(contentTags.id, resourceTags.tagId)).where(eq(resourceTags.resourceId, row.r.id));
  return { ...row, tags };
}

export async function allTags() {
  return db.select().from(contentTags).where(inArray(contentTags.id, db.select({ id: resourceTags.tagId }).from(resourceTags))).orderBy(asc(contentTags.name));
}

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(150),
  email: z.string().trim().email("Enter a valid email").max(320),
  subject: z.string().trim().min(3, "Add a subject").max(200),
  message: z.string().trim().min(10, "Tell us a little more").max(5000),
  website: z.string().max(0).optional(), // honeypot
});

export async function submitContact(input: z.input<typeof contactSchema>, ip: string | null) {
  const data = contactSchema.parse(input);
  await rateLimit(`contact:${ip ?? "unknown"}`, 5, 3600);
  const [row] = await db.insert(contactMessages).values({ name: data.name, email: data.email, subject: data.subject, message: data.message }).returning();
  const s = await getSettings();
  const to = s.admin_alert_email || s.support_email;
  if (to) {
    await enqueueNotification({ templateKey: "admin.alert", channel: "email", recipientEmail: to, transactional: true, idempotencyKey: idempotencyKey(["contact", row.id]), vars: { title: `Contact form: ${data.subject}`, message: `From: ${data.name} <${data.email}>\n\n${data.message}` } });
  }
  return row;
}

export async function listContactMessages() {
  return db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt)).limit(200);
}
