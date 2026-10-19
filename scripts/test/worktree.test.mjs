// Tests for scripts/worktree.mjs — the concurrent-agent worktree coordinator
// (ADR-0220). Covers git-worktree porcelain parsing, the ledger block
// round-trip, and the pure hygiene classifier. Git mutation commands
// (new/prune/remove) are exercised end-to-end by the workflow, not here.
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildAudit,
  classifyWorktree,
  parseCliArgs,
  parseLedger,
  parsePullRequests,
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

// --- audit: pure reconciliation over collected facts ------------------------

const TIP = (n) => String(n).repeat(40).slice(0, 40);
const BASE_TIP = TIP(1);

function branch(name, overrides = {}) {
  return {
    name,
    tip: TIP(2),
    upstream: "present",
    ancestor: false,
    unique: 1,
    prMerged: false,
    ...overrides,
  };
}

function facts(overrides = {}) {
  return {
    base: "dev",
    baseRef: "origin/dev",
    baseTip: BASE_TIP,
    repoRoot: "/repo",
    worktrees: [{ path: "/repo", head: BASE_TIP, branch: "dev", dirty: false }],
    branches: [branch("dev", { tip: BASE_TIP, ancestor: true, unique: 0 })],
    remotes: [],
    ledger: [],
    prLookup: "ok",
    ...overrides,
  };
}

const row = (slug, branchName) => ({
  slug,
  branch: branchName,
  scope: slug,
  owner: "orchestrator",
  status: "active",
  base: "dev",
  created: "2026-10-18",
  pr: "—",
});

const compareText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const driftCodes = (audit) => audit.drift.map((d) => `${d.code}:${d.subject}`);

void test("buildAudit of a lone primary checkout is clean", () => {
  const audit = buildAudit(facts());
  assert.equal(audit.ok, true);
  assert.deepEqual(audit.drift, []);
  assert.equal(audit.branches[0].integration, "base");
});

void test("buildAudit classifies integration status per branch", () => {
  const audit = buildAudit(
    facts({
      branches: [
        branch("dev", { tip: BASE_TIP, ancestor: true, unique: 0 }),
        branch("feat/merged", { tip: TIP(3), ancestor: true, unique: 0 }),
        branch("feat/squashed", { tip: TIP(4), prMerged: true, unique: 3 }),
        branch("feat/gone", { tip: TIP(5), upstream: "gone", unique: 2 }),
        branch("feat/open", { tip: TIP(6), unique: 4 }),
        branch("feat/fresh", { tip: BASE_TIP, ancestor: true, unique: 0 }),
        branch("master", { tip: TIP(7), unique: 16 }),
      ],
    }),
  );
  const byName = Object.fromEntries(audit.branches.map((b) => [b.name, b]));
  assert.equal(byName["feat/merged"].integration, "merged");
  assert.equal(byName["feat/squashed"].integration, "merged-by-PR");
  assert.equal(byName["feat/gone"].integration, "gone");
  assert.equal(byName["feat/open"].integration, "open-unmerged");
  assert.equal(byName["feat/open"].unique, 4);
  assert.equal(byName["feat/fresh"].integration, "fresh");
  assert.equal(byName.master.integration, "base");
});

void test("a deleted remote on a merged branch stays merged, not gone", () => {
  const audit = buildAudit(
    facts({
      branches: [
        branch("dev", { tip: BASE_TIP, ancestor: true, unique: 0 }),
        branch("feat/done", { tip: TIP(3), ancestor: true, unique: 0, upstream: "gone" }),
      ],
    }),
  );
  const done = audit.branches.find((b) => b.name === "feat/done");
  assert.equal(done.integration, "merged");
  assert.equal(done.remote, "gone");
});

