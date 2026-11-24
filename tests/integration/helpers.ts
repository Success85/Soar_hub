import { readFileSync, existsSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { consents, notificationPreferences, profiles, userRoles, users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { loadAccess, type CurrentUser } from "@/lib/auth/session";
import type { Role } from "@/lib/auth/permissions";

let n = 0;
export async function makeUser(roles: Role[] = ["applicant"], profile: Partial<typeof profiles.$inferInsert> = {}): Promise<CurrentUser> {
  n++;
  const email = `user${Date.now()}${n}@test.soar`;
  const [u] = await db.insert(users).values({ email, firstName: `First${n}`, lastName: `Last${n}`, passwordHash: await hashPassword("Test-password-123"), emailVerifiedAt: new Date() }).returning();
  for (const role of roles) await db.insert(userRoles).values({ userId: u.id, role });
  await db.insert(profiles).values({ userId: u.id, ...profile });
  await db.insert(notificationPreferences).values({ userId: u.id });
  await db.insert(consents).values({ userId: u.id, type: "data_processing", version: "t" });
  const access = await loadAccess(u.id);
  return { id: u.id, email, firstName: u.firstName, lastName: u.lastName, emailVerified: true, status: "active", roles: access.roles, permissions: access.permissions, sessionId: "test" };
}

export function outboxLinks(to: string): string[] {
  const f = `${process.cwd()}/.dev-storage-test/outbox.jsonl`;
  if (!existsSync(f)) return [];
  return readFileSync(f, "utf8")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l) as { to: string; text: string })
    .filter((m) => m.to === to)
    .flatMap((m) => m.text.match(/https?:\/\/\S+/g) ?? []);
}

export const ELIGIBLE_PROFILE = { dateOfBirth: "2006-03-01", countryOfCitizenship: "Nigeria", educationLevel: "secondary_completed" as const, qualifications: ["WASSCE"], creditPasses: 7, demonstratesFinancialNeed: true };

export function pdf(name = "file.pdf", body = "%PDF-1.4\nhello world") {
  return new File([Buffer.from(body)], name, { type: "application/pdf" });
}

export async function count(table: string, where = "true") {
  const [r] = await db.execute<{ c: number }>(sql.raw(`SELECT count(*)::int AS c FROM ${table} WHERE ${where}`));
  return r.c;
}

export { db, eq };
