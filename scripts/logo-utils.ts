/** Helpers for scripts/fetch-logos.ts (kept separate so they can be unit-tested). */
import sharp from "sharp";

const UA = "Mozilla/5.0 (compatible; SOAR-Hub-logo-fetcher/1.0)";

export async function get(url: string, timeoutMs = 20000): Promise<Response> {
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,image/*,*/*" }, redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

export interface Candidate { url: string; source: string; score: number }

function attr(tag: string, name: string): string | null {
  const m = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  return m ? (m[2] ?? m[3] ?? m[4] ?? null) : null;
}

/** Ranks icons declared by the page: big apple-touch/PNG icons first, then a header <img> named "logo". */
export function candidates(html: string, base: string): Candidate[] {
  const out: Candidate[] = [];
  const abs = (href: string) => { try { return new URL(href, base).toString(); } catch { return null; } };
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = (attr(tag, "rel") ?? "").toLowerCase();
    const href = attr(tag, "href");
    if (!href || !/icon/.test(rel)) continue;
    const url = abs(href);
    if (!url || /\.ico(\?|$)/i.test(url)) continue;
    const size = Number((attr(tag, "sizes") ?? "").split("x")[0]) || 0;
    const score = (rel.includes("apple-touch-icon") ? 300 : 100) + Math.min(size, 512) / 2 + (/\.svg(\?|$)/i.test(url) ? 150 : 0);
    out.push({ url, source: `<link rel="${rel}">`, score });
  }
  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    const src = attr(tag, "src") ?? attr(tag, "data-src");
    if (!src || src.startsWith("data:")) continue;
    const hint = `${src} ${attr(tag, "alt") ?? ""} ${attr(tag, "class") ?? ""} ${attr(tag, "id") ?? ""}`.toLowerCase();
    if (!/logo/.test(hint) || /white|footer|partner|sponsor|accredit/.test(hint)) continue;
    const url = abs(src);
    if (url) out.push({ url, source: "<img> logo", score: 250 });
    if (out.filter((c) => c.source === "<img> logo").length >= 2) break;
  }
  out.push({ url: new URL("/apple-touch-icon.png", base).toString(), source: "/apple-touch-icon.png", score: 50 });
  return out.sort((a, b) => b.score - a.score);
}

/** Downloads and normalises one image; rejects tiny, invisible (all-white/transparent) or non-image files. */
export async function toPng(url: string): Promise<Buffer> {
  const res = await get(url);
  const type = res.headers.get("content-type") ?? "";
  if (!/image|svg|octet-stream/.test(type)) throw new Error(`not an image (${type})`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 5_000_000) throw new Error("too large");
  // No trim(): it would strip the solid background of square app icons and leave only the glyph.
  const img = sharp(buf, { density: 300 });
  const meta = await sharp(buf).metadata();
  if (!meta.width || meta.width < 64) throw new Error(`too small (${meta.width ?? "?"}px)`);
  const png = await img.resize(256, 256, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toBuffer();
  // stats() reads its *input*, so flatten onto white first; a logo that is invisible on white has ~no variation.
  const flat = await sharp(png).flatten({ background: "#ffffff" }).removeAlpha().toBuffer();
  const { channels } = await sharp(flat).stats();
  if (Math.max(...channels.map((c) => c.stdev)) < 4) throw new Error("blank or white-on-transparent image");
  return png;
}

