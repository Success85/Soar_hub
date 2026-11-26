import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

type DB = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __soarSql?: postgres.Sql; __soarDb?: DB };

/** Seconds a connection may stay unused before it is closed. */
const IDLE_SECONDS = process.env.VERCEL ? 5 : 20;

/**
 * Serverless hosts (Vercel) freeze a function instance between requests. A connection left open while frozen is
 * silently dropped by the database pooler, and the next request would wait on that dead socket until the platform
 * timeout. So on Vercel, after every query we ask the platform to keep the instance alive (waitUntil) until the pool's
 * idle connections have been closed: no connection ever survives a freeze. This mirrors @vercel/functions'
 * attachDatabasePool, which supports `pg` but not postgres.js.
 */
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let releaseIdle: (() => void) | null = null;
function keepAliveUntilIdle() {
  if (!process.env.VERCEL) return;
  if (idleTimer) clearTimeout(idleTimer);
  if (!releaseIdle) {
    const done = new Promise<void>((resolve) => (releaseIdle = resolve));
    import("@vercel/functions")
      .then(({ waitUntil }) => waitUntil(done))
      .catch(() => undefined);
  }
  idleTimer = setTimeout(() => {
    idleTimer = null;
    const r = releaseIdle;
    releaseIdle = null;
    r?.();
  }, (IDLE_SECONDS + 2) * 1000);
}

export const sqlClient =
  globalForDb.__soarSql ??
  postgres(env.DATABASE_URL, {
    max: env.DATABASE_POOL_MAX,
    idle_timeout: IDLE_SECONDS,
    max_lifetime: 60 * 10,
    connect_timeout: 10, // fail fast instead of hanging if the database can't be reached
    prepare: false, // compatible with Supabase transaction pooler (pgbouncer / Supavisor)
    onnotice: () => {},
    debug: process.env.VERCEL ? () => keepAliveUntilIdle() : undefined,
  });

export const db: DB = globalForDb.__soarDb ?? drizzle(sqlClient, { schema });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__soarSql = sqlClient;
  globalForDb.__soarDb = db;
}

export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export type DbOrTx = DB | Tx;
export { schema };
