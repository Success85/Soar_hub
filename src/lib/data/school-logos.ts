/**
 * School logos. Files live in /public/logos/<hostname>.png and are listed in school-logos.json,
 * which `npm run logos:fetch` writes (it downloads each school's icon from its official website).
 * To use your own image instead, save it as public/logos/<hostname>.png and add it to the JSON.
 */
import manifest from "./school-logos.json";

/** Where to look for a logo when the scholarship's official link is not the school's own website. null = no website known. */
export const LOGO_SITE_OVERRIDES: Record<string, string | null> = {
  "Queen's University": "https://www.queensu.ca",
  "National University of Agriculture (UNA)": null,
};

export function logoSite(s: { university: string; officialUrl: string }): string | null {
  return s.university in LOGO_SITE_OVERRIDES ? LOGO_SITE_OVERRIDES[s.university] : s.officialUrl;
}

export const hostOf = (url: string) => new URL(url).hostname.toLowerCase();

export function logoFor(s: { university: string; officialUrl: string }): string | null {
  const site = logoSite(s);
  return site ? ((manifest as Record<string, string>)[hostOf(site)] ?? null) : null;
}
