// Tests for scripts/verify-no-upgradepath-refit-readers.mjs — the no-reader gate's
// detection boundary (ship-part-model ticket 14, SPM-R18 AC3). Covers code hits,
// comment exemptions, string handling, and substring non-matches.
import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  FORBIDDEN_TOKEN,
  SCANNED_FILES,
  SUPERSESSION_FORBIDDEN_FILES,
  findSupersessionReaders,
  findUpgradePathReaders,
  scanUpgradePathReaders,
  stripComments,
} from "../verify-no-upgradepath-refit-readers.mjs";

const count = (text) => findUpgradePathReaders("packages/ship-design/src/a.ts", text).length;
const supersedesCount = (text) =>
  findSupersessionReaders("packages/ship-design/src/refit.ts", text).length;

void test("flags the retired succession field in code", () => {
  assert.equal(count(`const x = def.${FORBIDDEN_TOKEN};`), 1);
});

void test("flags the field in an import/export statement", () => {
  assert.equal(count("import { upgradePath } from './component.js';"), 1);
});

void test("does not flag the field in a line or block comment", () => {
  assert.equal(count("// upgradePath is retired"), 0);
  assert.equal(count("/*\n * upgradePath\n */\nconst a = 1;"), 0);
});

void test("does not treat `//` inside a string as a comment", () => {
  assert.equal(stripComments('const u = "https://x";'), 'const u = "https://x";');
});

void test("does not flag a substring of another identifier", () => {
  assert.equal(count("const x = myUpgradePathFinder;"), 0);
  assert.equal(count("const x = upgrade_path;"), 0);
});

void test("reports the offending line", () => {
  const findings = findUpgradePathReaders(
    "packages/ship-design/src/a.ts",
    "const a = 1;\nconst b = def.upgradePath;\n",
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0].line, 2);
});

void test("flags a supersession read in the acceptance modules, not in a comment", () => {
  assert.equal(supersedesCount("const s = part.lifecycle.supersedes;"), 1);
  assert.equal(supersedesCount("// supersedes is informational"), 0);
});

void test("the guarded repository modules hold no upgradePath reader", () => {
  assert.ok(SCANNED_FILES.length > 0);
  assert.ok(SUPERSESSION_FORBIDDEN_FILES.length > 0);
  assert.deepEqual(scanUpgradePathReaders(fileURLToPath(new URL("../..", import.meta.url))), []);
});
