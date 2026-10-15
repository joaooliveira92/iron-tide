// Tests for scripts/change-scope.mjs — the versioned change-scope report used to
// feed change-based CI filtering. Builds a throwaway Git repository and asserts
// the committed/staged/unstaged/untracked split.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { renderChangeScope } from "../change-scope.mjs";

const git = (cwd, args) => execFileSync("git", args, { cwd, encoding: "utf8" });

void test("change-scope splits committed, staged, unstaged, and untracked paths", () => {
  const dir = mkdtempSync(join(tmpdir(), "bw-change-scope-"));
  try {
    git(dir, ["init", "-q", "-b", "main"]);
    writeFileSync(join(dir, "a.txt"), "one\n");
    git(dir, ["add", "a.txt"]);
    git(dir, ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "init"]);

    writeFileSync(join(dir, "a.txt"), "two\n"); // unstaged
    writeFileSync(join(dir, "c.txt"), "staged\n");
    git(dir, ["add", "c.txt"]); // staged
    writeFileSync(join(dir, "b.txt"), "untracked\n"); // untracked

    const report = JSON.parse(renderChangeScope(["--base", "HEAD", "--head", "HEAD"], dir));

    assert.equal(report.formatVersion, 1);
    assert.deepEqual(report.paths.committed, []);
    assert.deepEqual(report.paths.staged, ["c.txt"]);
    assert.deepEqual(report.paths.unstaged, ["a.txt"]);
    assert.deepEqual(report.paths.untracked, ["b.txt"]);
    assert.equal(report.resolved.mergeBaseSha, report.resolved.baseSha);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

void test("change-scope reports the committed delta against the merge base", () => {
  const dir = mkdtempSync(join(tmpdir(), "bw-change-scope-"));
  try {
    git(dir, ["init", "-q", "-b", "main"]);
    writeFileSync(join(dir, "a.txt"), "one\n");
    git(dir, ["add", "a.txt"]);
    git(dir, ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "init"]);

    writeFileSync(join(dir, "d.txt"), "new\n");
    git(dir, ["add", "d.txt"]);
    git(dir, ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "add d"]);

    const report = JSON.parse(renderChangeScope(["--base", "HEAD~1"], dir));
    assert.deepEqual(report.paths.committed, ["d.txt"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

void test("change-scope rejects a missing --base", () => {
  assert.throws(() => renderChangeScope([], process.cwd()), /--base/u);
});
