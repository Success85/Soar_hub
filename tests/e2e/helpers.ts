import { readFileSync, existsSync } from "node:fs";
import { expect, type Page } from "@playwright/test";

export const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "Soar-demo-2026!";

export function lastLink(to: string, contains: string): string {
  const f = `${process.cwd()}/.dev-storage/outbox.jsonl`;
  if (!existsSync(f)) throw new Error("No dev outbox yet");
  const msgs = readFileSync(f, "utf8").trim().split("\n").map((l) => JSON.parse(l) as { to: string; text: string }).filter((m) => m.to === to);
  const links = msgs.flatMap((m) => m.text.match(/https?:\/\/\S+/g) ?? []).filter((l) => l.includes(contains));
  if (!links.length) throw new Error(`No link containing ${contains} for ${to}`);
  return links[links.length - 1];
}

export async function login(page: Page, email: string, password = DEMO_PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

export async function logout(page: Page) {
  await page.context().clearCookies();
}

export async function noErrorBoundary(page: Page) {
  await expect(page.getByText("Something went wrong on our side")).toHaveCount(0);
}

export function pdfBuffer(text = "Test document") {
  return Buffer.from(`%PDF-1.4\n1 0 obj<<>>endobj\n% ${text}\ntrailer<<>>\n%%EOF`);
}
