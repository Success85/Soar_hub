import "server-only";
import { createHash } from "node:crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { answerBankEmbeddings, answerBankEntries, promptEmbeddings } from "@/lib/db/schema";
import { AppError, NotFoundError } from "@/lib/errors";
import { embed, embeddingModel, embeddingsConfigured } from "@/lib/integrations/embeddings";
import { audit } from "./audit";

export const ANSWER_CATEGORIES = [
  { value: "personal_experience", label: "Personal experience" },
  { value: "achievement", label: "Achievement" },
  { value: "leadership", label: "Leadership story" },
  { value: "community_impact", label: "Community impact" },
  { value: "challenge_overcome", label: "Challenge overcome" },
  { value: "career_goals", label: "Career goals" },
  { value: "motivation", label: "Motivation" },
  { value: "personal_statement", label: "Personal statement" },
  { value: "previous_essay", label: "Previous essay response" },
  { value: "other", label: "Other" },
] as const;

export const answerSchema = z.object({
  category: z.enum(ANSWER_CATEGORIES.map((c) => c.value) as [string, ...string[]]),
  title: z.string().trim().min(1, "Add a title").max(250),
  body: z.string().trim().min(10, "Write at least a sentence or two").max(20000),
  tags: z.array(z.string().trim().min(1).max(40)).max(15).default([]),
});

const hash = (s: string) => createHash("sha256").update(s).digest("hex");

async function upsertEmbedding(entry: typeof answerBankEntries.$inferSelect) {
  if (!embeddingsConfigured()) return;
  const text = `${entry.title}\n\n${entry.body}`;
  const h = hash(text);
  const [existing] = await db.select().from(answerBankEmbeddings).where(eq(answerBankEmbeddings.entryId, entry.id)).limit(1);
  if (existing && existing.contentHash === h && existing.model === embeddingModel()) return;
  const { vectors, provider, model } = await embed([text], "document");
  const v = vectors[0];
  await db
    .insert(answerBankEmbeddings)
    .values({ entryId: entry.id, userId: entry.userId, provider, model, dimensions: v.length, contentHash: h, embedding: v })
    .onConflictDoUpdate({ target: answerBankEmbeddings.entryId, set: { provider, model, dimensions: v.length, contentHash: h, embedding: v, createdAt: new Date() } });
}

export async function createAnswer(userId: string, input: z.input<typeof answerSchema>) {
  const data = answerSchema.parse(input);
  const [e] = await db.insert(answerBankEntries).values({ ...data, category: data.category as never, userId }).returning();
  await audit({ eventType: "answer_bank.created", actorId: userId, targetType: "answer_bank_entry", targetId: e.id });
  await upsertEmbedding(e).catch((err) => console.warn(JSON.stringify({ level: "warn", msg: "embedding failed", error: String(err) })));
  return e;
}

export async function updateAnswer(userId: string, id: string, input: z.input<typeof answerSchema>) {
  const data = answerSchema.parse(input);
  const [e] = await db
    .update(answerBankEntries)
    .set({ ...data, category: data.category as never, updatedAt: new Date() })
    .where(and(eq(answerBankEntries.id, id), eq(answerBankEntries.userId, userId), isNull(answerBankEntries.deletedAt)))
    .returning();
  if (!e) throw new NotFoundError("Entry");
  await upsertEmbedding(e).catch((err) => console.warn(JSON.stringify({ level: "warn", msg: "embedding failed", error: String(err) })));
  return e;
}

export async function deleteAnswer(userId: string, id: string) {
  const res = await db.update(answerBankEntries).set({ deletedAt: new Date() }).where(and(eq(answerBankEntries.id, id), eq(answerBankEntries.userId, userId))).returning({ id: answerBankEntries.id });
  if (!res[0]) throw new NotFoundError("Entry");
  await db.delete(answerBankEmbeddings).where(eq(answerBankEmbeddings.entryId, id));
  await audit({ eventType: "answer_bank.deleted", actorId: userId, targetType: "answer_bank_entry", targetId: id });
}

export async function listAnswers(userId: string, category?: string) {
  return db
    .select()
    .from(answerBankEntries)
    .where(and(eq(answerBankEntries.userId, userId), isNull(answerBankEntries.deletedAt), category ? eq(answerBankEntries.category, category as never) : undefined))
    .orderBy(desc(answerBankEntries.updatedAt));
}

const STOP = new Set("a an and are as at be by for from has have how i in is it of on or that the this to was what when where which who why will with you your about describe tell us explain words word essay".split(" "));

export function keywords(text: string): string[] {
  return [...new Set(text.toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? [])].filter((w) => !STOP.has(w)).slice(0, 40);
}

