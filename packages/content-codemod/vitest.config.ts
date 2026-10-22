import { defineConfig } from "vite-plus";
import { sharedTestConfig } from "../../scripts/vitest-shared.mjs";

export default defineConfig({
  test: {
    ...sharedTestConfig,
    testTimeout: 30000,
    include: ["test/**/*.test.ts"],
  },
});
