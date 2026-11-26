import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'self' https://www.youtube-nocookie.com https://player.vimeo.com",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["mammoth", "unpdf", "nodemailer"],
  // Member-only sample documents are read from disk by the /downloads/[file] route.
  outputFileTracingIncludes: { "/downloads/[file]": ["./content/downloads/**"] },
  // Some server code builds paths from process.cwd() (local storage, dev outbox, member downloads), which makes the
  // file tracer include the whole project. Keep build caches, history, tests and docs out of the server bundles so
  // they stay small (and Vercel can group them into a few functions; the free plan allows 12).
  outputFileTracingExcludes: {
    "*": [
      ".next/cache/**",
      ".git/**",
      ".vercel/**",
      "tests/**",
      "test-results/**",
      "playwright-report/**",
      "coverage/**",
      "docs/**",
      "drizzle/**",
      "scripts/**",
      ".dev-storage*/**",
      "public/**",
      "*.md",
      "tsconfig.tsbuildinfo",
      "package-lock.json",
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
