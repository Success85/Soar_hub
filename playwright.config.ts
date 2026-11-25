import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: { baseURL: `http://localhost:${port}`, trace: "off", screenshot: "only-on-failure", navigationTimeout: 90_000, actionTimeout: 30_000 },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile\.spec/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec/ },
  ],
  webServer: [
    {
      command: "node tests/e2e/mock-flutterwave.mjs",
      url: "http://127.0.0.1:4010/health",
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: `npx next dev -p ${port}`,
      url: `http://localhost:${port}/api/health`,
      reuseExistingServer: true,
      timeout: 180_000,
      // Payments go to the local mock Flutterwave above, never to the real API.
      env: { DISABLE_RATE_LIMIT: "true", APP_URL: `http://localhost:${port}`, FLW_SECRET_KEY: "FLWSECK_TEST-e2e", FLW_SECRET_HASH: "e2e-webhook-hash", FLW_API_BASE: "http://127.0.0.1:4010/v3" },
    },
  ],
});
