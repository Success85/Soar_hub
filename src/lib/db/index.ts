import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

type DB = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __soarSql?: postgres.Sql; __soarDb?: DB };

export const sqlClient =
  globalForDb.__soarSql ??
  postgres(env.DATABASE_URL, {
    max: env.DATABASE_POOL_MAX,
    idle_timeout: 20,
    prepare: false, // compatible with Supabase transaction pooler (pgbouncer)
    onnotice: () => {},
  });

export const db: DB = globalForDb.__soarDb ?? drizzle(sqlClient, { schema });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__soarSql = sqlClient;
  globalForDb.__soarDb = db;
}

export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export type DbOrTx = DB | Tx;
export { schema };
