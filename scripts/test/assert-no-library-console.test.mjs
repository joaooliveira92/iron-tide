// Tests for scripts/assert-no-library-console.mjs — the library-console gate
// (RULES.md "Services, layers, composition"). Covers the rejected log methods
// (dot and bracket), the permitted non-log members, the fail-closed parse path,
// and the allowlist semantics.
import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  ALLOWLIST,
  findLibraryConsole,
  scanLibraryConsole,
} from "../assert-no-library-console.mjs";

const count = (text) => findLibraryConsole("a.ts", text).length;

void test("rejects every console log method", () => {
  for (const method of ["log", "error", "warn", "info", "debug", "trace"]) {
    assert.equal(count(`console.${method}(x);`), 1);
  }
});

void test("rejects a bracket-accessed log method", () => {
  assert.equal(count('console["warn"](x);'), 1);
});

void test("permits other console members and other objects", () => {
  assert.equal(count("console.dir(x);"), 0);
  assert.equal(count("logger.error(x);"), 0);
});

void test("reports the offending line and method", () => {
  const findings = findLibraryConsole("a.ts", "const a = 1;\nconsole.error(x);\n");
  assert.equal(findings.length, 1);
  assert.equal(findings[0].line, 2);
  assert.equal(findings[0].method, "error");
});

void test("fails closed on a parse error", () => {
  assert.throws(() => findLibraryConsole("a.ts", "console.error("), /failing closed/u);
});

void test("every allowlist entry carries a reason", () => {
  assert.ok(ALLOWLIST.length > 0);
  for (const entry of ALLOWLIST) assert.ok(entry.reason.length > 0);
});

void test("the real tree is clean", () => {
  const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
  assert.deepEqual(scanLibraryConsole(repoRoot), []);
});
