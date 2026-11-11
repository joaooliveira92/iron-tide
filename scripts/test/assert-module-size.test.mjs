// Tests for scripts/assert-module-size.mjs — the TypeScript module-size ratchet:
// logical-line counting, handwritten-file selection, the hard limits, and the
// baseline allowance that may only shrink.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, test } from "node:test";

import {
  HARD_BYTES,
  HARD_LINES,
  REVIEW_LINES,
  WARN_BYTES,
  countLogicalLines,
  evaluateModuleSizes,
  isHandwrittenSource,
  isStrictEnvironment,
  verifyModuleSize,
} from "../assert-module-size.mjs";

const SCRIPT = resolve(import.meta.dirname, "..", "assert-module-size.mjs");

const lines = (file, text) => countLogicalLines(file, text);
const sized = (file, lineCount, byteCount = 1000) => ({ file, lines: lineCount, bytes: byteCount });

void test("policy thresholds", () => {
  assert.equal(REVIEW_LINES, 400);
  assert.equal(HARD_LINES, 600);
  assert.equal(WARN_BYTES, 50 * 1024);
  assert.equal(HARD_BYTES, 100 * 1024);
});

void test("counts: blank lines and whitespace-only lines are not logical", () => {
  assert.equal(lines("a.ts", "const a = 1;\n\n   \n\t\nconst b = 2;\n"), 2);
});

void test("counts: line comments and block comments are not logical", () => {
  const text = "// head\nconst a = 1;\n/* one */\n/*\n * two\n */\n/** doc */\nconst b = 2;\n";
  assert.equal(lines("a.ts", text), 2);
});

void test("counts: a line with code and a trailing or leading comment is logical", () => {
  assert.equal(lines("a.ts", "const a = 1; // tail\n/* lead */ const b = 2;\n"), 2);
});

void test("counts: // inside a string or URL does not start a comment", () => {
  const text = 'const url = "https://example.test/a//b";\nconst re = /\\/\\//u;\n';
  assert.equal(lines("a.ts", text), 2);
});

void test("counts: comment markers inside a template literal stay code", () => {
  const text = "const t = `\n// not a comment\n/* nor this */\n`;\n";
  assert.equal(lines("a.ts", text), 4);
});

void test("counts: a shebang line is not logical", () => {
  assert.equal(lines("a.ts", "#!/usr/bin/env node\nconst a = 1;\n"), 1);
});

void test("counts: tsx text and JSX comments", () => {
  const text = "const a = (\n  <div>\n    {/* note */}\n    // literal jsx text\n  </div>\n);\n";
  assert.equal(lines("a.tsx", text), 6);
});

void test("counts: CRLF files match LF files", () => {
  assert.equal(lines("a.ts", "// c\r\nconst a = 1;\r\n\r\nconst b = 2;\r\n"), 2);
});

void test("counts: an unparseable file fails closed", () => {
  assert.throws(() => lines("a.ts", "const = ;;; {{{\n"), /cannot parse a\.ts/u);
});

void test("selection: handwritten .ts and .tsx are measured", () => {
  assert.equal(isHandwrittenSource("packages/combat/src/a.ts"), true);
  assert.equal(isHandwrittenSource("apps/desktop/src/renderer/App.tsx"), true);
  assert.equal(isHandwrittenSource("packages/combat/test/a.test.ts"), true);
  assert.equal(isHandwrittenSource("vite.config.ts"), true);
});

void test("selection: non-TypeScript is not measured", () => {
  assert.equal(isHandwrittenSource("scripts/a.mjs"), false);
  assert.equal(isHandwrittenSource("packages/a/data.json"), false);
});

void test("selection: generated, declaration, fixture and migration files are exempt", () => {
  const exempt = [
    "packages/ship-visual/src/catalog.generated.ts",
    "packages/x/src/schema.gen.ts",
    "packages/x/src/generated/a.ts",
    "packages/x/src/types.d.ts",
    "packages/x/test/fixtures/a.ts",
    "packages/x/test/__fixtures__/a.ts",
    "packages/x/src/migrations/001.ts",
  ];
  for (const file of exempt) assert.equal(isHandwrittenSource(file), false, file);
});

void test("selection: vendored, agent, worktree, dependency and dataset trees are exempt", () => {
  const exempt = [
    "vendor/effect/src/Effect.ts",
    "repos/x/a.ts",
    ".agents/skills/x/a.ts",
    ".worktrees/a/src/a.ts",
    "packages/x/node_modules/y/a.ts",
    "content/production/1880/countries.ts",
    "apps/desktop/src/renderer/components/world-map/coastline-data.ts",
    "apps/desktop/src/renderer/components/world-map/borders-1880-data.ts",
  ];
  for (const file of exempt) assert.equal(isHandwrittenSource(file), false, file);
});

void test("selection: a name that only resembles an exemption is still measured", () => {
  assert.equal(isHandwrittenSource("packages/x/src/generatedNames.ts"), true);
  assert.equal(isHandwrittenSource("packages/x/src/fixturesLoader.ts"), true);
  assert.equal(isHandwrittenSource("packages/persistence/src/saveMigration.ts"), true);
});

