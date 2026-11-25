/**
 * Securely creates (or promotes) a super administrator. Never commit credentials.
 *
 *   ADMIN_EMAIL=you@org.ng ADMIN_FIRST_NAME=Ada ADMIN_LAST_NAME=Obi npm run db:create-admin
 *
 * The password is read from ADMIN_PASSWORD if set; otherwise a strong random password is
 * generated and printed once. Change it after first login.
 */
import "dotenv/config";
import { assignMemberCode } from "@/lib/services/member-code";
import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db, sqlClient } from "@/lib/db";
import { auditLogs, consents, notificationPreferences, profiles, userRoles, users } from "@/lib/db/schema";
import { hashPassword, passwordProblems } from "@/lib/auth/password";

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error("Set ADMIN_EMAIL to a valid email address.");
  const first = process.env.ADMIN_FIRST_NAME?.trim() || "Platform";
  const last = process.env.ADMIN_LAST_NAME?.trim() || "Administrator";
  const generated = !process.env.ADMIN_PASSWORD;
  const password = process.env.ADMIN_PASSWORD ?? `${randomBytes(12).toString("base64url")}9a`;
  const problems = passwordProblems(password, [first, last]);
  if (problems.length) throw new Error(`ADMIN_PASSWORD is too weak: ${problems.join(" ")}`);

  const [existing] = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
  let id = existing?.id;
  if (!id) {
    const [u] = await db.insert(users).values({ email, firstName: first, lastName: last, passwordHash: await hashPassword(password), emailVerifiedAt: new Date() }).returning();
    id = u.id;
    await db.insert(profiles).values({ userId: id });
    await db.insert(notificationPreferences).values({ userId: id });
    await db.insert(consents).values([{ userId: id, type: "privacy", version: "admin" }, { userId: id, type: "terms", version: "admin" }]);
  } else if (process.env.ADMIN_PASSWORD) {
    await db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, id));
  }
  await assignMemberCode(id);
  for (const role of ["super_admin", "admin", "reviewer"] as const) await db.insert(userRoles).values({ userId: id, role }).onConflictDoNothing();
  await db.insert(auditLogs).values({ eventType: "role.granted", actorRole: "cli", targetType: "user", targetId: id, newState: { roles: ["super_admin", "admin", "reviewer"] }, metadata: { via: "create-admin script" } });
  console.log(`Super administrator ready: ${email}`);
  if (generated && !existing) console.log(`Temporary password (shown once): ${password}`);
  await sqlClient.end();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await sqlClient.end();
  process.exit(1);
});
