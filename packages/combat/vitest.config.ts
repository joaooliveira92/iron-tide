import { defineConfig } from "vite-plus";
import { sharedTestConfig } from "../../scripts/vitest-shared.mjs";

export default defineConfig({
  test: {
    ...sharedTestConfig,
    include: ["test/**/*.test.ts"],
    testTimeout: 60_000,
  },
});
