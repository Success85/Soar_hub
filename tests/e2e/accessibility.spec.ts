import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { login } from "./helpers";

const PUBLIC = ["/", "/membership", "/about", "/faq", "/contact", "/login", "/register", "/privacy"];
// Member-only pages, checked while signed in as the demo applicant (a member).
const MEMBER = ["/scholarships", "/scholarships/mcf-alu-rwanda", "/resources", "/resources/statement-of-purpose-sample-explained", "/guide", "/membership"];

for (const path of PUBLIC) {
  test(`axe: ${path} has no serious or critical violations`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page: page as never }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.nodes.length} — ${v.help}`)).toEqual([]);
  });
}

test("member-only pages send visitors to the membership page", async ({ page }) => {
  for (const path of ["/scholarships", "/guide", "/resources", "/dashboard"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/(membership|login)/);
  }
  const file = await page.request.get("/downloads/alu-cv-template.pdf", { maxRedirects: 0 });
  expect(file.status()).toBe(307);
});

test("axe: applicant dashboard, member pages and eligibility pages", async ({ page }) => {
  await login(page, "applicant@demo.soarhub.ng");
  const pdf = await page.request.get("/downloads/alu-cv-template.pdf");
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  for (const path of ["/dashboard", "/planner", "/documents", "/profile", ...MEMBER]) {
    await page.goto(path);
    const results = await new AxeBuilder({ page: page as never }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${path} ${v.id}: ${v.help}`)).toEqual([]);
  }
});

test("keyboard: skip link and visible focus", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main/);
  await page.goto("/login");
  await page.getByLabel("Email address").focus();
  const outline = await page.getByLabel("Email address").evaluate((el) => getComputedStyle(el).outlineStyle + getComputedStyle(el).boxShadow);
  expect(outline).not.toBe("none");
});

test("forms announce errors", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("nobody@example.com");
  await page.getByLabel("Password", { exact: true }).fill("wrong-password-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "didn" })).toContainText("didn't work");
});
