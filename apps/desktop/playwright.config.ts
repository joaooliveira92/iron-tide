import { defineConfig } from "@playwright/test";

const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "e2e",
  // The debug-only drill spec needs a `VITE_BLUEWAVE_DEBUG=true` build; the
  // default run (and a normal `pnpm build`) must stay green without it. Run it
  // with `playwright.debug.config.ts` / `pnpm test:e2e:debug`.
  testIgnore: "**/*.debug.spec.ts",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: CI ? 2 : 0,
  outputDir: "test-results",
  reporter: CI ? "github" : "list",
  use: {
    trace: CI ? "on-first-retry" : "off",
    screenshot: "only-on-failure",
  },
});
