import { expect, test } from "@playwright/test";
import { login, logout, pdfBuffer } from "./helpers";

test.describe.configure({ mode: "serial" });

const essayTitle = `E2E essay ${Date.now()}`;
const passage = "organised a reading club for twelve younger pupils";

test("reviewer: reviews a document and an essay with anchored feedback; applicant sees it", async ({ page }) => {
  // applicant prepares work
  await login(page, "applicant@demo.soarhub.ng");
  await page.goto("/applications");
  await page.getByRole("link", { name: /EARTH University/ }).first().click();
  await page.waitForURL(/\/applications\/[0-9a-f-]{36}/);
  const appId = page.url().split("/applications/")[1];
  await page.goto(`/documents?application=${appId}`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Document type").selectOption("cv");
  const docTitle = `E2E CV ${Date.now()}`;
  await page.getByLabel("Name (optional)").fill(docTitle);
  await page.locator('input[type="file"]').setInputFiles({ name: "cv.pdf", mimeType: "application/pdf", buffer: pdfBuffer("CV") });
  await page.getByRole("button", { name: "Upload document" }).click();
  await expect(page.getByText(/Uploaded version 1/)).toBeVisible();
  await page.getByRole("link", { name: docTitle }).click();
  await page.waitForURL(/\/documents\/[0-9a-f-]{36}/);
  await page.getByRole("button", { name: /Request review/ }).click();
  await expect(page.getByText("Waiting for a reviewer.")).toBeVisible();
  const docUrl = page.url();

  await page.goto(`/essays/new?application=${appId}`);
  await page.getByLabel("Essay title").fill(essayTitle);
  await page.getByLabel("Essay prompt / question").fill("Describe a time you showed leadership.");
  await page.getByLabel("Your essay").fill(`Last year I ${passage} in my community. `.repeat(1) + "We met every Saturday under the mango tree and I learned how patience builds trust. ".repeat(5));
  await page.getByRole("button", { name: "Create essay" }).click();
  await expect(page).toHaveURL(/\/essays\/[0-9a-f-]{36}/);
  const essayUrl = page.url();
  await page.getByRole("button", { name: /Submit version 1 for review/ }).click();
  await expect(page.getByText("Waiting for your reviewer")).toBeVisible();
  await logout(page);

  // reviewer
  await login(page, "reviewer@demo.soarhub.ng");
  await expect(page).toHaveURL(/\/reviewer/);
  await expect(page.getByText("Chiamaka Okafor").first()).toBeVisible();
  await page.goto(docUrl.replace("/documents/", "/reviewer/documents/"));
  await page.getByRole("button", { name: "Start review" }).click();
  await page.getByLabel("Comment").fill("Add dates to each activity so the timeline is clear.");
  await page.getByRole("button", { name: /Add (general|anchored) comment/ }).click();
  await expect(page.getByText("Add dates to each activity").first()).toBeVisible();
  await page.getByLabel("Decision").selectOption("needs_revision");
  await page.getByLabel("Summary for the applicant").fill("Strong start — please add dates.");
  await page.getByRole("button", { name: /Record decision/ }).click();
  await expect(page.getByText(/Review recorded/)).toBeVisible();

  await page.goto(essayUrl.replace("/essays/", "/reviewer/essays/"));
  await page.getByLabel("Highlighted passage (optional)").fill(passage);
  await page.getByLabel("Comment", { exact: true }).fill("How many pupils improved their reading? Add evidence.");
  await page.getByRole("button", { name: "Add anchored comment" }).click();
  await expect(page.locator("mark", { hasText: passage })).toBeVisible();
  await page.getByLabel("Outcome").selectOption("revision_requested");
  await page.getByRole("button", { name: /Complete review/ }).click();
  await expect(page.getByText(/Review completed/)).toBeVisible();
  await logout(page);

  // applicant sees feedback
  await login(page, "applicant@demo.soarhub.ng");
  await page.goto(essayUrl);
  await expect(page.getByText("Revision requested").first()).toBeVisible();
  await expect(page.locator("mark", { hasText: passage })).toBeVisible();
  await expect(page.getByText("How many pupils improved their reading?")).toBeVisible();
  await page.getByRole("button", { name: "Mark revision completed" }).first().click();
  await expect(page.getByText("Revision done").first()).toBeVisible();
  await page.goto(docUrl);
  await expect(page.getByText("Strong start — please add dates.")).toBeVisible();
  await expect(page.getByText("Needs revision").first()).toBeVisible();
});

test("reviewers cannot open applications they are not assigned to", async ({ page }) => {
  await login(page, "reviewer@demo.soarhub.ng");
  // an application this reviewer is not assigned to (created by the applicant journey spec, or any other)
  await page.goto("/reviewer/applications/00000000-0000-0000-0000-000000000000");
  await expect(page.getByText("We couldn't find that page")).toBeVisible();
  const { execSync } = await import("node:child_process");
  const other = execSync(`psql postgresql://soar:soar@localhost:5432/soar_hub -tAc "select a.id from applications a where not exists (select 1 from reviewer_assignments r where r.application_id=a.id and r.is_active and r.reviewer_id=(select id from users where email='reviewer@demo.soarhub.ng')) limit 1"`).toString().trim();
  if (other) {
    await page.goto(`/reviewer/applications/${other}`);
    await expect(page.getByText("We couldn't find that page")).toBeVisible();
  }
});
