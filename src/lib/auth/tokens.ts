import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/** 256-bit cryptographically random URL-safe token. Only its HMAC is ever stored. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string): string {
  return createHmac("sha256", env.SESSION_SECRET).update(token).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export type TokenState = "valid" | "expired" | "used" | "revoked";

/** Pure validity check shared by auth tokens and referee links. */
export function tokenState(t: { expiresAt: Date; usedAt?: Date | null; revokedAt?: Date | null }, now = new Date()): TokenState {
  if (t.revokedAt) return "revoked";
  if (t.usedAt) return "used";
  if (t.expiresAt.getTime() <= now.getTime()) return "expired";
  return "valid";
}

/** HMAC signature for short-lived URLs (e.g. dev storage downloads). */
export function signPayload(payload: string): string {
  return createHmac("sha256", env.SESSION_SECRET).update(payload).digest("base64url");
}
