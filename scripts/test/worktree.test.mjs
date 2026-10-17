// Tests for scripts/worktree.mjs — the concurrent-agent worktree coordinator
// (ADR-0220). Covers git-worktree porcelain parsing, the ledger block
// round-trip, and the pure hygiene classifier. Git mutation commands
// (new/prune/remove) are exercised end-to-end by the workflow, not here.
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  classifyWorktree,
  parseLedger,
  parseWorktreeList,
  renderLedger,
  TERMINAL_STATES,
} from "../worktree.mjs";

void test("parseWorktreeList reads paths, heads, and branches", () => {
  const porcelain = [
    "worktree /repo",
    "HEAD 1111111111111111111111111111111111111111",
    "branch refs/heads/dev",
    "",
    "worktree /repo/.worktrees/u-3",
    "HEAD 2222222222222222222222222222222222222222",
    "branch refs/heads/feat/u-3",
    "",
    "worktree /repo/.worktrees/detached",
    "HEAD 3333333333333333333333333333333333333333",
    "detached",
    "",
  ].join("\n");
  const entries = parseWorktreeList(porcelain);
  assert.equal(entries.length, 3);
  assert.deepEqual(entries[0], {
    path: "/repo",
    head: "1111111111111111111111111111111111111111",
    branch: "dev",
  });
  assert.equal(entries[1].branch, "feat/u-3");
  assert.equal(entries[2].branch, null);
});

void test("ledger render then parse round-trips rows in order", () => {
  const rows = [
    {
      slug: "u-3",
      branch: "feat/u-3",
      scope: "u-3",
      owner: "orchestrator-a",
      status: "active",
      base: "dev",
      created: "2026-10-16",
      pr: "—",
    },
    {
      slug: "s-1",
      branch: "feat/s-1",
      scope: "s-1",
      owner: "orchestrator-b",
      status: "review",
      base: "dev",
      created: "2026-10-15",
      pr: "#42",
    },
  ];
  const doc = "# Active worktrees\n\nprose stays put\n";
  const rendered = renderLedger(doc, rows);
  assert.match(rendered, /prose stays put/);
  assert.deepEqual(parseLedger(rendered), rows);
});

void test("parseLedger returns nothing outside a complete marker block", () => {
  assert.deepEqual(parseLedger("# no table here"), []);
  assert.deepEqual(parseLedger("<!-- worktrees:begin -->\nno rows\n"), []);
});

void test("classifyWorktree is phantom without a path", () => {
  const { state, warnings } = classifyWorktree({
    pathExists: false,
    branchExists: true,
    merged: false,
    dirty: false,
  });
  assert.equal(state, "phantom");
  assert.equal(warnings.length, 1);
  assert.ok(TERMINAL_STATES.has(state));
});

void test("classifyWorktree is gone when the branch is missing", () => {
  assert.equal(
    classifyWorktree({ pathExists: true, branchExists: false, merged: false, dirty: false }).state,
    "gone",
  );
});

void test("classifyWorktree flags a merged branch, noting dirty trees", () => {
  const clean = classifyWorktree({
    pathExists: true,
    branchExists: true,
    merged: true,
    dirty: false,
  });
  assert.equal(clean.state, "merged");
  assert.equal(clean.warnings.length, 1);

  const dirty = classifyWorktree({
    pathExists: true,
    branchExists: true,
    merged: true,
    dirty: true,
  });
  assert.match(dirty.warnings.join(" "), /--force/);
});

void test("classifyWorktree is active when live and unmerged", () => {
  const { state, warnings } = classifyWorktree({
    pathExists: true,
    branchExists: true,
    merged: false,
    dirty: false,
  });
  assert.equal(state, "active");
  assert.deepEqual(warnings, []);
  assert.ok(!TERMINAL_STATES.has(state));
});
