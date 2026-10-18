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
    // The renderer suite is heavy (jsdom + axe-core audits over large DOMs). Left at the default
    // (one worker per core) the load starves the axe passes and they time out mid-run. A bounded
    // pool keeps them well inside their per-test timeouts.
    maxWorkers: 4,
    minWorkers: 1,
    // Debug-only sidebar screens (Simulation, Tactical Sandbox, Debugging)
    // are gated by VITE_BLUEWAVE_DEBUG, not by dev-mode — set it so their
    // routes are still exercised by campaign-screen-registry.test.tsx.
    env: { VITE_BLUEWAVE_DEBUG: "true" },
    // e2e/ holds Playwright specs (run via `playwright test`, not vitest) —
    // excluded explicitly since Playwright's own test() throws when picked
    // up by another runner. dist/ is gitignored `tsc -b` output; its
    // `.test.jsx` emits reference sibling `.js` imports that don't exist
    // (tsconfig emits `.jsx` under `"jsx": "preserve"`, not `.js`), so
    // running `pnpm typecheck` before `pnpm test` in the same tree would
    // otherwise surface phantom import-resolution failures unrelated to
    // any real test.
    exclude: ["**/node_modules/**", "e2e/**", "dist/**"],
  },
});
