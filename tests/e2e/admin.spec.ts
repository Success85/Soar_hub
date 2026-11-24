import { expect, test } from "@playwright/test";
import { login, noErrorBoundary } from "./helpers";

test("admin: create, configure, verify and publish a scholarship; operate the platform", async ({ page, request }) => {
  const name = `E2E Scholarship ${Date.now()}`;
  await login(page, "admin@demo.soarhub.ng");
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByText("Total applicants")).toBeVisible();

  // create
  await page.goto("/admin/scholarships/new");
  await page.getByLabel("Scholarship name").fill(name);
  await page.getByLabel("Partner university").fill("E2E Partner University");
  await page.getByLabel("Country").fill("Rwanda");
  await page.getByLabel("Official deadline (Lagos time)").fill(new Date(Date.now() + 120 * 86_400_000).toISOString().slice(0, 16));
  await page.getByLabel("Official application URL").fill("https://example.org/e2e-apply");
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page).toHaveURL(/tab=sources/);
  const adminUrl = page.url().split("?")[0];
  await expect(page.getByText("Add the official source link")).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish" })).toBeVisible();

  // source
  await page.getByLabel("Source name").fill("E2E University — Scholarships");
  await page.getByLabel("Official URL").fill("https://example.org/e2e-official");
  await page.getByRole("button", { name: "Add source" }).click();
  await expect(page.getByText("https://example.org/e2e-official").first()).toBeVisible();

  // criteria builder
  await page.goto(`${adminUrl}?tab=criteria`);
  await page.getByLabel("Name", { exact: true }).first().fill("Age limit");
  await page.getByLabel("Required value").first().fill("29");
  await page.getByLabel("Severity").first().selectOption("absolute");
  await page.getByRole("button", { name: /Add criterion/ }).click();
  await page.getByLabel("Name", { exact: true }).nth(1).fill("Nigerian citizen");
  await page.getByLabel("Applicant field").nth(1).selectOption("country_of_citizenship");
  await page.getByLabel("Operator").nth(1).selectOption("eq");
  await page.getByLabel("Required value").nth(1).fill("Nigeria");
  await page.getByRole("button", { name: "Run preview" }).click();
  await expect(page.getByText(/Overall: likely eligible/)).toBeVisible();
  await page.getByRole("button", { name: "Validate & save criteria" }).click();
  await expect(page.getByText(/Criteria saved/)).toBeVisible();

  // required documents
  await page.goto(`${adminUrl}?tab=documents`);
  await page.getByLabel("Name").first().fill("Academic transcript");
  await page.getByRole("button", { name: "Save required documents" }).click();
  await expect(page.getByText("Required documents saved.")).toBeVisible();

  // verify + publish
  await page.getByRole("button", { name: "Mark source verified" }).click();
  await expect(page.getByRole("button", { name: "Re-verify source now" })).toBeVisible();
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByRole("button", { name: "Unpublish" })).toBeVisible();

  // appears publicly
  await page.goto(`/scholarships?q=${encodeURIComponent(name)}`);
  await expect(page.getByText("1 scholarship", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "E2E Partner University" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "E2E Partner University" })).toBeVisible();

  // applicants & export
  await page.goto("/admin/applicants?completion=high");
  await noErrorBoundary(page);
  const csv = await request.get("/api/admin/export/applicants", { headers: { cookie: (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ") } });
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain("profile_completion");

  // assign a reviewer to an unassigned application
  await page.goto("/admin/applications?unassigned=on");
  const firstApp = page.locator("tbody a").first();
  if (await firstApp.count()) {
    await firstApp.click();
    await page.getByRole("button", { name: "Assign" }).click();
    await expect(page.getByText(/Reviewer assigned/)).toBeVisible();
  }

  // monitor, analytics, audit, settings
  for (const path of ["/admin/analytics", "/admin/notifications", "/admin/eligibility-rules", "/admin/content", "/admin/users", "/admin/referees", "/admin/data-requests", "/admin/document-reviews", "/admin/essay-reviews", "/admin/ai-queue", "/admin/notifications/templates"]) {
    await page.goto(path);
    await noErrorBoundary(page);
    await expect(page.locator("h1")).toBeVisible();
  }
  await page.goto("/admin/audit?eventType=scholarship.publish");
  await expect(page.getByText("scholarship.publish").first()).toBeVisible();
  await page.goto("/admin/settings");
  await page.getByRole("button", { name: "dispatch-notifications" }).click();
  await expect(page.getByText(/dispatch-notifications: \{/)).toBeVisible();

  // deactivate keeps history
  await page.goto(adminUrl);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Deactivate" }).click();
  await expect(page.getByText("Deactivated").first()).toBeVisible();
  await page.goto(`${adminUrl}?tab=history`);
  await expect(page.getByText("deactivate").first()).toBeVisible();
});

test("authorization: applicants and anonymous users cannot reach admin or reviewer areas", async ({ page, request }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
  await login(page, "applicant2@demo.soarhub.ng");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/forbidden/);
  await page.goto("/reviewer");
  await expect(page).toHaveURL(/\/forbidden/);
  const res = await request.get("/api/admin/export/applicants", { headers: { cookie: (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ") } });
  expect(res.status()).toBe(403);
  const cron = await request.get("/api/cron/daily");
  expect(cron.status()).toBe(401);
});
