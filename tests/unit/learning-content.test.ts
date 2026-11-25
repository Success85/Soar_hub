import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FAQ_SECTIONS, HOME_FAQ } from "@/lib/data/faq";
import { LEARNING_RESOURCES } from "@/lib/data/learning-resources";

const pub = (url: string) => join(process.cwd(), "public", url);
const memberFile = (url: string) => join(process.cwd(), "content", url); // /downloads/x → content/downloads/x (served to members only)

describe("learning resources dataset", () => {
  it("every resource has a member-only file and a public preview that exist", () => {
    for (const r of LEARNING_RESOURCES) {
      expect(r.file.url.startsWith("/downloads/"), r.slug).toBe(true);
      expect(existsSync(memberFile(r.file.url)), r.file.url).toBe(true);
      expect(existsSync(pub(r.file.preview)), r.file.preview).toBe(true);
      expect(r.body.length, r.slug).toBeGreaterThan(800);
    }
  });
  it("slugs are unique", () => {
    expect(new Set(LEARNING_RESOURCES.map((r) => r.slug)).size).toBe(LEARNING_RESOURCES.length);
  });
});

describe("FAQ", () => {
  const items = FAQ_SECTIONS.flatMap((s) => s.items);
  it("has unique anchors across sections and items", () => {
    const ids = [...FAQ_SECTIONS.map((s) => s.id), ...items.map((i) => i.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("internal links point at pages that exist", () => {
    const known = ["/guide", "/register", "/membership", "/scholarships", "/privacy", "/contact", ...LEARNING_RESOURCES.map((r) => `/resources/${r.slug}`)];
    for (const i of items) {
      for (const [, href] of i.a.matchAll(/\]\((\/[^)#]*)/g)) expect(known, `${i.id} → ${href}`).toContain(href);
    }
  });
  it("features a short selection on the home page", () => {
    expect(HOME_FAQ.length).toBeGreaterThanOrEqual(4);
    expect(HOME_FAQ.length).toBeLessThanOrEqual(8);
  });
});
