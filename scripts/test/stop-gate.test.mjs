import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { evaluateStop, parseStatusCount } from "../lib/stop-gate.mjs";

const HOOK = resolve(import.meta.dirname, "..", "hooks", "stop-gate.mjs");
const roots = [];

after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

const git = (cwd, ...args) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" });

function cloneWithRemoteFeature() {
  const root = mkdtempSync(join(tmpdir(), "stop-gate-"));
  roots.push(root);
  const origin = join(root, "origin.git");
  const work = join(root, "work");
  git(root, "init", "-q", "--bare", "-b", "dev", origin);
  git(root, "clone", "-q", origin, work);
  git(work, "config", "user.name", "t");
  git(work, "config", "user.email", "t@example.test");
  git(work, "config", "commit.gpgsign", "false");
  writeFileSync(join(work, "a.txt"), "base\n");
  git(work, "add", "a.txt");
  git(work, "commit", "-q", "-m", "chore: base");
  git(work, "push", "-q", "origin", "dev");
  git(work, "checkout", "-q", "-b", "feat/x");
  writeFileSync(join(work, "b.txt"), "feature\n");
  git(work, "add", "b.txt");
  git(work, "commit", "-q", "-m", "feat: x");
  git(work, "push", "-q", "origin", "feat/x");
  return work;
}

function runHook(cwd) {
  const result = spawnSync("node", [HOOK], {
    input: JSON.stringify({ cwd }),
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
  });
  return result.stdout.trim();
}

const clean = { hookActive: false, branch: "fix/x", dirtyPaths: 0, unpushedCommits: 0 };

await test("allows a clean pushed tree", () => {
  assert.equal(evaluateStop(clean).action, "allow");
});

await test("blocks uncommitted paths", () => {
  const verdict = evaluateStop({ ...clean, dirtyPaths: 2 });
  assert.equal(verdict.action, "block");
  assert.match(verdict.message, /2 uncommitted/u);
});

await test("blocks unpushed commits", () => {
  const verdict = evaluateStop({ ...clean, unpushedCommits: 1 });
  assert.equal(verdict.action, "block");
  assert.match(verdict.message, /1 unpushed commit\(s\) on fix\/x/u);
});

await test("names the protected branch rule on dev", () => {
  const verdict = evaluateStop({ ...clean, branch: "dev", dirtyPaths: 1 });
  assert.match(verdict.message, /branch off it first/u);
});

await test("never loops once the hook already fired", () => {
  assert.equal(evaluateStop({ ...clean, hookActive: true, dirtyPaths: 3 }).action, "allow");
});

await test("hook allows a detached HEAD already on a remote branch", () => {
  const work = cloneWithRemoteFeature();
  git(work, "checkout", "-q", "--detach", "feat/x");
  assert.equal(runHook(work), "");
});

await test("hook blocks a detached HEAD commit that no remote has", () => {
  const work = cloneWithRemoteFeature();
  git(work, "checkout", "-q", "--detach", "feat/x");
  writeFileSync(join(work, "c.txt"), "local\n");
  git(work, "add", "c.txt");
  git(work, "commit", "-q", "-m", "feat: local");
  assert.match(runHook(work), /1 unpushed commit\(s\) on HEAD/u);
});

await test("hook still counts commits ahead of the upstream", () => {
  const work = cloneWithRemoteFeature();
  git(work, "branch", "-q", "--set-upstream-to=origin/feat/x");
  writeFileSync(join(work, "c.txt"), "local\n");
  git(work, "add", "c.txt");
  git(work, "commit", "-q", "-m", "feat: local");
  assert.match(runHook(work), /1 unpushed commit\(s\) on feat\/x/u);
});

await test("counts porcelain lines", () => {
  assert.equal(parseStatusCount(" M a\n?? b\n"), 2);
  assert.equal(parseStatusCount(""), 0);
});