void test("buildAudit keeps cleanliness separate from integration", () => {
  const audit = buildAudit(
    facts({
      worktrees: [
        { path: "/repo", head: BASE_TIP, branch: "dev", dirty: false },
        { path: "/repo/.worktrees/a", head: TIP(3), branch: "feat/a", dirty: true },
      ],
      branches: [
        branch("dev", { tip: BASE_TIP, ancestor: true, unique: 0 }),
        branch("feat/a", { tip: TIP(3), ancestor: true, unique: 0 }),
      ],
      ledger: [row("a", "feat/a")],
    }),
  );
  const wt = audit.worktrees.find((w) => w.slug === "a");
  assert.equal(wt.integration, "merged");
  assert.equal(wt.dirty, true);
  assert.ok(driftCodes(audit).includes("worktree-stale:a"));
});

void test("dirty alone is reported but is not drift", () => {
  const audit = buildAudit(
    facts({
      worktrees: [
        { path: "/repo", head: BASE_TIP, branch: "dev", dirty: true },
        { path: "/repo/.worktrees/a", head: TIP(3), branch: "feat/a", dirty: true },
      ],
      branches: [
        branch("dev", { tip: BASE_TIP, ancestor: true, unique: 0 }),
        branch("feat/a", { tip: TIP(3), unique: 2 }),
      ],
      ledger: [row("a", "feat/a")],
    }),
  );
  assert.equal(audit.ok, true);
  assert.equal(audit.worktrees.find((w) => w.slug === "a").dirty, true);
});

void test("open unmerged branches are never drift", () => {
  const audit = buildAudit(
    facts({
      worktrees: [
        { path: "/repo", head: BASE_TIP, branch: "dev", dirty: false },
        { path: "/repo/.worktrees/r1", head: TIP(3), branch: "research/r1", dirty: false },
      ],
      branches: [
        branch("dev", { tip: BASE_TIP, ancestor: true, unique: 0 }),
        branch("research/r1", { tip: TIP(3), unique: 1 }),
      ],
      ledger: [row("r1", "research/r1")],
    }),
  );
  assert.equal(audit.ok, true);
});

void test("buildAudit detects unregistered, outside, phantom and mismatched worktrees", () => {
  const audit = buildAudit(
    facts({
      worktrees: [
        { path: "/repo", head: BASE_TIP, branch: "dev", dirty: false },
        { path: "/repo/.worktrees/loose", head: TIP(3), branch: "feat/loose", dirty: false },
        { path: "/elsewhere/audit", head: BASE_TIP, branch: null, dirty: false },
        { path: "/repo/.worktrees/work", head: TIP(4), branch: "master", dirty: false },
      ],
      branches: [
        branch("dev", { tip: BASE_TIP, ancestor: true, unique: 0 }),
        branch("feat/loose", { tip: TIP(3), unique: 1 }),
        branch("master", { tip: TIP(4), unique: 9 }),
      ],
      ledger: [row("work", "dev"), row("ghost", "feat/ghost")],
    }),
  );
  assert.equal(audit.ok, false);
  assert.deepEqual(driftCodes(audit).sort(compareText), [
    "ledger-branch-mismatch:work",
    "ledger-phantom:ghost",
    "worktree-detached:/elsewhere/audit",
    "worktree-outside:/elsewhere/audit",
    "worktree-unregistered:loose",
  ]);
});

void test("buildAudit flags merged-by-PR worktrees and orphan stale branches", () => {
  const audit = buildAudit(
    facts({
      worktrees: [
        { path: "/repo", head: BASE_TIP, branch: "dev", dirty: false },
        { path: "/repo/.worktrees/sq", head: TIP(4), branch: "feat/sq", dirty: false },
      ],
      branches: [
        branch("dev", { tip: BASE_TIP, ancestor: true, unique: 0 }),
        branch("feat/sq", { tip: TIP(4), prMerged: true, unique: 3 }),
        branch("feat/old", { tip: TIP(3), ancestor: true, unique: 0 }),
        branch("feat/lost", { tip: TIP(5), upstream: "gone", unique: 2 }),
      ],
      ledger: [row("sq", "feat/sq")],
    }),
  );
  assert.deepEqual(driftCodes(audit).sort(compareText), [
    "branch-gone:feat/lost",
    "branch-stale:feat/old",
    "worktree-stale:sq",
  ]);
  // Only ancestry-merged worktrees are auto-prunable; squash merges are explicit.
  assert.deepEqual(audit.prunable, []);
});

