import { execSync } from "node:child_process";
import postgres from "postgres";

/** Rebuilds the test database from migrations. (TRUNCATE is blocked on audit_logs by design.) */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://soar:soar@localhost:5432/soar_hub_test";
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await sql.unsafe("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
  await sql.end();
  execSync("npx tsx scripts/migrate.ts", { env: { ...process.env, DATABASE_URL: url }, stdio: "inherit" });
  execSync("npx tsx --require ./scripts/stub-server-only.cjs scripts/seed.ts", { env: { ...process.env, DATABASE_URL: url, SEED_DEMO: "false" }, stdio: "inherit" });
  execSync("rm -rf .dev-storage-test");
}
