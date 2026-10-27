import { defineConfig } from "@playwright/test";

const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  testIgnore: "**/*.debug.spec.ts",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: CI,
  failOnFlakyTests: CI,
  workers: CI ? 2 : 3,
  retries: CI ? 2 : 0,
  outputDir: "test-results",
  reporter: CI ? [["github"], ["list"]] : "list",
});
