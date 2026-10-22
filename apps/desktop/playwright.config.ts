import { defineConfig } from "@playwright/test";

const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "e2e",
  testIgnore: "**/*.debug.spec.ts",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: CI ? 2 : 3,
  retries: CI ? 2 : 0,
  outputDir: "test-results",
  reporter: CI ? "github" : "list",
  use: {
    trace: CI ? "on-first-retry" : "off",
    screenshot: "only-on-failure",
  },
});
