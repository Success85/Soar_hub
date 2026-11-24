import "server-only";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { authTokens, consents, notificationPreferences, profiles, userRoles, users } from "@/lib/db/schema";
import { hashPassword, passwordProblems, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, revokeAllSessions } from "@/lib/auth/session";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { idempotencyKey } from "@/lib/engine/notification-keys";
import { AppError } from "@/lib/errors";
import type { RequestMeta } from "@/lib/request";
import { audit } from "./audit";
import { appUrl, dispatchNow, enqueueNotification } from "./notifications";
import { rateLimit } from "./rate-limit";
import { getSettings } from "./settings";

const VERIFY_HOURS = 24;
const RESET_MINUTES = 60;
const LOCK_AFTER = 8;
const LOCK_MINUTES = 15;

export const registerSchema = z
  .object({
    firstName: z.string().trim().min(1, "Enter your first name").max(100),
    lastName: z.string().trim().min(1, "Enter your last name").max(100),
    email: z.string().trim().toLowerCase().email("Enter a valid email address").max(320),
    password: z.string().min(1, "Choose a password").max(128),
    confirmPassword: z.string(),
    privacyConsent: z.literal(true, { message: "Please accept the privacy policy" }),
    termsConsent: z.literal(true, { message: "Please accept the terms of service" }),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" });

export type RegisterInput = z.infer<typeof registerSchema>;

export async function register(input: RegisterInput, meta: RequestMeta): Promise<{ userId: string }> {
  const settings = await getSettings();
  if (!settings.registration_open) throw new AppError("Registration is currently closed. Please check back soon.", 403);
  await rateLimit(`register:${meta.ip ?? "unknown"}`, 10, 3600);
  const problems = passwordProblems(input.password, [input.firstName, input.lastName, input.email.split("@")[0]]);
  if (problems.length) throw new AppError(problems[0], 400, "weak_password", { password: problems.join(" ") });

  const existing = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${input.email}`).limit(1);
  if (existing[0]) throw new AppError("An account with this email already exists. Try signing in or resetting your password.", 409, "email_taken", { email: "This email is already registered." });

  const passwordHash = await hashPassword(input.password);
  const userId = await db.transaction(async (tx) => {
    const [u] = await tx.insert(users).values({ email: input.email, passwordHash, firstName: input.firstName, lastName: input.lastName }).returning({ id: users.id });
    await tx.insert(userRoles).values({ userId: u.id, role: "applicant" });
    await tx.insert(profiles).values({ userId: u.id });
    await tx.insert(notificationPreferences).values({ userId: u.id });
    await tx.insert(consents).values([
      { userId: u.id, type: "privacy", version: settings.privacy_version, ip: meta.ip },
      { userId: u.id, type: "terms", version: settings.terms_version, ip: meta.ip },
    ]);
    await audit({ eventType: "account.created", actorId: u.id, actorRole: "applicant", targetType: "user", targetId: u.id, metadata: { email: input.email }, ...meta }, tx);
    return u.id;
  });
  await sendVerificationEmail(userId);
  await createSession(userId, meta);
  return { userId };
}

export async function sendVerificationEmail(userId: string): Promise<void> {
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u || u.emailVerifiedAt) return;
  await rateLimit(`verify-email:${userId}`, 5, 3600);
  const token = generateToken();
  const [row] = await db
    .insert(authTokens)
    .values({ userId, type: "email_verification", tokenHash: hashToken(token), expiresAt: new Date(Date.now() + VERIFY_HOURS * 3_600_000) })
    .returning({ id: authTokens.id });
  const id = await enqueueNotification({
    templateKey: "auth.verify_email",
    channel: "email",
    userId,
    transactional: true,
    idempotencyKey: idempotencyKey(["auth.verify_email", row.id]),
    vars: { firstName: u.firstName },
    actionUrl: appUrl(`/verify-email?token=${token}`),
  });
  await dispatchNow(id);
}

export async function verifyEmail(token: string, meta: RequestMeta): Promise<"verified" | "expired" | "invalid"> {
  const [row] = await db
    .select()
    .from(authTokens)
    .where(and(eq(authTokens.tokenHash, hashToken(token)), eq(authTokens.type, "email_verification")))
    .limit(1);
  if (!row || row.usedAt) return "invalid";
  if (row.expiresAt.getTime() < Date.now()) return "expired";
  await db.transaction(async (tx) => {
    await tx.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, row.id));
    await tx.update(users).set({ emailVerifiedAt: new Date(), updatedAt: new Date() }).where(and(eq(users.id, row.userId), isNull(users.emailVerifiedAt)));
    await audit({ eventType: "account.email_verified", actorId: row.userId, targetType: "user", targetId: row.userId, ...meta }, tx);
  });
  return "verified";
}

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export async function login(input: z.infer<typeof loginSchema>, meta: RequestMeta): Promise<{ userId: string; verified: boolean }> {
  await rateLimit(`login:ip:${meta.ip ?? "unknown"}`, 30, 900);
  await rateLimit(`login:email:${input.email}`, 10, 900);
  const generic = new AppError("That email and password combination didn't work.", 401, "invalid_credentials");
  const [u] = await db.select().from(users).where(sql`lower(${users.email}) = ${input.email}`).limit(1);
  if (!u) {
    await hashPassword(input.password); // equalise timing
    throw generic;
  }
  if (u.lockedUntil && u.lockedUntil.getTime() > Date.now()) {
    throw new AppError("Too many failed attempts. Your account is temporarily locked — try again in a few minutes or reset your password.", 423, "locked");
  }
  const ok = await verifyPassword(input.password, u.passwordHash);
  if (!ok) {
    const failed = u.failedLoginCount + 1;
    await db
      .update(users)
      .set({ failedLoginCount: failed, lockedUntil: failed >= LOCK_AFTER ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null })
      .where(eq(users.id, u.id));
    await audit({ eventType: "auth.login_failed", actorId: u.id, targetType: "user", targetId: u.id, metadata: { failed }, ...meta });
    throw generic;
  }
  if (u.status === "suspended") throw new AppError("This account has been suspended. Please contact support.", 403, "suspended");
  if (u.status === "deleted" || u.deletedAt) throw generic;
  await db.update(users).set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(users.id, u.id));
  await createSession(u.id, meta);
  await audit({ eventType: "auth.login", actorId: u.id, targetType: "user", targetId: u.id, ...meta });
  return { userId: u.id, verified: !!u.emailVerifiedAt };
}

export async function logout(userId: string | null, meta: RequestMeta): Promise<void> {
  await destroySession();
  if (userId) await audit({ eventType: "auth.logout", actorId: userId, targetType: "user", targetId: userId, ...meta });
}

/** Always succeeds from the caller's perspective (no account enumeration). */
export async function requestPasswordReset(email: string, meta: RequestMeta): Promise<void> {
  await rateLimit(`reset:ip:${meta.ip ?? "unknown"}`, 10, 3600);
  await rateLimit(`reset:email:${email.toLowerCase()}`, 3, 3600);
  const [u] = await db.select().from(users).where(sql`lower(${users.email}) = ${email.toLowerCase()}`).limit(1);
  if (!u || u.status !== "active") return;
  const token = generateToken();
  // invalidate older outstanding reset tokens
  await db.update(authTokens).set({ usedAt: new Date() }).where(and(eq(authTokens.userId, u.id), eq(authTokens.type, "password_reset"), isNull(authTokens.usedAt)));
  const [row] = await db
    .insert(authTokens)
    .values({ userId: u.id, type: "password_reset", tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_MINUTES * 60_000) })
    .returning({ id: authTokens.id });
  const id = await enqueueNotification({
    templateKey: "auth.password_reset",
    channel: "email",
    userId: u.id,
    transactional: true,
    idempotencyKey: idempotencyKey(["auth.password_reset", row.id]),
    vars: { firstName: u.firstName },
    actionUrl: appUrl(`/reset-password?token=${token}`),
  });
  await dispatchNow(id);
  await audit({ eventType: "auth.password_reset_requested", actorId: u.id, targetType: "user", targetId: u.id, ...meta });
}

export async function checkResetToken(token: string): Promise<boolean> {
  const [row] = await db
    .select({ id: authTokens.id })
    .from(authTokens)
    .where(and(eq(authTokens.tokenHash, hashToken(token)), eq(authTokens.type, "password_reset"), isNull(authTokens.usedAt), gt(authTokens.expiresAt, new Date())))
    .limit(1);
  return !!row;
}

export async function resetPassword(token: string, password: string, meta: RequestMeta): Promise<void> {
  await rateLimit(`reset-submit:${meta.ip ?? "unknown"}`, 20, 3600);
  const [row] = await db
    .select()
    .from(authTokens)
    .where(and(eq(authTokens.tokenHash, hashToken(token)), eq(authTokens.type, "password_reset")))
    .limit(1);
  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) throw new AppError("This reset link is invalid or has expired. Please request a new one.", 400, "invalid_token");
  const [u] = await db.select().from(users).where(eq(users.id, row.userId)).limit(1);
  const problems = passwordProblems(password, [u.firstName, u.lastName, u.email.split("@")[0]]);
  if (problems.length) throw new AppError(problems[0], 400, "weak_password", { password: problems.join(" ") });
  const passwordHash = await hashPassword(password);
  await db.transaction(async (tx) => {
    await tx.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, row.id));
    // completing a reset proves mailbox ownership, so it also verifies the email
    await tx.update(users).set({ passwordHash, failedLoginCount: 0, lockedUntil: null, emailVerifiedAt: u.emailVerifiedAt ?? new Date(), updatedAt: new Date() }).where(eq(users.id, u.id));
    await audit({ eventType: "auth.password_reset", actorId: u.id, targetType: "user", targetId: u.id, ...meta }, tx);
  });
  await revokeAllSessions(u.id);
  await enqueueNotification({ templateKey: "auth.password_changed", channel: "email", userId: u.id, transactional: true, idempotencyKey: idempotencyKey(["auth.password_changed", row.id]), vars: { firstName: u.firstName } });
}

export async function changePassword(userId: string, current: string, next: string, meta: RequestMeta): Promise<void> {
  await rateLimit(`change-password:${userId}`, 10, 3600);
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u || !(await verifyPassword(current, u.passwordHash))) throw new AppError("Your current password is incorrect.", 400, "invalid_password", { currentPassword: "Incorrect password" });
  const problems = passwordProblems(next, [u.firstName, u.lastName, u.email.split("@")[0]]);
  if (problems.length) throw new AppError(problems[0], 400, "weak_password", { newPassword: problems.join(" ") });
  await db.update(users).set({ passwordHash: await hashPassword(next), updatedAt: new Date() }).where(eq(users.id, userId));
  await revokeAllSessions(userId);
  await createSession(userId, meta);
  await audit({ eventType: "auth.password_changed", actorId: userId, targetType: "user", targetId: userId, ...meta });
  await enqueueNotification({ templateKey: "auth.password_changed", channel: "email", userId, transactional: true, idempotencyKey: idempotencyKey(["auth.password_changed", userId, Date.now()]), vars: { firstName: u.firstName } });
}
