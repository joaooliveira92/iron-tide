import baseConfig from "./playwright.config.js";

/**
 * Debug-build Playwright project: runs ONLY the debug-only specs excluded from
 * the default `playwright.config.ts` run. Requires the app to be built with
 * `VITE_BLUEWAVE_DEBUG=true` (debug-gated main-process commands + debug UI).
 *
 *   VITE_BLUEWAVE_DEBUG=true pnpm --filter @bluewave/desktop build
 *   pnpm --filter @bluewave/desktop test:e2e:debug
 */
export default {
  ...baseConfig,
  testIgnore: [],
  testMatch: "**/*.debug.spec.ts",
};