void test("evaluate: files at or under the hard limit pass", () => {
  const result = evaluateModuleSizes([sized("a.ts", HARD_LINES), sized("b.ts", 1)], {});
  assert.deepEqual(result.violations, []);
  assert.deepEqual(result.tighten, []);
});

void test("evaluate: a file over 600 logical lines with no allowance fails", () => {
  const result = evaluateModuleSizes([sized("a.ts", HARD_LINES + 1)], {});
  assert.equal(result.violations.length, 1);
  assert.match(result.violations[0], /a\.ts.*601.*600/u);
});

void test("evaluate: a file over 100 KB fails even with few lines", () => {
  const result = evaluateModuleSizes([sized("a.ts", 10, HARD_BYTES + 1)], {});
  assert.equal(result.violations.length, 1);
  assert.match(result.violations[0], /a\.ts.*bytes/u);
});

void test("evaluate: exactly 100 KB passes", () => {
  const result = evaluateModuleSizes([sized("a.ts", 10, HARD_BYTES)], {});
  assert.deepEqual(result.violations, []);
});

void test("evaluate: a baselined file may stay the same size", () => {
  const result = evaluateModuleSizes([sized("a.ts", 900)], { "a.ts": { lines: 900 } });
  assert.deepEqual(result.violations, []);
  assert.deepEqual(result.tighten, []);
});

void test("evaluate: a baselined file that grows fails", () => {
  const result = evaluateModuleSizes([sized("a.ts", 901)], { "a.ts": { lines: 900 } });
  assert.equal(result.violations.length, 1);
  assert.match(result.violations[0], /a\.ts.*grew.*900.*901/u);
});

void test("evaluate: a baselined file over the byte limit that grows fails", () => {
  const result = evaluateModuleSizes([sized("a.ts", 10, HARD_BYTES + 11)], {
    "a.ts": { bytes: HARD_BYTES + 10 },
  });
  assert.equal(result.violations.length, 1);
  assert.match(result.violations[0], /grew/u);
});

void test("evaluate: a line allowance does not excuse a new byte violation", () => {
  const result = evaluateModuleSizes([sized("a.ts", 900, HARD_BYTES + 1)], {
    "a.ts": { lines: 900 },
  });
  assert.equal(result.violations.length, 1);
  assert.match(result.violations[0], /bytes/u);
});

void test("evaluate: a baselined file that shrinks but stays over the limit must be tightened", () => {
  const result = evaluateModuleSizes([sized("a.ts", 800)], { "a.ts": { lines: 900 } });
  assert.deepEqual(result.violations, []);
  assert.equal(result.tighten.length, 1);
  assert.match(result.tighten[0], /a\.ts.*900.*800/u);
});

void test("evaluate: a baselined file that drops under the limit is stale", () => {
  const result = evaluateModuleSizes([sized("a.ts", 600)], { "a.ts": { lines: 900 } });
  assert.deepEqual(result.violations, []);
  assert.equal(result.tighten.length, 1);
  assert.match(result.tighten[0], /a\.ts.*no longer exceeds/u);
});

void test("evaluate: a baselined file that no longer exists is stale", () => {
  const result = evaluateModuleSizes([], { "gone.ts": { lines: 900 } });
  assert.equal(result.tighten.length, 1);
  assert.match(result.tighten[0], /gone\.ts.*no longer exists/u);
});

void test("evaluate: files over the review thresholds warn without failing", () => {
  const result = evaluateModuleSizes(
    [
      sized("a.ts", REVIEW_LINES + 1),
      sized("b.ts", 10, WARN_BYTES + 1),
      sized("c.ts", REVIEW_LINES),
    ],
    {},
  );
  assert.deepEqual(result.violations, []);
  assert.deepEqual(result.warnings, ["a.ts", "b.ts"]);
});

void test("evaluate: a baselined file is not repeated as a warning", () => {
  const result = evaluateModuleSizes([sized("a.ts", 900)], { "a.ts": { lines: 900 } });
  assert.deepEqual(result.warnings, []);
});

void test("evaluate: output order is sorted by path regardless of input order", () => {
  const result = evaluateModuleSizes(
    [sized("z.ts", 700), sized("b.ts", 700), sized("m.ts", 450), sized("a.ts", 450)],
    {},
  );
  assert.deepEqual(
    result.violations.map((line) => line.split(":")[0]),
    ["b.ts", "z.ts"],
  );
  assert.deepEqual(result.warnings, ["a.ts", "m.ts"]);
});

void test("strict environment follows CI", () => {
  assert.equal(isStrictEnvironment({ CI: "true" }), true);
  assert.equal(isStrictEnvironment({ CI: "1" }), true);
  assert.equal(isStrictEnvironment({ CI: "" }), false);
  assert.equal(isStrictEnvironment({ CI: "0" }), false);
  assert.equal(isStrictEnvironment({ CI: "false" }), false);
  assert.equal(isStrictEnvironment({}), false);
});

