import { defineConfig } from "vite-plus";
import { sharedTestConfig } from "../../scripts/vitest-shared.mjs";

export default defineConfig({
  test: {
    ...sharedTestConfig,
    include: ["test/**/*.test.ts"],
    // ADR-0053: auto-resolved battles run ~4x more minutes after the lethality
    // tuning; multi-seed/two-process tests need headroom under parallel load.
    testTimeout: 60_000,
  },
});
