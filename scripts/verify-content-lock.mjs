#!/usr/bin/env node
// Preflight gate (CAH-LOCK-3): rebuild the compiled content in memory and verify
// it against the committed content lock, so local green implies CI green. The
// compiler CLI is built first (incrementally), then `content:verify` runs over
// the production pack.
import { execFileSync, execSync } from "node:child_process";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

try {
  execSync("pnpm --filter @bluewave/compiler-cli build", { cwd: ROOT, stdio: "inherit" });
  execFileSync(
    process.execPath,
    [
      "apps/compiler-cli/dist/main.js",
      "content:verify",
      "--manifest",
      "content/production/1880/pack.json",
      "--content-dir",
      "content/production/1880",
    ],
    { cwd: ROOT, stdio: "inherit" },
  );
  console.log("verify-content-lock: ok");
} catch {
  console.error("verify-content-lock: content:verify failed (see output above)");
  process.exit(1);
}
