#!/usr/bin/env node
// License gate: fail the build if a shipped (production) dependency carries a license we have
// not cleared. Weak copyleft (LGPL) is allowed; strong copyleft (GPL/AGPL), source-available
// (SSPL/BUSL/Commons-Clause) and unlicensed packages are not.
//
// Standalone: `pnpm check:licenses`.

"use strict";

const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");

function isDenied(license) {
  const l = license.toUpperCase();
  if (l.includes("LGPL")) return false; // weak copyleft: allowed
  return /(AGPL|\bGPL|SSPL|BSL-1|BUSL|UNLICENSED|COMMONS-CLAUSE|UNKNOWN)/.test(l);
}

let byLicense;
try {
  const raw = execFileSync("pnpm", ["licenses", "list", "--prod", "--json"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  byLicense = JSON.parse(raw);
} catch (err) {
  console.error(`license-check: could not read the dependency licenses: ${err.message}`);
  process.exit(1);
}

const offenders = [];
for (const [license, packages] of Object.entries(byLicense)) {
  if (!isDenied(license)) continue;
  for (const pkg of packages)
    offenders.push(`${pkg.name}@${pkg.versions?.at?.(-1) ?? "?"} — ${license}`);
}

if (offenders.length > 0) {
  console.error("license-check: FAILED — uncleared licenses in shipped dependencies\n");
  for (const o of offenders) console.error(`  - ${o}`);
  console.error(
    "\nReplace the dependency, clear the license, or extend scripts/license-check.cjs.",
  );
  process.exit(1);
}

const total = Object.values(byLicense).reduce((n, p) => n + p.length, 0);
console.log(
  `license-check: ok (${total} production dependencies across ${Object.keys(byLicense).length} licenses)`,
);
