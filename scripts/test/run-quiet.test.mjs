import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { parseArgv, tailLines } from "../run-quiet.mjs";

const ROOT = resolve(import.meta.dirname, "..", "..");
const SCRIPT = join(ROOT, "scripts/run-quiet.mjs");
const POLICY = JSON.parse(
  readFileSync(join(ROOT, "scripts/data/agent-context-policy.json"), "utf8"),
);
const sandbox = mkdtempSync(join(tmpdir(), "run-quiet-"));
after(() => rmSync(sandbox, { recursive: true, force: true }));

const run = (args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });

void test("a passing command prints one line and keeps the full log", () => {
  const log = join(sandbox, "pass.log");
  const result = run([
    "--log",
    log,
    "--",
    process.execPath,
    "-e",
    "for (let i=0;i<500;i++) console.log('noise '+i)",
  ]);
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim().split("\n").length, 1);
  assert.match(result.stdout, /^ok: /u);
  assert.equal(readFileSync(log, "utf8").split("\n").length > 400, true);
});

void test("a failing command exits with its code and prints only the tail plus the log path", () => {
  const log = join(sandbox, "fail.log");
  const result = run([
    "--log",
    log,
    "--",
    process.execPath,
    "-e",
    "for (let i=0;i<500;i++) console.log('line '+i); console.error('boom'); process.exit(3)",
  ]);
  assert.equal(result.status, 3);
  const lines = result.stderr.trim().split("\n");
  assert.match(lines[0], /^FAILED \(exit 3\)/u);
  assert.equal(lines.length, POLICY.quietFailTailLines + 2);
  assert.match(result.stderr, /boom/u);
  assert.doesNotMatch(result.stderr, /line 10\n/u);
  assert.match(lines.at(-1), /^full log: /u);
  assert.equal(existsSync(log), true);
});

void test("usage errors exit 2 and a missing program exits 127", () => {
  assert.equal(run([]).status, 2);
  assert.equal(run(["--bogus", "--", "true"]).status, 2);
  assert.equal(
    run(["--log", join(sandbox, "x.log"), "--", "definitely-not-a-program-xyz"]).status,
    127,
  );
});

void test("argument and tail helpers are pure", () => {
  assert.deepEqual(parseArgv(["--", "a", "b"]), { log: undefined, command: ["a", "b"] });
  assert.ok(parseArgv(["a"]).error);
  assert.deepEqual(tailLines("a\nb\nc\n", 2), ["b", "c"]);
});
