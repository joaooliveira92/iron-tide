import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

import { EXEMPT, runSelfTest } from "../verify-adr-scopes.mjs";

const require = createRequire(import.meta.url);
const lib = require("../lib/adr-scope.cjs");
const repo = resolve(import.meta.dirname, "../..");

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), "adr-scope-"));
  for (const rel of ["docs/adr", "AGENTS.md", "content/AGENTS.md"]) {
    cpSync(join(repo, rel), join(dir, rel), { recursive: true });
  }
  for (const group of ["packages", "apps"]) {
    cpSync(join(repo, group), join(dir, group), {
      recursive: true,
      filter: (src) =>
        !src.includes("node_modules") && !/\/(src|test|e2e|build|scripts)$/.test(src),
    });
  }
  return dir;
}

void test("the committed repository satisfies the ADR scope gate", () => {
  assert.deepEqual(lib.verify(repo, EXEMPT), []);
});

void test("the gate's self-test proves each failure mode", () => {
  assert.equal(runSelfTest(repo), true);
});

void test("removing one ADR scope mapping makes the gate fail", () => {
  const dir = sandbox();
  try {
    const file = join(
      dir,
      "docs/adr/ADR-0271-combat-package-exposes-three-verbs-and-subsystem-seams.md",
    );
    writeFileSync(file, readFileSync(file, "utf8").replace(/^Applies to:.*\n\n/m, ""));
    const problems = lib.verify(dir, EXEMPT);
    assert.ok(problems.some((p) => p.includes("ADR-0271") && p.includes("missing")));
    assert.ok(problems.some((p) => p.includes("docs/adr/by-scope/combat.md is stale")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

void test("a package doc citing a superseded ADR without its replacement fails", () => {
  const dir = sandbox();
  try {
    const file = join(dir, "packages/campaign/AGENTS.md");
    const base = readFileSync(file, "utf8");
    writeFileSync(file, `${base}\nSee ADR-0204.\n`);
    assert.ok(
      lib.verify(dir, EXEMPT).some((p) => p.includes("superseded") && p.includes("ADR-0204")),
    );
    writeFileSync(file, `${base}\nSee ADR-0204 and ADR-0282.\n`);
    assert.ok(!lib.verify(dir, EXEMPT).some((p) => p.includes("without its replacement")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

void test("deleting a package's index link makes the gate fail", () => {
  const dir = sandbox();
  try {
    const file = join(dir, "packages/phase-engine/AGENTS.md");
    writeFileSync(
      file,
      readFileSync(file, "utf8").replaceAll("by-scope/phase-engine.md", "gone.md"),
    );
    assert.ok(
      lib
        .verify(dir, EXEMPT)
        .some((p) => p.includes("phase-engine/AGENTS.md") && p.includes("must link")),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

void test("a new duplicate ADR number is rejected", () => {
  const records = lib.loadRecords(repo);
  const extra = { ...records.find((r) => r.number === "0300"), file: "ADR-0300-other.md" };
  const problems = lib.validateRecords([...records, extra], lib.scopeUniverse(repo));
  assert.ok(problems.some((p) => p.includes("ADR-0300 is used by 2 files")));
});
