/**
 * Downloads each partner school's logo/icon from its official website into public/logos/<hostname>.png,
 * records it in src/lib/data/school-logos.json and sets scholarships.logo_url in the database.
 *
 *   npm run logos:fetch             → fetch logos that are missing (keeps files already in public/logos)
 *   npm run logos:fetch -- --refresh → download every logo again
 *   npm run logos:fetch -- --no-db   → only download files and update the JSON
 *
 * Needs internet access. Every image is re-encoded to a 256×256 PNG with sharp, so nothing executable
 * (e.g. SVG scripts) is ever served from /logos. Logos stay the property of their institutions and are
 * shown only to identify the school next to its listing.
 */
import "dotenv/config";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { MCF_SCHOLARSHIPS } from "@/lib/data/mcf-scholarships";
import { hostOf, logoSite } from "@/lib/data/school-logos";
import { candidates, get, toPng } from "./logo-utils";

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, "public", "logos");
const MANIFEST = join(ROOT, "src", "lib", "data", "school-logos.json");
const refresh = process.argv.includes("--refresh");
const skipDb = process.argv.includes("--no-db");

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const manifest: Record<string, string> = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const sites = new Map<string, string>(); // host → site
  for (const s of MCF_SCHOLARSHIPS) {
    const site = logoSite(s);
    if (site) sites.set(hostOf(site), site);
  }
  const report: string[] = [];
  for (const [host, site] of sites) {
    const file = join(OUT_DIR, `${host}.png`);
    if (existsSync(file) && !refresh) {
      manifest[host] = `/logos/${host}.png`;
      report.push(`kept     ${host}`);
      continue;
    }
    try {
      const page = await get(site);
      const base = page.url || site;
      const list = candidates(await page.text(), base);
      let saved: string | null = null;
      const errors: string[] = [];
      for (const c of list) {
        try {
          writeFileSync(file, await toPng(c.url));
          saved = c.source;
          break;
        } catch (e) {
          errors.push(`${c.source}: ${(e as Error).message}`);
        }
      }
      if (!saved) throw new Error(errors.slice(0, 3).join("; ") || "no icon found");
      manifest[host] = `/logos/${host}.png`;
      report.push(`saved    ${host}  (${saved})`);
    } catch (e) {
      report.push(`FAILED   ${host}  ${(e as Error).message}`);
    }
  }
  writeFileSync(MANIFEST, JSON.stringify(Object.fromEntries(Object.entries(manifest).sort()), null, 2) + "\n");
  console.log(report.join("\n"));

  if (!skipDb) {
    const { db, sqlClient } = await import("@/lib/db");
    const { scholarships } = await import("@/lib/db/schema");
    const { and, eq, isNull, like, or } = await import("drizzle-orm");
    let n = 0;
    for (const s of MCF_SCHOLARSHIPS) {
      const site = logoSite(s);
      const logo = site ? manifest[hostOf(site)] : undefined;
      if (!logo) continue;
      // Never overwrite a logo an admin set by hand (anything outside /logos/).
      const r = await db.update(scholarships).set({ logoUrl: logo }).where(and(eq(scholarships.slug, s.slug), or(isNull(scholarships.logoUrl), like(scholarships.logoUrl, "/logos/%")))).returning({ id: scholarships.id });
      n += r.length;
    }
    console.log(`Database: logo set on ${n} scholarship(s).`);
    await sqlClient.end();
  }
  const failed = report.filter((r) => r.startsWith("FAILED")).length;
  console.log(`\n${sites.size - failed}/${sites.size} schools have a logo. Schools without one show their initials.`);
  if (failed) console.log("For a failed school, save its logo as public/logos/<hostname>.png and run this again (existing files are kept).");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
