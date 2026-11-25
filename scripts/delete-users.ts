/**
 * Deletes accounts by email, the same way an approved privacy deletion request does: personal data is erased,
 * the email is renamed to deleted+<id>@deleted.invalid (so the address can register again), sessions are revoked,
 * and the audit history is kept.
 *
 *   npm run users:delete -- a@example.com b@example.com          → shows what would be deleted (nothing changes)
 *   npm run users:delete -- a@example.com b@example.com --yes    → deletes them
 *
 * Refuses to delete the last active admin or super admin.
 */
import "dotenv/config";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db, sqlClient } from "@/lib/db";
import { dataRequests, userRoles, users } from "@/lib/db/schema";
import { processDeletion } from "@/lib/services/privacy";

async function activeCount(role: "admin" | "super_admin", excluding: string[]) {
  const [r] = await db
    .select({ c: sql<number>`count(distinct ${users.id})::int` })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .where(and(eq(userRoles.role, role), eq(users.status, "active"), excluding.length ? sql`${users.id} NOT IN (${sql.join(excluding.map((id) => sql`${id}`), sql`, `)})` : sql`true`));
  return r.c;
}

async function main() {
  const args = process.argv.slice(2);
  const confirm = args.includes("--yes");
  const emails = [...new Set(args.filter((a) => !a.startsWith("--")).map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (!emails.length) {
    console.log("Usage: npm run users:delete -- someone@example.com [more emails] [--yes]");
    return;
  }
  const found = await db.select().from(users).where(and(inArray(sql`lower(${users.email})`, emails), ne(users.status, "deleted")));
  const byEmail = new Map(found.map((u) => [u.email.toLowerCase(), u]));
  for (const e of emails) if (!byEmail.has(e)) console.log(`not found  ${e}  (no active account with this email; it's already free to use)`);
  if (!found.length) return;

  const ids = found.map((u) => u.id);
  const roles = await db.select().from(userRoles).where(inArray(userRoles.userId, ids));
  for (const u of found) {
    const r = roles.filter((x) => x.userId === u.id).map((x) => x.role).join(", ");
    console.log(`${confirm ? "deleting  " : "would delete"}  ${u.email}  (${u.firstName} ${u.lastName}; roles: ${r || "none"}; member ID: ${u.memberCode ?? "—"})`);
  }
  for (const role of ["super_admin", "admin"] as const) {
    if (roles.some((r) => r.role === role) && (await activeCount(role, ids)) === 0) {
      console.error(`\nStopped: this would remove the last active ${role.replace("_", " ")}. Create another one first (npm run db:create-admin).`);
      process.exitCode = 1;
      return;
    }
  }
  if (!confirm) {
    console.log("\nNothing was changed. Run the same command with --yes at the end to delete these accounts.");
    return;
  }
  for (const u of found) {
    const [req] = await db.insert(dataRequests).values({ userId: u.id, type: "deletion", reason: "Deleted from the command line (scripts/delete-users.ts)" }).returning();
    await processDeletion(req.id, u.id, "complete", "Deleted from the command line (scripts/delete-users.ts)");
  }
  console.log(`\nDeleted ${found.length} account(s). Their email addresses can now be used to register again.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? `${e.message}${(e as { cause?: Error }).cause ? `\n  cause: ${(e as { cause?: Error }).cause?.message}` : ""}` : e);
    process.exitCode = 1;
  })
  .finally(() => sqlClient.end());
