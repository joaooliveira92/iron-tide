import { defineConfig } from "vite-plus";
import { sharedTestConfig } from "../../scripts/vitest-shared.mjs";

export default defineConfig({
  test: {
    ...sharedTestConfig,
    include: ["test/**/*.test.ts"],
    // The national simulation suites compile hundreds of candidate designs; give them headroom under parallel load.
    testTimeout: 30000,
  },
});
