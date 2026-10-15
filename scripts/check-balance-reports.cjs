#!/usr/bin/env node
// Fails when the committed balance reports drift from what the deterministic
// benchmark tests regenerate. The reports are generated (not hand-authored):
// the two balance tests write them under BALANCE_BENCH_WRITE=1 /
// BALANCE_SWEEP_WRITE=1. This script re-runs those tests with the flags set and
// asks git whether the tracked report files changed. Run it in CI so a stale or
// hand-edited report cannot merge.
//
//   node scripts/check-balance-reports.cjs
const { execFileSync, spawnSync } = require("child_process");

const REPORTS = ["docs/research/p1-tactical-benchmark.md", "docs/research/p1-balance-sweep.md"];

const run = spawnSync(
  "pnpm",
  [
    "--filter",
    "@bluewave/combat",
    "exec",
    "vp",
    "test",
    "run",
    "test/balance/tactical-benchmark.test.ts",
    "test/balance/p1-balance-sweep.test.ts",
  ],
  {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, BALANCE_BENCH_WRITE: "1", BALANCE_SWEEP_WRITE: "1" },
  },
);
if (run.status !== 0) {
  console.error("balance-report check: the benchmark tests failed; reports cannot be trusted");
  process.exit(run.status ?? 1);
}

const changed = execFileSync("git", ["diff", "--name-only", "--", ...REPORTS], {
  encoding: "utf8",
})
  .trim()
  .split("\n")
  .filter(Boolean);

if (changed.length > 0) {
  console.error(
    "balance-report check: committed reports are stale; regenerate with the *_WRITE=1 flags:",
  );
  for (const file of changed) console.error(`  ${file}`);
  process.exit(1);
}

console.log("balance-report check: ok (reports match the deterministic benchmark)");