void test("prunable matches exactly what prune would remove", () => {
  const audit = buildAudit(
    facts({
      worktrees: [
        { path: "/repo", head: BASE_TIP, branch: "dev", dirty: false },
        { path: "/repo/.worktrees/m", head: TIP(3), branch: "feat/m", dirty: false },
        { path: "/repo/.worktrees/o", head: TIP(4), branch: "feat/o", dirty: false },
      ],
      branches: [
        branch("dev", { tip: BASE_TIP, ancestor: true, unique: 0 }),
        branch("feat/m", { tip: TIP(3), ancestor: true, unique: 0 }),
        branch("feat/o", { tip: TIP(4), unique: 2 }),
      ],
      ledger: [row("o", "feat/o"), row("ghost", "feat/ghost")],
    }),
  );
  assert.deepEqual(audit.prunable, ["ghost", "m"]);
});

void test("skipped PR lookup is surfaced as a warning, not silently ignored", () => {
  const audit = buildAudit(facts({ prLookup: "skipped" }));
  assert.match(audit.warnings.join(" "), /pull-request/i);
  assert.equal(audit.ok, true);
});

void test("parsePullRequests keys merged PRs by head branch and head commit", () => {
  const prs = parsePullRequests(
    JSON.stringify([
      { number: 7, headRefName: "feat/x", headRefOid: TIP(4) },
      { number: 9, headRefName: "feat/x", headRefOid: TIP(5) },
    ]),
  );
  assert.equal(prs.isMerged("feat/x", TIP(4)), true);
  assert.equal(prs.isMerged("feat/x", TIP(6)), false);
  assert.equal(prs.isMerged("feat/y", TIP(4)), false);
});

// --- argument parsing: fail closed -----------------------------------------

void test("parseCliArgs accepts every documented invocation", () => {
  for (const argv of [
    ["new", "slug", "--branch", "b", "--base", "dev", "--owner", "me"],
    ["new", "slug", "--branch=b"],
    ["list"],
    ["list", "--json"],
    ["sync"],
    ["prune"],
    ["prune", "--check"],
    ["prune", "--force"],
    ["remove", "slug", "--force"],
    ["audit"],
    ["audit", "--json", "--no-gh"],
  ]) {
    assert.equal(parseCliArgs(argv).ok, true, argv.join(" "));
  }
});

void test("parseCliArgs rejects unknown commands and options", () => {
  for (const argv of [
    ["bogus"],
    ["prune", "--bogus"],
    ["prune", "-x"],
    ["prune", "extra"],
    ["prune", "--check", "--force"],
    ["sync", "--force"],
    ["list", "--force"],
    ["audit", "--force"],
    ["remove"],
    ["remove", "a", "b"],
    ["new"],
    ["new", "--branch", "x"],
    ["new", "a", "--branch"],
    ["new", "a", "--branch", "--base"],
    ["new", "a", "--wat", "x"],
  ]) {
    const parsed = parseCliArgs(argv);
    assert.equal(parsed.ok, false, argv.join(" "));
    assert.ok(parsed.error.length > 0);
  }
});

void test("parseCliArgs treats help as a request, never as a command to run", () => {
  for (const argv of [["--help"], ["-h"], ["help"], ["prune", "--help"], ["audit", "-h"]]) {
    const parsed = parseCliArgs(argv);
    assert.equal(parsed.ok, true, argv.join(" "));
    assert.equal(parsed.help, true);
  }
});
