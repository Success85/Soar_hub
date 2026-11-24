import { expect, test } from "@playwright/test";
import { lastLink, noErrorBoundary, pdfBuffer } from "./helpers";

test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const email = `e2e.applicant.${stamp}@example.com`;
const password = "Bright-future-2026";
const refereeEmail = `e2e.referee.${stamp}@example.com`;

test("applicant: register → verify → onboard → eligibility → plan → documents → referee → submit", async ({ page, browser }) => {
  // 1. Register
  await page.goto("/register");
  await page.getByLabel("First name").fill("Amina");
  await page.getByLabel("Last name").fill("Bello");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByLabel(/privacy policy/).check();
  await page.getByLabel(/terms of service/).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/verify-email\/pending/);
  await expect(page.getByRole("heading", { name: /check your inbox/i })).toBeVisible();

  // Protected pages are blocked until verification
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/verify-email\/pending/);

  // 2. Verify email via the link that was emailed
  await page.goto(lastLink(email, "/verify-email?token="));
  await expect(page.getByRole("heading", { name: "Email verified" })).toBeVisible();
  await page.getByRole("link", { name: "Continue" }).click();

  // 3. Onboarding
  await expect(page.getByRole("heading", { name: /Let's get you ready/ })).toBeVisible();
  await page.getByRole("button", { name: "Start my profile" }).click();
  await expect(page).toHaveURL(/step=personal/);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Date of birth").fill("2006-08-15");
  await page.getByLabel("Country of citizenship").fill("Nigeria");
  await page.getByLabel("Country of residence").fill("Nigeria");
  await page.getByLabel("State of origin").selectOption("Kaduna");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page).toHaveURL(/step=education/);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Current education level").selectOption("secondary_completed");
  await page.getByLabel("School", { exact: true }).fill("Government Girls Secondary School, Kaduna");
  await page.getByLabel(/graduation year/i).fill("2025");
  await page.getByLabel(/Credit passes/).fill("6");
  await page.getByLabel("WASSCE (WAEC)").check();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page).toHaveURL(/step=background/);
  await page.waitForLoadState("networkidle");
  await page.getByLabel(/first in your immediate family/).selectOption("true");
  await page.getByLabel(/significant financial support/).selectOption("true");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page).toHaveURL(/step=goals/);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("What would you like to study?").fill("Public Health");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page).toHaveURL(/step=consent/);
  await page.waitForLoadState("networkidle");
  await page.getByLabel(/I consent to SOAR Hub processing/).check();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page).toHaveURL(/step=done/);
  await page.getByRole("button", { name: /Finish and go to my dashboard/ }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByRole("heading", { name: /Welcome back, Amina/ })).toBeVisible();

  // 4. Explore scholarships and open a real partner listing (ALU, open window)
  await page.goto("/scholarships?q=African+Leadership+University");
  await page.getByRole("link", { name: "African Leadership University (ALU)" }).first().click();
  await expect(page.getByRole("heading", { name: "Eligibility checklist" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Application documents" })).toBeVisible();
  await page.getByRole("button", { name: /Save scholarship/ }).click();
  await expect(page.getByRole("button", { name: /Saved — remove/ })).toBeVisible();

  // 5. Eligibility check
  await page.getByRole("link", { name: "Check my eligibility" }).click();
  const run = page.getByRole("button", { name: "Run eligibility check" });
  const seeResult = page.getByRole("button", { name: /See my result|Save and continue/ });
  await run.or(seeResult).first().click();
  await expect(page.getByRole("heading", { name: "Likely eligible" })).toBeVisible();
  await expect(page.getByText("Criterion by criterion")).toBeVisible();

  // 6. Start application → plan
  await page.getByRole("button", { name: "Start application plan" }).click();
  await expect(page).toHaveURL(/\/applications\//);
  const appUrl = page.url();
  const applicationId = appUrl.split("/applications/")[1];
  await expect(page.getByText("Required document checklist")).toBeVisible();
  await expect(page.getByText(/Admission application · 0\/9 ready/)).toBeVisible();
  await expect(page.getByText(/Scholarship application · 0\/6 ready/)).toBeVisible();
  await page.getByRole("button", { name: "Start preparing" }).click();
  await expect(page.getByText("I've submitted on the official portal")).toBeVisible();

  // 7. Upload every required document into its checklist slot (letter 1 comes from the referee below)
  for (let i = 0; i < 20; i++) {
    await page.goto(appUrl);
    const item = page
      .locator("li")
      .filter({ has: page.getByRole("link", { name: /^Upload( a letter I already have)?$/ }) })
      .filter({ hasNotText: "(optional)" })
      .filter({ hasNotText: "Recommendation letter 1" })
      .first();
    if ((await item.count()) === 0) break;
    await item.getByRole("link", { name: /^Upload( a letter I already have)?$/ }).click();
    await expect(page).toHaveURL(/\/documents\?application=/);
    await page.locator('input[type="file"]').setInputFiles({ name: `document-${i}.pdf`, mimeType: "application/pdf", buffer: pdfBuffer(`Document ${i}`) });
    await page.getByRole("button", { name: "Upload document" }).click();
    await expect(page.getByText(/Uploaded version 1/)).toBeVisible();
  }
  await page.goto(appUrl);
  await expect(page.getByText(/Admission application · 8\/9 ready/)).toBeVisible();
  await expect(page.getByText(/Scholarship application · 5\/6 ready/)).toBeVisible();

  // Validation: a fake PDF is rejected
  await page.goto("/documents");
  await page.locator('input[type="file"]').setInputFiles({ name: "fake.pdf", mimeType: "application/pdf", buffer: Buffer.from("MZ not a pdf") });
  await page.getByRole("button", { name: "Upload document" }).click();
  await expect(page.getByText(/couldn't recognise this file/)).toBeVisible();

  // 8. Request a reference letter
  await page.goto(`/referees?application=${applicationId}`);
  await page.getByLabel("Referee's full name").fill("Mr Ibrahim Yusuf");
  await page.getByLabel("Referee's email").fill(refereeEmail);
  await page.getByLabel("Relationship to you").fill("Biology teacher");
  await page.getByLabel("Please submit by").fill(new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10));
  await page.getByRole("button", { name: "Send secure request" }).click();
  await expect(page.getByText(/Request sent/)).toBeVisible();

  // 9. Referee uploads in a separate, logged-out browser context
  const refCtx = await browser.newContext();
  const ref = await refCtx.newPage();
  const refLink = lastLink(refereeEmail, "/referee/");
  await ref.goto(refLink);
  await expect(ref.getByRole("heading", { name: /Dear Mr Ibrahim Yusuf/ })).toBeVisible();
  await expect(ref.getByText("Amina Bello", { exact: true })).toBeVisible();
  await ref.locator('input[type="file"]').setInputFiles({ name: "reference.pdf", mimeType: "application/pdf", buffer: pdfBuffer("Reference for Amina") });
  await ref.getByLabel(/I confirm this letter/).check();
  await ref.getByRole("button", { name: "Submit reference letter" }).click();
  await expect(ref.getByRole("heading", { name: /your letter has been received/ })).toBeVisible();
  // token cannot be reused
  await ref.goto(refLink);
  await expect(ref.getByText("A letter has already been submitted")).toBeVisible();
  await expect(ref.locator('input[type="file"]')).toHaveCount(0);
  await refCtx.close();

  await page.goto("/referees");
  await expect(page.getByText("Submitted").first()).toBeVisible();

  // 10. Complete every task in the planner (list view)
  await page.goto(`/planner?application=${applicationId}&filter=upcoming`);
  const buttons = page.getByRole("button", { name: "Mark complete" });
  await expect(buttons.first()).toBeVisible();
  for (let i = 0; i < 20; i++) {
    const before = await buttons.count();
    if (before === 0) break;
    await buttons.first().click();
    await expect.poll(() => buttons.count(), { timeout: 30_000 }).toBeLessThan(before);
  }
  await page.goto(`/planner?application=${applicationId}&view=calendar`);
  await noErrorBoundary(page);
  await page.goto(`/planner?application=${applicationId}&view=timeline`);
  await noErrorBoundary(page);

  // 11. Submit
  await page.goto(appUrl);
  // the panel opens automatically once the checklist is complete
  await expect(page.getByLabel(/Confirmation or reference number/)).toBeVisible();
  await page.getByLabel(/Confirmation or reference number/).fill("APP-2026-001");
  await page.getByRole("button", { name: "Mark application as submitted" }).click();
  await expect(page.getByText(/Heard back\?/)).toBeVisible();
  await expect(page.getByText("100%").first()).toBeVisible();

  // 12. Notifications inbox has the referee update
  await page.goto("/notifications");
  await expect(page.getByText("Reference letter received")).toBeVisible();
});
