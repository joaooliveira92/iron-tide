// Tests for scripts/verify-package-agents.mjs — per-package AGENTS.md drift gate.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { checkAgentsDoc, verifyPackageAgents } from "../verify-package-agents.mjs";

const doc = (name, cls) => `# @bluewave/${name}

**Role:** r.

**Class:** ${cls}

**Boundary:** b.

**Invariants:**
- i

See [AGENTS.md](../../AGENTS.md).
`;

void test("a conforming doc has no problems", () => {
  assert.deepEqual(checkAgentsDoc("a", doc("a", "runtime-free"), new Set(["a"])), []);
});

void test("a class that contradicts the runtime-free gate is reported", () => {
  const problems = checkAgentsDoc("a", doc("a", "io-boundary"), new Set(["a"]));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /runtime-free gate implies "runtime-free"/u);
});

void test("the gate reports missing docs, unbudgeted docs and stale exemptions", () => {
  const dir = mkdtempSync(join(tmpdir(), "pkg-agents-"));
  for (const n of ["a", "b", "c"]) mkdirSync(join(dir, "packages", n), { recursive: true });
  writeFileSync(join(dir, "packages/a/AGENTS.md"), doc("a", "runtime-free"));
  const roots = ["packages/a/src"];
  const violations = verifyPackageAgents(dir, {}, roots, { c: "x", ghost: "y" });
  assert.deepEqual(violations.map((v) => v.split(":")[0]).sort(), [
    'EXEMPT lists unknown package "ghost"',
    "packages/a/AGENTS.md",
    "packages/b/AGENTS.md",
  ]);
});
