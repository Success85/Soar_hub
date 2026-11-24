import { expect, test } from "@playwright/test";
import { login, noErrorBoundary } from "./helpers";

// Admin follow-up on a submitted application: assign a reviewer, shortlist, then record the outcome.
// Runs after applicant-journey.spec.ts (which leaves a submitted ALU application).
test("admin: assign reviewer, shortlist and record the outcome of a submitted application", async ({ page }) => {
  await login(page, "admin@demo.soarhub.ng");
  await page.goto("/admin/applications?status=submitted");
  await noErrorBoundary(page);
  const row = page.locator("tbody tr", { hasText: "African Leadership University" }).first();
  test.skip((await row.count()) === 0, "No submitted ALU application — run applicant-journey.spec.ts first");
  await row.locator("a").first().click();
  await page.waitForURL(/\/admin\/applications\/[0-9a-f-]{36}/);

  if (await page.getByRole("button", { name: "Assign" }).count()) {
    await page.getByRole("button", { name: "Assign" }).click();
    await expect(page.getByText(/Reviewer assigned/)).toBeVisible();
  }
  await page.getByLabel("Move to").selectOption("shortlisted");
  await page.getByRole("button", { name: "Update status" }).click();
  await expect(page.getByText("Shortlisted").first()).toBeVisible();

  await page.getByLabel("Move to").selectOption("outcome");
  await page.getByLabel("Outcome (when recording an outcome)").selectOption({ index: 1 });
  await page.getByLabel("Outcome notes").fill("Offer received by email from ALU.");
  await page.getByRole("button", { name: "Update status" }).click();
  await expect(page.getByText("Shortlisted → Outcome recorded").first()).toBeVisible();
  await expect(page.getByText(/Outcome: awarded/).first()).toBeVisible();
  await page.goto("/admin/audit?eventType=application");
  await noErrorBoundary(page);
});
