import { attachDatabasePool } from "@vercel/functions";
import type { SQLWrapper } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * PostgreSQL through node-postgres (`pg`). On Vercel, attachDatabasePool keeps a function instance alive until its
 * idle connections are closed, so no connection survives the instance being frozen between requests (a frozen-then-
 * dropped connection would otherwise make the next request hang until the platform timeout).
 */
type BaseDB = NodePgDatabase<typeof schema>;
/** Same API as drizzle's node-postgres database, except raw `execute` resolves to the row array. */
type DB = Omit<BaseDB, "execute" | "transaction"> & {
  execute<T extends Record<string, unknown> = Record<string, unknown>>(query: SQLWrapper | string): Promise<T[]>;
  transaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R>;
};
type BaseTx = Parameters<Parameters<BaseDB["transaction"]>[0]>[0];
export type Tx = Omit<BaseTx, "execute"> & {
  execute<T extends Record<string, unknown> = Record<string, unknown>>(query: SQLWrapper | string): Promise<T[]>;
};
export type DbOrTx = DB | Tx;

const globalForDb = globalThis as unknown as { __soarPool?: Pool; __soarDb?: DB };

/**
 * pg reads `sslmode` from the URL and treats "require" as full certificate verification, which managed poolers'
 * certificate chains can fail. Like libpq's "require", we encrypt without verifying the chain, so the URL's sslmode
 * is removed here and TLS is configured explicitly.
 */
function connectionConfig(): { connectionString: string; ssl?: { rejectUnauthorized: boolean } } {
  try {
    const url = new URL(env.DATABASE_URL);
    const mode = url.searchParams.get("sslmode");
    url.searchParams.delete("sslmode");
    const ssl = mode && mode !== "disable" ? { rejectUnauthorized: mode === "verify-full" || mode === "verify-ca" } : undefined;
    return { connectionString: url.toString(), ssl };
  } catch {
    return { connectionString: env.DATABASE_URL };
  }
}

function createPool(): Pool {
  const pool = new Pool({
    ...connectionConfig(),
    max: env.DATABASE_POOL_MAX,
    idleTimeoutMillis: process.env.VERCEL ? 5_000 : 20_000,
    connectionTimeoutMillis: 10_000, // fail fast instead of hanging if the database can't be reached
    maxLifetimeSeconds: 60 * 10,
  });
  pool.on("error", () => {
    // An idle client died (e.g. the pooler closed it). pg removes it from the pool; nothing else to do.
  });
  if (process.env.VERCEL) attachDatabasePool(pool);
  return pool;
}

/** Makes raw `execute` return rows (like postgres.js did), so callers can destructure / iterate directly. */
function rowsExecute<T extends { execute: BaseDB["execute"] }>(target: T) {
  const original = target.execute.bind(target);
  (target as unknown as { execute: unknown }).execute = async (query: SQLWrapper | string) => (await original(query as never)).rows;
  return target;
}

function createDb(pool: Pool): DB {
  const base = rowsExecute(drizzle(pool, { schema }));
  const originalTx = base.transaction.bind(base);
  (base as unknown as { transaction: unknown }).transaction = (fn: (tx: Tx) => Promise<unknown>, config?: never) =>
    originalTx((tx) => fn(rowsExecute(tx) as unknown as Tx), config);
  return base as unknown as DB;
}

const pool = globalForDb.__soarPool ?? createPool();
export const db: DB = globalForDb.__soarDb ?? createDb(pool);

/** Closes the pool (scripts call `sqlClient.end()` when they finish). */
export const sqlClient = { end: () => pool.end() };

if (process.env.NODE_ENV !== "production") {
  globalForDb.__soarPool = pool;
  globalForDb.__soarDb = db;
}

export { schema };
