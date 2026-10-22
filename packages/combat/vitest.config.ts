import { resolve } from "node:path";
import { defineConfig } from "vite-plus";
import { sharedTestConfig } from "../../scripts/vitest-shared.mjs";

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@bluewave\/combat$/, replacement: resolve(__dirname, "src/index.ts") },
      {
        find: /^@bluewave\/combat\/([^/]+)$/,
        replacement: resolve(__dirname, "src/$1/index.ts"),
      },
    ],
  },
  test: {
    ...sharedTestConfig,
    include: ["test/**/*.test.ts"],
    testTimeout: 60_000,
  },
});
