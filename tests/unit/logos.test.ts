import { describe, expect, it } from "vitest";
import { schoolInitials } from "@/lib/school-initials";
import { MCF_SCHOLARSHIPS } from "@/lib/data/mcf-scholarships";
import { logoFor, logoSite } from "@/lib/data/school-logos";
import { candidates } from "../../scripts/logo-utils";

describe("school initials", () => {
  it("uses the acronym in brackets, or the first letters of the main words", () => {
    expect(schoolInitials("African Leadership University (ALU)")).toBe("ALU");
    expect(schoolInitials("United States International University-Africa (USIU-Africa)")).toBe("USIU");
    expect(schoolInitials("University of Cape Town")).toBe("UCT");
    expect(schoolInitials("Sciences Po")).toBe("SP");
    expect(schoolInitials("Université d'Abomey-Calavi")).toBe("UAC");
  });
  it("gives every dataset school 1–5 letters", () => {
    for (const s of MCF_SCHOLARSHIPS) expect(schoolInitials(s.university), s.university).toMatch(/^[A-Z0-9]{1,5}$/);
  });
});

describe("logo lookup", () => {
  it("does not use the Mastercard Foundation site as a school's logo source", () => {
    for (const s of MCF_SCHOLARSHIPS) expect(logoSite(s) ?? "", s.university).not.toContain("mastercardfdn.org");
  });
  it("returns null when no logo has been downloaded", () => {
    expect(logoFor({ university: "Nowhere University", officialUrl: "https://example.invalid" })).toBeNull();
  });
});

describe("logo candidates", () => {
  const html = `<html><head>
    <link rel="icon" href="/favicon.ico">
    <link rel="icon" type="image/png" sizes="32x32" href="/icon-32.png">
    <link rel="apple-touch-icon" sizes="180x180" href="https://cdn.example.edu/apple.png">
  </head><body><header><img class="site-logo" src="/img/logo.png" alt="Example University"><img src="/img/footer-logo-white.png" alt="logo"></header></body></html>`;
  const list = candidates(html, "https://www.example.edu/home");
  it("prefers the apple-touch-icon, then a header logo, and ignores .ico and white footer logos", () => {
    expect(list[0].url).toBe("https://cdn.example.edu/apple.png");
    expect(list.map((c) => c.url)).toContain("https://www.example.edu/img/logo.png");
    expect(list.some((c) => c.url.endsWith(".ico"))).toBe(false);
    expect(list.some((c) => c.url.includes("white"))).toBe(false);
  });
  it("always falls back to /apple-touch-icon.png", () => {
    expect(candidates("<html></html>", "https://x.edu/")[0].url).toBe("https://x.edu/apple-touch-icon.png");
  });
});
