#!/usr/bin/env node
// Preflight gate (CAH-PROV-3): fail a shipping pack that still carries an
// unresolved placeholder value (unless it is on the committed, justified
// allowlist). The compiler CLI is built first (incrementally), then
// `content:gate` runs over the production pack.
import { execFileSync, execSync } from "node:child_process";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

try {
  execSync(
    "pnpm --filter @bluewave/content-authoring build && pnpm --filter @bluewave/compiler-cli build",
    { cwd: ROOT, stdio: "inherit" },
  );
  execFileSync(
    process.execPath,
    [
      "apps/compiler-cli/dist/main.js",
      "content:gate",
      "--manifest",
      "content/production/1880/pack.json",
      "--content-dir",
      "content/production/1880",
    ],
    { cwd: ROOT, stdio: "inherit" },
  );
  console.log("verify-content-gate: ok");
} catch {
  console.error("verify-content-gate: content:gate failed (see output above)");
  process.exit(1);
}
