#!/usr/bin/env node
// Keep presentation formatting in its one home (U-3 map D6, ADR-0218).
//
// The renderer scattered `Intl`/`toLocaleString`/`toFixed` and ad-hoc unit
// conversion across components. This gate freezes the current inventory as a
// ratchet (like verify-no-unknown-casts): the count may only fall. New ad-hoc
// formatting outside the single presentation module
// (`apps/desktop/src/renderer/lib/presentation-format/`) fails; migrate a call
// site to the module and re-seed with `--write`.
//
// Usage:
//   (default)   fail on any new ad-hoc formatting
//   --write     (re)seed the baseline from the current tree
//   --self-test run the embedded fixtures only

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const RENDERER = "apps/desktop/src/renderer";
const BASELINE_PATH = "scripts/presentation-formatting.baseline.json";
const EXEMPT_DIRS = [
  "lib/presentation-format/",
  "screens/debugging/",
  "screens/simulation/",
  "screens/tactical-sandbox/",
  "screens/map-prototype/",
];

/** Ad-hoc formatting the single module owns. */
const RULES = [
  { id: "intl", re: /\bIntl\./u },
  { id: "toLocaleString", re: /\.toLocaleString\s*\(/u },
  { id: "toLocaleDateString", re: /\.toLocaleDateString\s*\(/u },
  { id: "toFixed", re: /\.toFixed\s*\(/u },
  { id: "currency-symbol", re: /[£€¥]/u },
  // A literal dollar amount inside a string (`"$1,200"`), never template `${…}`.
  { id: "dollar-amount", re: /["'`][^"'`]*\$\d[^"'`]*["'`]/u },
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (/\.(?:[cm]?[jt]s|[jt]sx)$/u.test(name)) out.push(full);
  }
  return out;
}

function isExempt(rel) {
  if (rel.includes(".test.") || rel.endsWith("test-setup.ts")) return true;
  return EXEMPT_DIRS.some((prefix) => rel.includes(prefix));
}

export function scan(rootDir) {
  const base = join(rootDir, RENDERER);
  if (!existsSync(base)) return [];
  const findings = [];
  for (const file of walk(base)) {
    const rel = relative(rootDir, file);
    if (isExempt(rel)) continue;
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
      for (const rule of RULES) {
        if (rule.re.test(line)) {
          findings.push(`${rel}:${index + 1}:${rule.id}:${trimmed}`);
        }
      }
    });
  }
  return findings;
}

function selfTest() {
  const cases = [
    { line: "const x = value.toLocaleString();", expect: true },
    { line: "const x = new Intl.NumberFormat('en-US');", expect: true },
    { line: "const x = value.toFixed(2);", expect: true },
    { line: "const x = '£1,200';", expect: true },
    { line: "const x = ' $1,200 ';", expect: true },
    { line: "const x = `${count} items`;", expect: false },
    { line: "const x = formatMoney(value, options);", expect: false },
  ];
  let ok = true;
  for (const { line, expect } of cases) {
    const hit = RULES.some((rule) => rule.re.test(line));
    if (hit !== expect) {
      console.error(`self-test failed: ${JSON.stringify(line)} → ${hit}, expected ${expect}`);
      ok = false;
    }
  }
  if (!ok) process.exit(1);
  console.log("assert-presentation-formatting: self-test ok");
}

function main() {
  if (process.argv.includes("--self-test")) {
    selfTest();
    return;
  }
  const findings = scan(root);
  if (findings.length === 0) {
    console.error("assert-presentation-formatting: found no renderer sources — discovery bug");
    process.exit(1);
  }
  const write = process.argv.includes("--write");
  const baselineFile = join(root, BASELINE_PATH);
  const baseline = existsSync(baselineFile)
    ? new Set(JSON.parse(readFileSync(baselineFile, "utf8")))
    : new Set();
  if (write) {
    writeFileSync(
      baselineFile,
      `${JSON.stringify(
        [...findings].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
        null,
        2,
      )}\n`,
    );
    console.log(`assert-presentation-formatting: seeded ${findings.length} baseline entries`);
    return;
  }
  const introduced = findings.filter((finding) => !baseline.has(finding));
  if (introduced.length > 0) {
    console.error(
      `assert-presentation-formatting: ${introduced.length} new ad-hoc formatting site(s):`,
    );
    for (const finding of introduced.slice(0, 40)) console.error(`  ${finding}`);
    console.error(
      "Move them to apps/desktop/src/renderer/lib/presentation-format/ or re-seed with --write.",
    );
    process.exit(1);
  }
  console.log(`assert-presentation-formatting: ok (${findings.length} baselined, 0 new)`);
}

if (import.meta.filename === process.argv[1]) main();
