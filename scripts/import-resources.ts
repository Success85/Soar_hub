/**
 * Imports SOAR Hub's learning resources (src/lib/data/learning-resources.ts): sample documents with explanations.
 *
 *   npm run db:import-resources
 *
 * Idempotent (keyed by slug): re-running refreshes title, text, file links and tags from the dataset.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, sqlClient } from "@/lib/db";
import { contentCategories, contentTags, educationalResources, resourceTags } from "@/lib/db/schema";
import { LEARNING_RESOURCES } from "@/lib/data/learning-resources";
import { slugify } from "@/lib/services/scholarships";

const CATEGORY_NAMES: Record<string, string> = {
  "application-guides": "Scholarship application guides",
  "essay-writing": "Essay writing",
  "cv-documents": "CV & documents",
  "reference-letters": "Reference letters",
};
const PUBLISHED_AT = new Date("2026-11-24T12:00:00Z");

async function main() {
  let created = 0;
  let updated = 0;
  for (const r of LEARNING_RESOURCES) {
    const [cat] = await db
      .insert(contentCategories)
      .values({ name: CATEGORY_NAMES[r.category], slug: r.category })
      .onConflictDoUpdate({ target: contentCategories.slug, set: { slug: r.category } })
      .returning({ id: contentCategories.id });
    const values = {
      title: r.title,
      slug: r.slug,
      categoryId: cat.id,
      type: r.type,
      description: r.description,
      body: r.body,
      externalUrl: r.file.url,
      featuredImageUrl: r.file.preview,
      authorName: "SOAR Hub team",
      status: "published" as const,
      visibility: "public" as const,
      seoTitle: r.title,
      seoDescription: r.description.slice(0, 320),
      isDemo: false,
    };
    const [existing] = await db.select({ id: educationalResources.id }).from(educationalResources).where(eq(educationalResources.slug, r.slug)).limit(1);
    let id: string;
    if (existing) {
      await db.update(educationalResources).set({ ...values, updatedAt: new Date() }).where(eq(educationalResources.id, existing.id));
      id = existing.id;
      updated++;
    } else {
      [{ id }] = await db.insert(educationalResources).values({ ...values, publishedAt: PUBLISHED_AT }).returning({ id: educationalResources.id });
      created++;
    }
    await db.delete(resourceTags).where(eq(resourceTags.resourceId, id));
    for (const name of r.tags) {
      const [tag] = await db.insert(contentTags).values({ name, slug: slugify(name) }).onConflictDoUpdate({ target: contentTags.slug, set: { name } }).returning({ id: contentTags.id });
      await db.insert(resourceTags).values({ resourceId: id, tagId: tag.id }).onConflictDoNothing();
    }
  }
  console.log(`Learning resources imported: ${created} created, ${updated} updated (${LEARNING_RESOURCES.length} in dataset).`);
  await sqlClient.end();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await sqlClient.end();
  process.exit(1);
});
