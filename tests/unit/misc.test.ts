import { describe, expect, it } from "vitest";
import { can, DEFAULT_ROLE_PERMISSIONS, redactProfile } from "@/lib/auth/permissions";
import { hashPassword, passwordProblems, verifyPassword } from "@/lib/auth/password";
import { generateToken, hashToken, tokenState } from "@/lib/auth/tokens";
import { countWords, safeFilename, sniffKind, validateUpload } from "@/lib/engine/file-validation";
import { idempotencyKey, MAX_ATTEMPTS, nextRetryAt, renderTemplate } from "@/lib/engine/notification-keys";

describe("notification idempotency & retries", () => {
  it("builds stable keys", () => {
    expect(idempotencyKey(["milestone", "abc", "2026-11-30", 7, "email"])).toBe("milestone:abc:2026-11-30:7:email");
    expect(idempotencyKey(["a b", null])).toBe("a_b:-");
  });
  it("retries at 5, 15, 60 minutes then gives up", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(nextRetryAt(1, now)!.toISOString()).toBe("2026-01-01T00:05:00.000Z");
    expect(nextRetryAt(2, now)!.toISOString()).toBe("2026-01-01T00:15:00.000Z");
    expect(nextRetryAt(3, now)!.toISOString()).toBe("2026-01-01T01:00:00.000Z");
    expect(nextRetryAt(4, now)).toBeNull();
    expect(MAX_ATTEMPTS).toBe(4);
  });
  it("renders templates safely", () => {
    expect(renderTemplate("Hi {{ firstName }} {{missing}}!", { firstName: "Ada" })).toBe("Hi Ada !");
  });
});

describe("tokens", () => {
  it("are random and hashed", () => {
    const a = generateToken();
    expect(a).not.toBe(generateToken());
    expect(a.length).toBeGreaterThanOrEqual(43);
    expect(hashToken(a)).toHaveLength(64);
    expect(hashToken(a)).toBe(hashToken(a));
  });
  it("expire, are single-use and revocable", () => {
    const now = new Date("2026-01-10T00:00:00Z");
    expect(tokenState({ expiresAt: new Date("2026-01-11T00:00:00Z") }, now)).toBe("valid");
    expect(tokenState({ expiresAt: new Date("2026-01-09T00:00:00Z") }, now)).toBe("expired");
    expect(tokenState({ expiresAt: new Date("2026-01-11T00:00:00Z"), usedAt: now }, now)).toBe("used");
    expect(tokenState({ expiresAt: new Date("2026-01-11T00:00:00Z"), revokedAt: now }, now)).toBe("revoked");
  });
});

describe("passwords", () => {
  it("hash and verify with scrypt", async () => {
    const h = await hashPassword("correct horse 42");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse 42", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
  });
  it("enforce policy", () => {
    expect(passwordProblems("short1")).not.toHaveLength(0);
    expect(passwordProblems("nonumbersatall")).not.toHaveLength(0);
    expect(passwordProblems("adaobi2026xyz", ["adaobi"])).not.toHaveLength(0);
    expect(passwordProblems("Blue-river-77")).toHaveLength(0);
  });
});

describe("permissions", () => {
  it("applicants cannot access admin", () => {
    expect(can(DEFAULT_ROLE_PERMISSIONS.applicant, "admin.access")).toBe(false);
    expect(can(DEFAULT_ROLE_PERMISSIONS.reviewer, "scholarships.manage")).toBe(false);
    expect(can(DEFAULT_ROLE_PERMISSIONS.admin, "scholarships.manage")).toBe(true);
  });
  it("sensitive data is super-admin by default", () => {
    expect(can(DEFAULT_ROLE_PERMISSIONS.admin, "applicants.view_sensitive")).toBe(false);
    expect(can(DEFAULT_ROLE_PERMISSIONS.super_admin, "applicants.view_sensitive")).toBe(true);
  });
  it("redacts sensitive profile fields", () => {
    const r = redactProfile({ firstName: "A", hasDisability: true, phone: null }, false);
    expect(r.hasDisability).toBe("[restricted]");
    expect(r.phone).toBeNull();
    expect(redactProfile({ hasDisability: true }, true).hasDisability).toBe(true);
  });
});

describe("document validation", () => {
  const pdf = Buffer.from("%PDF-1.7\n...");
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
  const base = { maxBytes: 10 * 1024 * 1024, allowed: ["pdf", "docx", "jpeg", "png"] as const };
  it("sniffs magic bytes", () => {
    expect(sniffKind(pdf)).toBe("pdf");
    expect(sniffKind(png)).toBe("png");
    expect(sniffKind(Buffer.from("hello"))).toBeNull();
  });
  it("accepts valid files", () => {
    expect(validateUpload({ ...base, allowed: [...base.allowed], filename: "t.pdf", declaredMime: "application/pdf", size: pdf.length, bytes: pdf })).toMatchObject({ ok: true, kind: "pdf" });
  });
  it("rejects oversize, wrong extension, spoofed contents and mismatched MIME", () => {
    const allowed = [...base.allowed];
    expect(validateUpload({ ...base, allowed, filename: "t.pdf", declaredMime: "application/pdf", size: 11 * 1024 * 1024, bytes: pdf }).ok).toBe(false);
    expect(validateUpload({ ...base, allowed, filename: "t.exe", declaredMime: "application/pdf", size: 10, bytes: pdf }).ok).toBe(false);
    expect(validateUpload({ ...base, allowed, filename: "t.pdf", declaredMime: "application/pdf", size: 5, bytes: Buffer.from("MZ...") }).ok).toBe(false);
    expect(validateUpload({ ...base, allowed, filename: "t.png", declaredMime: "image/png", size: pdf.length, bytes: pdf }).ok).toBe(false);
    expect(validateUpload({ ...base, allowed, filename: "t.pdf", declaredMime: "image/png", size: pdf.length, bytes: pdf }).ok).toBe(false);
    expect(validateUpload({ ...base, allowed: ["pdf"], filename: "t.png", declaredMime: "image/png", size: png.length, bytes: png }).ok).toBe(false);
  });
  it("sanitises names and counts words", () => {
    expect(safeFilename("../../etc/pass wd<>.pdf")).toBe(".._.._etc_pass wd__.pdf");
    expect(countWords("  one two\nthree  ")).toBe(3);
    expect(countWords("")).toBe(0);
  });
});
