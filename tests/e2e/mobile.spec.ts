import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test.use({ viewport: { width: 320, height: 640 } });

const noOverflow = async (page: import("@playwright/test").Page) => {
  const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(sw).toBeLessThanOrEqual(cw + 1);
};

test("public pages fit 320px without horizontal scrolling and the menu works", async ({ page }) => {
  for (const path of ["/", "/membership", "/about", "/faq", "/contact", "/login", "/register"]) {
    await page.goto(path);
    await noOverflow(page);
  }
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("navigation", { name: "Mobile" }).getByRole("link", { name: "Scholarships" })).toBeVisible();
});

test("applicant portal works at 320px", async ({ page }) => {
  await login(page, "applicant@demo.soarhub.ng");
  for (const path of ["/scholarships", "/guide", "/resources/alu-cv-template-explained", "/dashboard", "/applications", "/planner", "/documents", "/essays", "/referees", "/settings"]) {
    await page.goto(path);
    await noOverflow(page);
  }
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Profile" }).click();
  await expect(page).toHaveURL(/\/profile/);
});
