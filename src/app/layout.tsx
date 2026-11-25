import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { getSettings } from "@/lib/services/settings";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap", axes: ["opsz"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: { default: "SOAR Hub — Scholarship application support for young Nigerians", template: "%s · SOAR Hub" },
  description: "Discover fully funded undergraduate scholarships, understand your eligibility, organise your application and get guided support from preparation to submission.",
  openGraph: { siteName: "SOAR Hub", type: "website" },
};

// Every page is rendered per request: pages read settings and the signed-in user from the database, and must
// never be pre-rendered at build time (the database may be slow or unreachable from the build machine).
export const dynamic = "force-dynamic";

export const viewport: Viewport = { themeColor: "#0B1F3A", width: "device-width", initialScale: 1 };

const hex = (v: unknown, fallback: string) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback);

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Admin-configurable brand colours (validated hex only) override the theme tokens.
  let brand = "";
  try {
    const c = (await getSettings()).brand_colors as Record<string, string>;
    brand = `:root{--color-navy-900:${hex(c.navy, "#0b1f3a")};--color-gold-500:${hex(c.gold, "#d4a72c")};--color-royal-600:${hex(c.blue, "#2563eb")};--color-ivory:${hex(c.ivory, "#faf8f2")}}`;
  } catch {
    brand = "";
  }
  return (
    <html lang="en-NG" className={`${jakarta.variable} ${fraunces.variable}`}>
      <head>{brand && <style dangerouslySetInnerHTML={{ __html: brand }} />}</head>
      <body className="min-h-dvh">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-gold-500 focus:px-4 focus:py-2 focus:font-semibold focus:text-navy-950">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
