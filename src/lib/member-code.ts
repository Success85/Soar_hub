import { randomInt } from "node:crypto";

/** No look-alike characters: no 0/O, 1/I/L. */
export const MEMBER_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const MEMBER_CODE_PATTERN = /^SOAR-\d{2}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;

/** A member ID such as "SOAR-26-7K4QXM": the year the member joined, then 6 random characters (~887 million options per year). */
export function generateMemberCode(joined: Date = new Date()): string {
  const yy = String(joined.getUTCFullYear() % 100).padStart(2, "0");
  let tail = "";
  for (let i = 0; i < 6; i++) tail += MEMBER_CODE_ALPHABET[randomInt(MEMBER_CODE_ALPHABET.length)];
  return `SOAR-${yy}-${tail}`;
}

/** Accepts what people type ("soar 26 7k4qxm", "SOAR267K4QXM") and returns the canonical form, or null. */
export function normaliseMemberCode(input: string): string | null {
  const s = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const m = /^SOAR(\d{2})([A-Z0-9]{6})$/.exec(s);
  if (!m) return null;
  const code = `SOAR-${m[1]}-${m[2]}`;
  return MEMBER_CODE_PATTERN.test(code) ? code : null;
}
