import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

import { buildReport, MapError, parseArguments, resolveTarget, run } from "../agent-map.mjs";

const ROOT = resolve(import.meta.dirname, "..", "..");

function git(cwd, args) {
  execFileSync("git", args, { cwd, encoding: "utf8" });
}

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "bw-agent-map-"));
  git(dir, ["init", "-q", "-b", "main"]);
  mkdirSync(join(dir, "packages", "a", "src"), { recursive: true });
  mkdirSync(join(dir, "packages", "a", "test"), { recursive: true });
  mkdirSync(join(dir, "docs", "adr", "by-scope"), { recursive: true });
  mkdirSync(join(dir, "golden"), { recursive: true });
  writeFileSync(join(dir, "golden", "hashes.json"), "{}\n");
  writeFileSync(
    join(dir, "packages", "a", "package.json"),
    `${JSON.stringify(
      {
        name: "@bluewave/a",
        exports: { ".": { types: "./src/index.ts", default: "./dist/index.js" } },
        scripts: { build: "tsc -b", test: "vp test run" },
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(dir, "packages", "a", "AGENTS.md"),
    "# @bluewave/a\n\n**Governing ADRs:** [every current ADR for this package](../../docs/adr/by-scope/a.md)\n\nGoldens move with the gate.\n",
  );
  writeFileSync(
    join(dir, "docs", "adr", "by-scope", "a.md"),
    "# ADRs governing a\n\n- [ADR-9001](../ADR-9001-test.md) A rule that applies.\n",
  );
  writeFileSync(
    join(dir, "packages", "a", "src", "index.ts"),
    "export function Widget(): number { return 1; }\n",
  );
  writeFileSync(join(dir, "packages", "a", "src", "with space.ts"), "export const Spaced = 1;\n");
  writeFileSync(
    join(dir, "packages", "a", "test", "widget.test.ts"),
    "import { Widget } from '../src/index.js';\nvoid Widget;\n",
  );
  git(dir, ["add", "-A"]);
  return dir;
}

void test("agent:map parses its arguments and rejects bad input", () => {
  assert.deepEqual(parseArguments(["--help"]), { help: true });
  assert.throws(
    () => parseArguments([]),
    (error) => error instanceof MapError && error.code === 2,
  );
  assert.throws(
    () => parseArguments(["Widget", "--limit", "0"]),
    (error) => error instanceof MapError && error.code === 2,
  );
  assert.throws(
    () => parseArguments(["Widget", "--nope"]),
    (error) => error instanceof MapError && error.code === 2,
  );
  assert.deepEqual(parseArguments(["Widget", "--json", "--limit", "3"]), {
    help: false,
    query: "Widget",
    json: true,
    limit: 3,
  });
});

void test("agent:map resolves a path with spaces and reports ownership, rules, tests and validation", () => {
  const dir = fixture();
  try {
    assert.deepEqual(resolveTarget(dir, "packages/a/src/with space.ts"), {
      kind: "path",
      path: "packages/a/src/with space.ts",
    });
    const report = buildReport(dir, "packages/a/src/with space.ts", 8);
    assert.equal(report.owner.name, "@bluewave/a");
    assert.equal(report.path, "packages/a/src/with space.ts");
    assert.deepEqual(report.instructions, ["AGENTS.md", "packages/a/AGENTS.md"]);
    assert.equal(report.rules.path, "docs/adr/by-scope/a.md");
    assert.equal(report.rules.entries.length, 1);
    assert.deepEqual(report.validation, [
      "pnpm --filter @bluewave/a build",
      "pnpm --filter @bluewave/a test",
    ]);
    assert.deepEqual(report.goldens, ["golden/hashes.json", "docs/agents/golden-repin.md"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

void test("agent:map finds one definition, its references and its test", () => {
  const dir = fixture();
  try {
    const report = buildReport(dir, "Widget", 8);
    assert.equal(report.kind, "symbol");
    assert.equal(report.definitions.length, 1);
    assert.equal(report.definitions[0].path, "packages/a/src/index.ts");
    assert.ok(report.references.some((hit) => hit.path === "packages/a/test/widget.test.ts"));
    assert.deepEqual(report.tests, ["packages/a/test/widget.test.ts"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

void test("agent:map refuses to guess between two definitions", () => {
  const dir = fixture();
  try {
    writeFileSync(
      join(dir, "packages", "a", "src", "second.ts"),
      "export function Widget(): number { return 2; }\n",
    );
    git(dir, ["add", "-A"]);
    assert.throws(
      () => buildReport(dir, "Widget", 8),
      (error) => error instanceof MapError && error.code === 3 && error.details.length === 2,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

void test("agent:map exits 4 for an unknown symbol and 2 for bad usage", () => {
  const dir = fixture();
  try {
    assert.throws(
      () => buildReport(dir, "NothingHere", 8),
      (error) => error instanceof MapError && error.code === 4,
    );
    assert.equal(run(["--nope"], dir), 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

void test("agent:map works on the real repository", () => {
  const output = execFileSync(
    process.execPath,
    [join(ROOT, "scripts", "agent-map.mjs"), "packages/combat/package.json"],
    {
      cwd: ROOT,
      encoding: "utf8",
    },
  );
  assert.match(output, /owner: @bluewave\/combat \(packages\/combat\)/u);
  assert.match(output, /rules: docs\/adr\/by-scope\/combat\.md/u);
  assert.match(output, /pnpm --filter @bluewave\/combat test/u);
});