function whyRelevant(prompt: string, entry: { title: string; body: string; category: string; tags: string[] }, similarity: number | null): string {
  const pk = new Set(keywords(prompt));
  const shared = keywords(`${entry.title} ${entry.body} ${entry.tags.join(" ")}`).filter((w) => pk.has(w)).slice(0, 5);
  const cat = ANSWER_CATEGORIES.find((c) => c.value === entry.category)?.label.toLowerCase() ?? "story";
  const parts: string[] = [];
  if (similarity !== null) parts.push(`${Math.round(similarity * 100)}% semantic match`);
  if (shared.length) parts.push(`shares themes: ${shared.join(", ")}`);
  parts.push(`your ${cat} may help you answer this prompt in your own words`);
  return parts.join(" — ");
}

export interface AnswerMatch {
  id: string;
  title: string;
  category: string;
  excerpt: string;
  score: number;
  why: string;
}

/**
 * Searches ONLY the applicant's own answer bank. Uses pgvector cosine similarity when an
 * embeddings provider is configured; otherwise falls back to PostgreSQL full-text keyword search.
 */
export async function searchAnswerBank(userId: string, prompt: string, limit = 5): Promise<{ mode: "semantic" | "keyword"; matches: AnswerMatch[]; note?: string }> {
  const q = prompt.trim();
  if (q.length < 3) throw new AppError("Enter a prompt to search with.", 400);
  if (embeddingsConfigured()) {
    try {
      const model = embeddingModel();
      const h = hash(`${model}:${q}`);
      let [cached] = await db.select().from(promptEmbeddings).where(eq(promptEmbeddings.contentHash, h)).limit(1);
      if (!cached) {
        const { vectors } = await embed([q], "query");
        [cached] = await db.insert(promptEmbeddings).values({ contentHash: h, model, embedding: vectors[0] }).onConflictDoNothing().returning();
        cached ??= (await db.select().from(promptEmbeddings).where(eq(promptEmbeddings.contentHash, h)).limit(1))[0];
      }
      const vec = `[${cached.embedding.join(",")}]`;
      const rows = await db.execute<{ id: string; title: string; body: string; category: string; tags: string[]; similarity: number }>(sql`
        SELECT e.id, e.title, e.body, e.category, e.tags, 1 - (emb.embedding <=> ${vec}::vector) AS similarity
        FROM answer_bank_embeddings emb JOIN answer_bank_entries e ON e.id = emb.entry_id
        WHERE emb.user_id = ${userId} AND e.user_id = ${userId} AND e.deleted_at IS NULL
          AND emb.model = ${model} AND emb.dimensions = ${cached.embedding.length}
        ORDER BY emb.embedding <=> ${vec}::vector
        LIMIT ${limit}`);
      return {
        mode: "semantic",
        matches: [...rows].map((r) => ({ id: r.id, title: r.title, category: r.category, excerpt: r.body.slice(0, 280), score: Number(r.similarity), why: whyRelevant(q, r, Number(r.similarity)) })),
      };
    } catch (e) {
      console.warn(JSON.stringify({ level: "warn", msg: "semantic search failed, using keyword fallback", error: String(e) }));
    }
  }
  const words = keywords(q);
  if (!words.length) return { mode: "keyword", matches: [], note: "Keyword search: try a more specific prompt." };
  const tsq = words.map((w) => w.replace(/[^a-z]/g, "")).filter(Boolean).join(" | ");
  const rows = await db.execute<{ id: string; title: string; body: string; category: string; tags: string[]; rank: number }>(sql`
    SELECT id, title, body, category, tags,
      ts_rank(to_tsvector('english', title || ' ' || body || ' ' || array_to_string(tags, ' ')), to_tsquery('english', ${tsq})) AS rank
    FROM answer_bank_entries
    WHERE user_id = ${userId} AND deleted_at IS NULL
      AND to_tsvector('english', title || ' ' || body || ' ' || array_to_string(tags, ' ')) @@ to_tsquery('english', ${tsq})
    ORDER BY rank DESC LIMIT ${limit}`);
  return {
    mode: "keyword",
    note: "Keyword search (semantic search is not configured on this platform).",
    matches: [...rows].map((r) => ({ id: r.id, title: r.title, category: r.category, excerpt: r.body.slice(0, 280), score: Number(r.rank), why: whyRelevant(q, r, null) })),
  };
}

/** Cron: embed entries that don't have a current embedding yet. */
export async function backfillEmbeddings(limit = 50): Promise<number> {
  if (!embeddingsConfigured()) return 0;
  const rows = await db.execute<{ id: string }>(sql`
    SELECT e.id FROM answer_bank_entries e LEFT JOIN answer_bank_embeddings emb ON emb.entry_id = e.id
    WHERE e.deleted_at IS NULL AND (emb.entry_id IS NULL OR emb.model <> ${embeddingModel()}) LIMIT ${limit}`);
  let n = 0;
  for (const r of rows) {
    const [e] = await db.select().from(answerBankEntries).where(eq(answerBankEntries.id, r.id)).limit(1);
    if (e) {
      await upsertEmbedding(e);
      n++;
    }
  }
  return n;
}
