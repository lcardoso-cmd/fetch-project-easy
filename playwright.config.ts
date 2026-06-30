import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for end-to-end tests.
 *
 * Run locally:
 *   1. Start the dev server:  bun run dev   (defaults to http://localhost:8080)
 *   2. Export test credentials for an existing user in your Lovable Cloud project:
 *        export E2E_BASE_URL="http://localhost:8080"
 *        export E2E_EMAIL="qa+jurismind@example.com"
 *        export E2E_PASSWORD="<password>"
 *   3. bun run test:e2e
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8080",
    headless: true,
    viewport: { width: 1280, height: 1800 },
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
