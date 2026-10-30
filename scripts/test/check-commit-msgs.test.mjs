// Tests for scripts/check-commit-msgs.cjs — the Conventional-Commit subject
// gate. Covers the fail-closed contract: an unresolvable range is fatal when CI
// is set (no silent green) but a local skip otherwise, and the `--message-file`
// hook mode validates one subject without needing any range.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const script = join(dirname(fileURLToPath(import.meta.url)), "..", "check-commit-msgs.cjs");
const UNRESOLVABLE_RANGE = "does-not-exist..HEAD";

function run(args = [], env = {}, cwd) {
  const base = { ...process.env, COMMIT_RANGE: UNRESOLVABLE_RANGE };
  delete base.CI;
  return spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    cwd,
    env: { ...base, ...env },
  });
}

void test("fails closed when CI is set and the range is unavailable", () => {
  const result = run([], { CI: "true" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unavailable/u);
  assert.match(result.stderr, /does-not-exist\.\.HEAD/u);
});

void test("skips (non-fatal) when CI is unset and the range is unavailable", () => {
  const result = run([], {});
  assert.equal(result.status, 0);
  assert.match(result.stdout, /skipping/u);
});

void test("skips when CI is explicitly disabled", () => {
  const result = run([], { CI: "false" });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /skipping/u);
});

void test("accepts a resolvable range of Conventional subjects", () => {
  const dir = mkdtempSync(join(tmpdir(), "bw-commit-msg-"));
  try {
    const git = (args) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });
    git(["init", "-q", "-b", "main"]);
    writeFileSync(join(dir, "a.txt"), "one\n");
    git(["add", "a.txt"]);
    git(["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "feat: first"]);
    writeFileSync(join(dir, "b.txt"), "two\n");
    git(["add", "b.txt"]);
    git(["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "fix(core): second"]);
    writeFileSync(join(dir, "c.txt"), "three\n");
    git(["add", "c.txt"]);
    git(["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "docs: third"]);
    const result = run([], { COMMIT_RANGE: "HEAD~2..HEAD" }, dir);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /ok \(2 subject\(s\)/u);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

void test("validates a single subject from --message-file without a range", () => {
  const dir = mkdtempSync(join(tmpdir(), "bw-commit-msg-"));
  try {
    const file = join(dir, "COMMIT_EDITMSG");
    writeFileSync(file, "\n# a comment line\nfeat(combat): add torpedo reload\n");
    const result = run(["--message-file", file], { CI: "true" });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /ok/u);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

void test("rejects a non-Conventional subject from --message-file", () => {
  const dir = mkdtempSync(join(tmpdir(), "bw-commit-msg-"));
  try {
    const file = join(dir, "COMMIT_EDITMSG");
    writeFileSync(file, "tweaked some stuff\n");
    const result = run(["--message-file", file], { CI: "true" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /not a Conventional Commit/u);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
