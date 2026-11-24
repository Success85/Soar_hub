import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";

/**
 * Fixed-window rate limiter backed by PostgreSQL, so limits hold across serverless instances.
 * Returns remaining requests; throws AppError(429) when exceeded.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<number> {
  if (process.env.DISABLE_RATE_LIMIT === "true" && process.env.NODE_ENV !== "production") return limit;
  const windowStart = new Date(Math.floor(Date.now() / (windowSeconds * 1000)) * windowSeconds * 1000);
  const rows = await db.execute<{ count: number }>(sql`
    INSERT INTO rate_limits (key, window_start, count) VALUES (${key}, ${windowStart.toISOString()}::timestamptz, 1)
    ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
    RETURNING count`);
  const count = Number(rows[0]?.count ?? 1);
  if (count > limit) {
    throw new AppError("Too many attempts. Please wait a few minutes and try again.", 429, "rate_limited");
  }
  return limit - count;
}

export async function purgeRateLimits(): Promise<void> {
  await db.execute(sql`DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'`);
}
