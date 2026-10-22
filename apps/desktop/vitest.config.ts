import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";
import { sharedTestConfig } from "../../scripts/vitest-shared.mjs";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src/renderer"),
    },
  },
  test: {
    ...sharedTestConfig,
    globals: true,
    globalSetup: ["./scripts/content-global-setup.mjs"],
    setupFiles: ["./src/renderer/test-setup.ts"],
    testTimeout: 60000,
    hookTimeout: 60000,
    environment: "jsdom",
    maxWorkers: 4,
    minWorkers: 1,
    env: { VITE_BLUEWAVE_DEBUG: "true" },
    exclude: ["**/node_modules/**", "e2e/**", "dist/**"],
  },
});
