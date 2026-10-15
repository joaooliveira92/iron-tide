#!/usr/bin/env node
// Cross-process determinism proof for the ship-part equivalence report and the whole-catalogue
// part build (SPM-R24): run each harness test in two fresh processes and require its SHA-256
// to match. The equivalence report is gated through `checkWithApprovedDiffs` (the committed
// approved-diffs manifest), so the canonical gate never bypasses the manifest.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkg = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "packages",
  "ship-design",
);

function runOnce(file, pattern) {
  const out = execFileSync("pnpm", ["exec", "vp", "test", "run", "--reporter=verbose", file], {
    cwd: pkg,
    encoding: "utf8",
    timeout: 300000,
    shell: process.platform === "win32",
  });
  const m = pattern.exec(out);
  if (m === null) throw new Error(`${file}: hash not found in test output`);
  return m[1];
}

function prove(label, file, pattern) {
  const first = runOnce(file, pattern);
  const second = runOnce(file, pattern);
  if (first !== second) {
    console.error(`${label}: runs differ\n${first}\n${second}`);
    process.exit(1);
  }
  return first;
}

const report = prove(
  "equivalence determinism",
  "test/equivalenceHarness.test.ts",
  /EQUIVALENCE_REPORT_SHA256 ([0-9a-f]{64})/,
);
const catalogue = prove(
  "catalogue determinism",
  "test/partCatalogue.test.ts",
  /PART_CATALOGUE_SHA256 ([0-9a-f]{64})/,
);
console.log(
  `equivalence determinism: two fresh processes byte-identical (report sha256 ${report})`,
);
console.log(
  `catalogue determinism: two fresh processes byte-identical (parts sha256 ${catalogue})`,
);
