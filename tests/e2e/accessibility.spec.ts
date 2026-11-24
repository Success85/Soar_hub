import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { login } from "./helpers";

const PUBLIC = ["/", "/scholarships", "/scholarships/mcf-alu-rwanda", "/about", "/resources", "/resources/statement-of-purpose-sample-explained", "/guide", "/faq", "/contact", "/login", "/register", "/privacy"];

for (const path of PUBLIC) {
  test(`axe: ${path} has no serious or critical violations`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page: page as never }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.nodes.length} — ${v.help}`)).toEqual([]);
  });
}

test("axe: applicant dashboard and eligibility pages", async ({ page }) => {
  await login(page, "applicant@demo.soarhub.ng");
  for (const path of ["/dashboard", "/planner", "/documents", "/profile"]) {
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
