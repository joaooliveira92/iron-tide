/**
 * Vitest global setup: build the compiled content artifact once before the
 * desktop suite runs, so main-process content loaders (which now consume the
 * artifact, not raw YAML) have exactly the content the compiler validated.
 *
 * `build-content.mjs` (and the desktop suite) import `@bluewave/content-compiler`
 * through its built `dist`. Rebuild that package first so editing its source can
 * never leave the suite testing against a stale artifact — the build is a hard
 * dependency of the test task, not an assumption.
 */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const PNPM = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

export default function globalSetup() {
  const repoRoot = resolve(import.meta.dirname, "../../..");
  execFileSync(PNPM, ["--filter", "@bluewave/content-compiler", "build"], {
    cwd: repoRoot,
    stdio: "inherit",
    // Node refuses to exec a `.cmd` directly on Windows (EINVAL); run it through
    // the shell there so the determinism gate is green on Windows too.
    shell: process.platform === "win32",
  });
  const script = resolve(import.meta.dirname, "build-content.mjs");
  execFileSync(process.execPath, [script], { stdio: "inherit" });
}
