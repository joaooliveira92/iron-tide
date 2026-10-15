import { defineConfig } from "vite-plus";
import { sharedTestConfig } from "../../scripts/vitest-shared.mjs";

/**
 * The long simulation suites (the 36-month campaign regression and the AI
 * procurement simulation) are correct but timing-sensitive: under the full
 * suite's parallel turbo load they can tip past their timeout on a busy runner
 * and flake a required gate. They are isolated into a dedicated, bounded-
 * concurrency run (`pnpm test:heavy`, quality.yml) instead of the default
 * per-package suite (test-hygiene / release-readiness WS4).
 */
const HEAVY = ["test/ai-procurement.test.ts", "test/campaign-regression-36mo.test.ts"];
const heavyOnly = process.env.BLUEWAVE_HEAVY === "1";

export default defineConfig({
  test: {
    ...sharedTestConfig,
    include: heavyOnly ? HEAVY : ["test/**/*.test.ts"],
    exclude: heavyOnly ? [] : HEAVY,
    // This package's suites (month loops, battle resolution, replay round-trips)
    // legitimately run a few seconds each; under the CI runner's parallel turbo
    // load the defaults tip past vitest's 5s default. Give the same headroom the
    // compiler-cli config already does rather than trimming real work.
    testTimeout: 30000,
  },
});
