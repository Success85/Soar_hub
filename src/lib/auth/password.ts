import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number, opts: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

/** scrypt (memory-hard KDF, Node built-in). Format: scrypt$N$r$p$saltB64$hashB64 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize("NFKC"), salt, KEYLEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return ["scrypt", N, R, P, salt.toString("base64"), hash.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password.normalize("NFKC"), Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Returns a list of problems; empty when acceptable. */
export function passwordProblems(pw: string, context: string[] = []): string[] {
  const problems: string[] = [];
  if (pw.length < 10) problems.push("Use at least 10 characters.");
  if (pw.length > 128) problems.push("Use at most 128 characters.");
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) problems.push("Include at least one letter and one number.");
  const lower = pw.toLowerCase();
  if (["password", "12345678", "qwerty", "soarhub", "scholarship"].some((w) => lower.includes(w))) problems.push("Avoid common words like “password”.");
  for (const c of context) if (c && c.length >= 3 && lower.includes(c.toLowerCase())) problems.push("Don't include your name or email in your password.");
  return [...new Set(problems)];
}
