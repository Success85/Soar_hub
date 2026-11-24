import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { rolePermissions, sessions, userRoles, users } from "@/lib/db/schema";
import { env, isProd } from "@/lib/env";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import type { RequestMeta } from "@/lib/request";
import { generateToken, hashToken } from "./tokens";
import { can, type Permission, type Role } from "./permissions";

export const SESSION_COOKIE = isProd ? "__Host-soar_session" : "soar_session";

export interface CurrentUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  status: string;
  roles: Role[];
  permissions: Set<string>;
  sessionId: string;
}

export async function createSession(userId: string, meta: RequestMeta): Promise<void> {
  const token = generateToken();
  const now = new Date();
  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    lastSeenAt: now,
    expiresAt: new Date(now.getTime() + env.SESSION_ABSOLUTE_HOURS * 3_600_000),
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: env.SESSION_ABSOLUTE_HOURS * 3600,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenHash, hashToken(token)));
  }
  jar.delete(SESSION_COOKIE);
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await db.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}

export async function loadAccess(userId: string): Promise<{ roles: Role[]; permissions: Set<string> }> {
  const roleRows = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, userId));
  const roles = roleRows.map((r) => r.role as Role);
  const permRows = roles.length
    ? await db.select({ permission: rolePermissions.permission }).from(rolePermissions).where(inArray(rolePermissions.role, roles))
    : [];
  return { roles, permissions: new Set(permRows.map((p) => p.permission)) };
}

/** Resolves the signed-in user for this request (memoised per request). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.tokenHash, hashToken(token)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const now = Date.now();
  const idleLimit = env.SESSION_IDLE_MINUTES * 60_000;
  if (
    row.session.revokedAt ||
    row.session.expiresAt.getTime() <= now ||
    now - row.session.lastSeenAt.getTime() > idleLimit ||
    row.user.status !== "active" ||
    row.user.deletedAt
  ) {
    return null;
  }
  // sliding idle expiry (throttled to one write per minute)
  if (now - row.session.lastSeenAt.getTime() > 60_000) {
    await db.update(sessions).set({ lastSeenAt: new Date(now) }).where(eq(sessions.id, row.session.id));
  }
  const access = await loadAccess(row.user.id);
  return {
    id: row.user.id,
    email: row.user.email,
    firstName: row.user.firstName,
    lastName: row.user.lastName,
    emailVerified: !!row.user.emailVerifiedAt,
    status: row.user.status,
    roles: access.roles,
    permissions: access.permissions,
    sessionId: row.session.id,
  };
});

/** For pages/layouts: redirects to login (or verification) instead of throwing. */
export async function requireUser(opts: { verified?: boolean; next?: string } = {}): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login${opts.next ? `?next=${encodeURIComponent(opts.next)}` : ""}`);
  if (opts.verified !== false && !user.emailVerified) redirect("/verify-email/pending");
  return user;
}

export async function requirePermissionPage(permission: Permission, next?: string): Promise<CurrentUser> {
  const user = await requireUser({ next });
  if (!can(user.permissions, permission)) redirect("/forbidden");
  return user;
}

/** For server actions / route handlers: throws typed errors. */
export async function assertUser(opts: { verified?: boolean } = {}): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  if (opts.verified !== false && !user.emailVerified) throw new ForbiddenError("Please verify your email address first.");
  return user;
}

export async function assertPermission(permission: Permission): Promise<CurrentUser> {
  const user = await assertUser();
  if (!can(user.permissions, permission)) throw new ForbiddenError();
  return user;
}

export function hasPerm(user: CurrentUser | null, permission: Permission): boolean {
  return !!user && can(user.permissions, permission);
}

export function primaryRole(user: CurrentUser): Role {
  if (user.roles.includes("super_admin")) return "super_admin";
  if (user.roles.includes("admin")) return "admin";
  if (user.roles.includes("reviewer")) return "reviewer";
  return "applicant";
}
