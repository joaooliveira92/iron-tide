import { defineConfig } from "vite-plus";
import { sharedTestConfig } from "../../scripts/vitest-shared.mjs";

export default defineConfig({
  test: {
    ...sharedTestConfig,
    // The determinism/permutation suites migrate the full production content a
    // handful of times per test (`planFromLegacy` over the legacy source), so
    // they are the heaviest in the fast tier. Carry deliberate, load-tolerant
    // headroom above the shared baseline (`scripts/vitest-shared.mjs`, 15s)
    // rather than relying on the default: under a saturated CI box (gates +
    // suites + a parallel build) these are the tests that tipped over Vitest's
    // 5s default before the baseline existed (production-hardening ticket 02).
    testTimeout: 30000,
    include: ["test/**/*.test.ts"],
  },
});