const roots = [];

after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function body(count) {
  return Array.from({ length: count }, (_, index) => `export const v${index} = ${index};`).join(
    "\n",
  );
}

function makeRepo(files, baseline = {}) {
  const root = mkdtempSync(join(tmpdir(), "bw-module-size-"));
  roots.push(root);
  const all = {
    "packages/p/src/seed.ts": "export const seed = 1;\n",
    "apps/a/src/seed.ts": "export const seed = 1;\n",
    "scripts/module-size.baseline.json": `${JSON.stringify(baseline, null, 2)}\n`,
    ...files,
  };
  for (const [rel, content] of Object.entries(all)) {
    const full = join(root, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content, "utf8");
  }
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["add", "-A"], { cwd: root });
  return root;
}

function runCli(root, args, env = {}) {
  try {
    const stdout = execFileSync("node", [SCRIPT, "--root", root, ...args], {
      encoding: "utf8",
      env: { ...process.env, CI: "", ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, stdout, stderr: "" };
  } catch (error) {
    return { code: error.status, stdout: String(error.stdout), stderr: String(error.stderr) };
  }
}

void test("verify: a clean tree passes", () => {
  const root = makeRepo({ "packages/p/src/big.ts": body(100) });
  const result = verifyModuleSize(root, "verify", false);
  assert.deepEqual(result.violations, []);
});

void test("verify: a new oversize file fails and --write seeds it", () => {
  const root = makeRepo({ "packages/p/src/big.ts": body(650) });
  assert.equal(verifyModuleSize(root, "verify", false).violations.length, 1);
  verifyModuleSize(root, "write", false);
  const written = JSON.parse(readFileSync(join(root, "scripts/module-size.baseline.json"), "utf8"));
  assert.deepEqual(written, { "packages/p/src/big.ts": { lines: 650 } });
  assert.deepEqual(verifyModuleSize(root, "verify", false).violations, []);
});

void test("verify: exempt trees never reach the baseline", () => {
  const root = makeRepo({
    "packages/p/src/big.generated.ts": body(900),
    "content/production/data.ts": body(900),
    "vendor/lib/a.ts": body(900),
  });
  assert.deepEqual(verifyModuleSize(root, "verify", false).violations, []);
});

void test("verify: --prune lowers or removes entries and never adds", () => {
  const root = makeRepo(
    { "packages/p/src/shrunk.ts": body(700), "packages/p/src/fresh.ts": body(800) },
    {
      "packages/p/src/shrunk.ts": { lines: 900 },
      "packages/p/src/gone.ts": { lines: 900 },
      "packages/p/src/fresh.ts": { lines: 800 },
    },
  );
  verifyModuleSize(root, "prune", false);
  const written = JSON.parse(readFileSync(join(root, "scripts/module-size.baseline.json"), "utf8"));
  assert.deepEqual(written, {
    "packages/p/src/fresh.ts": { lines: 800 },
    "packages/p/src/shrunk.ts": { lines: 700 },
  });
});

void test("verify: --prune refuses to rewrite while a violation exists", () => {
  const root = makeRepo(
    { "packages/p/src/shrunk.ts": body(700), "packages/p/src/extra.ts": body(700) },
    { "packages/p/src/shrunk.ts": { lines: 900 } },
  );
  const result = verifyModuleSize(root, "prune", false);
  assert.equal(result.violations.length, 1);
  const written = JSON.parse(readFileSync(join(root, "scripts/module-size.baseline.json"), "utf8"));
  assert.deepEqual(written, { "packages/p/src/shrunk.ts": { lines: 900 } });
});

void test("verify: strict mode makes stale allowances fatal; local mode only reports them", () => {
  const root = makeRepo(
    { "packages/p/src/small.ts": body(10) },
    { "packages/p/src/small.ts": { lines: 900 } },
  );
  const local = verifyModuleSize(root, "verify", false);
  assert.deepEqual(local.violations, []);
  assert.equal(local.tighten.length, 1);
  const strict = runCli(root, [], { CI: "true" });
  assert.equal(strict.code, 1);
  assert.match(strict.stderr, /--prune/u);
});

void test("cli: passes on a clean tree and fails with a path on a violation", () => {
  const clean = makeRepo({});
  assert.equal(runCli(clean, []).code, 0);
  const dirty = makeRepo({ "packages/p/src/huge.ts": body(700) });
  const result = runCli(dirty, []);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /packages\/p\/src\/huge\.ts/u);
});

void test("cli: --self-test succeeds", () => {
  const result = runCli(makeRepo({}), ["--self-test"]);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /self-test ok/u);
});

void test("cli: rejects unknown flags and conflicting modes", () => {
  const root = makeRepo({});
  assert.equal(runCli(root, ["--nope"]).code, 1);
  assert.equal(runCli(root, ["--write", "--prune"]).code, 1);
});
