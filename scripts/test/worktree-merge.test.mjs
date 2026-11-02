import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, describe, test } from "node:test";

import { executeMerge, planMerge } from "../lib/worktree-merge.mjs";

const CLI = resolve(import.meta.dirname, "..", "worktree.mjs");
const IDENTITY = [
  "-c",
  "user.name=t",
  "-c",
  "user.email=t@example.test",
  "-c",
  "commit.gpgsign=false",
];
const roots = [];

const git = (cwd, ...args) =>
  execFileSync("git", [...IDENTITY, "-C", cwd, ...args], { encoding: "utf8" });

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "wt-merge-"));
  roots.push(root);
  const main = join(root, "main");
  mkdirSync(main);
  git(main, "init", "-q", "-b", "dev");
  writeFileSync(join(main, "a.txt"), "base\n");
  git(main, "add", "a.txt");
  git(main, "commit", "-q", "-m", "chore: base");
  const tree = join(root, "wt");
  git(main, "worktree", "add", "-q", "-b", "feat/x", tree);
  return { main, tree };
}

const commitFile = (cwd, name, text, message = `feat: ${name}`) => {
  writeFileSync(join(cwd, name), text);
  git(cwd, "add", name);
  git(cwd, "commit", "-q", "-m", message);
};

after(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

void describe("planMerge", () => {
  void test("accepts a clean branch with commits", () => {
    const { main, tree } = fixture();
    commitFile(tree, "b.txt", "b\n");
    const plan = planMerge({ mainRoot: main, branch: "feat/x", base: "dev" });
    assert.equal(plan.ok, true, plan.problems.join("; "));
    assert.deepEqual(plan.changed, ["b.txt"]);
  });
  void test("refuses a branch with nothing to merge", () => {
    const { main } = fixture();
    const plan = planMerge({ mainRoot: main, branch: "feat/x", base: "dev" });
    assert.match(plan.problems.join(), /no commits/u);
  });
  void test("refuses a dirty worktree", () => {
    const { main, tree } = fixture();
    commitFile(tree, "b.txt", "b\n");
    writeFileSync(join(tree, "c.txt"), "dirty\n");
    assert.match(
      planMerge({ mainRoot: main, branch: "feat/x", base: "dev" }).problems.join(),
      /uncommitted/u,
    );
  });
  void test("refuses when the main checkout is on another branch", () => {
    const { main, tree } = fixture();
    commitFile(tree, "b.txt", "b\n");
    git(main, "checkout", "-q", "-b", "scratch");
    assert.match(
      planMerge({ mainRoot: main, branch: "feat/x", base: "dev" }).problems.join(),
      /not dev/u,
    );
  });
  void test("detects an untracked file the merge would overwrite", () => {
    const { main, tree } = fixture();
    commitFile(tree, "CLAUDE.md", "tracked\n");
    writeFileSync(join(main, "CLAUDE.md"), "untracked\n");
    assert.match(
      planMerge({ mainRoot: main, branch: "feat/x", base: "dev" }).problems.join(),
      /untracked files .* CLAUDE\.md/u,
    );
  });
  void test("detects a merge conflict without touching the checkout", () => {
    const { main, tree } = fixture();
    commitFile(tree, "a.txt", "branch\n", "feat: edit a");
    commitFile(main, "a.txt", "dev\n", "feat: edit a on dev");
    const plan = planMerge({ mainRoot: main, branch: "feat/x", base: "dev" });
    assert.match(plan.problems.join(), /conflict.*a\.txt/u);
    assert.equal(git(main, "status", "--porcelain").trim(), "");
  });
  void test("reports a missing branch", () => {
    const { main } = fixture();
    assert.match(
      planMerge({ mainRoot: main, branch: "nope", base: "dev" }).problems.join(),
      /does not exist/u,
    );
  });
});

void describe("executeMerge", () => {
  void test("merges with --no-ff only when the plan is clean", () => {
    const { main, tree } = fixture();
    commitFile(tree, "b.txt", "b\n");
    const result = executeMerge({ mainRoot: main, branch: "feat/x", base: "dev" });
    assert.equal(result.merged, true);
    assert.equal(git(main, "rev-list", "--parents", "-n", "1", "HEAD").trim().split(" ").length, 3);
  });
  void test("does nothing when the plan is blocked", () => {
    const { main } = fixture();
    const before = git(main, "rev-parse", "HEAD");
    assert.equal(executeMerge({ mainRoot: main, branch: "feat/x", base: "dev" }).merged, false);
    assert.equal(git(main, "rev-parse", "HEAD"), before);
  });
});

void describe("cli", () => {
  void test("merge is declared and unknown options still fail closed", () => {
    const result = spawnSync(process.execPath, [CLI, "merge", "slug", "--bogus"], {
      encoding: "utf8",
    });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /unknown option/u);
  });
  void test("merge requires a slug", () => {
    assert.equal(spawnSync(process.execPath, [CLI, "merge"], { encoding: "utf8" }).status, 2);
  });
});
