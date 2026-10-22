import { defineConfig } from "vite-plus";
import { sharedTestConfig } from "../../scripts/vitest-shared.mjs";

const HEAVY = ["test/ai-procurement.test.ts", "test/campaign-regression-36mo.test.ts"];
const heavyOnly = process.env.BLUEWAVE_HEAVY === "1";

export default defineConfig({
  test: {
    ...sharedTestConfig,
    include: heavyOnly ? HEAVY : ["test/**/*.test.ts"],
    exclude: heavyOnly ? [] : HEAVY,
    testTimeout: 30000,
  },
});
