import { vi } from "vitest";

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://soar:soar@localhost:5432/soar_hub_test";
process.env.SESSION_SECRET ??= "test-session-secret-that-is-at-least-32-chars";
process.env.EMAIL_PROVIDER = "console";
process.env.STORAGE_DRIVER = "local";
process.env.LOCAL_STORAGE_DIR = ".dev-storage-test";
process.env.DISABLE_RATE_LIMIT ??= "true";
process.env.AI_PROVIDER ??= "none";

// Minimal cookie jar so session code can run outside a Next.js request.
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { name: k, value: jar.get(k)! } : undefined),
    set: (k: string, v: string) => jar.set(k, v),
    delete: (k: string) => jar.delete(k),
    has: (k: string) => jar.has(k),
  }),
  headers: async () => new Headers({ "x-forwarded-for": "127.0.0.1", "user-agent": "vitest" }),
}));
