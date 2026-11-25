import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { generateMemberCode } from "@/lib/member-code";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Gives a verified user their permanent member ID, if they don't have one yet. Idempotent.
 * Retries on the (astronomically rare) collision with the unique index.
 */
export async function assignMemberCode(userId: string, tx: Tx | typeof db = db): Promise<string | null> {
  const [u] = await tx.select({ code: users.memberCode, verifiedAt: users.emailVerifiedAt }).from(users).where(eq(users.id, userId)).limit(1);
  if (!u) return null;
  if (u.code) return u.code;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateMemberCode(u.verifiedAt ?? new Date());
    try {
      const [row] = await tx.update(users).set({ memberCode: code }).where(and(eq(users.id, userId), isNull(users.memberCode))).returning({ code: users.memberCode });
      if (row) return row.code;
      const [again] = await tx.select({ code: users.memberCode }).from(users).where(eq(users.id, userId)).limit(1);
      return again?.code ?? null;
    } catch (e) {
      if ((e as { code?: string; cause?: { code?: string } }).code !== "23505" && (e as { cause?: { code?: string } }).cause?.code !== "23505") throw e;
    }
  }
  throw new Error("Could not generate a unique member ID");
}
