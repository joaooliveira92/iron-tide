import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DispatchCheckError,
  collectDevHealth,
  main,
  parseDevCommits,
  parseIssueNumbers,
} from "../dispatch-check.mjs";

const FS = "\u001f";
const RS = "\u001e";

const commit = (sha, subject, body = "") => `${sha}${FS}${subject}${FS}${body}${RS}\n`;

const WORKTREE_PORCELAIN = (branches) =>
  branches
    .map(
      (branch, index) =>
        `worktree /tmp/wt${index}\nHEAD ${"a".repeat(40)}\nbranch refs/heads/${branch}\n`,
    )
    .join("\n");

const GREEN_RUNS = [
  { workflowName: "CI", conclusion: "success", status: "completed" },
  { workflowName: "Determinism Gate", conclusion: "success", status: "completed" },
];

function fixture(overrides = {}) {
  const base = {
    issues: {},
    openPrs: [],
    mergedPrs: [],
    branches: ["dev"],
    runs: GREEN_RUNS,
    registry: [],
    failOn: null,
    ...overrides,
  };
  const calls = [];
  const run = (command, args) => {
    const key = `${command} ${args.join(" ")}`;
    calls.push(key);
    if (base.failOn !== null && key.includes(base.failOn)) throw new Error("boom\nsecond line");
    if (command === "gh" && args[0] === "issue") {
      const issue = base.issues[args[2]] ?? {};
      return JSON.stringify({
        number: Number(args[2]),
        state: issue.state ?? "OPEN",
        labels: (issue.labels ?? []).map((name) => ({ name })),
      });
    }
    if (command === "git" && args[0] === "log") {
      const number = args[3].slice(1);
      return (base.issues[number]?.commits ?? []).join("");
    }
    if (command === "gh" && args[0] === "pr") {
      return JSON.stringify(args.includes("open") ? base.openPrs : base.mergedPrs);
    }
    if (command === "git" && args[0] === "worktree") return WORKTREE_PORCELAIN(base.branches);
    if (command === "gh" && args[0] === "run") return JSON.stringify(base.runs);
    throw new Error(`unexpected command: ${key}`);
  };
  return { run, calls, readRegistryRows: () => base.registry };
}

function check(argv, overrides) {
  const { run, calls, readRegistryRows } = fixture(overrides);
  const lines = [];
  const code = main(argv, { run, readRegistryRows, out: (line) => lines.push(line) });
  return { code, lines, calls };
}

void test("parseIssueNumbers accepts #N, dedupes, and rejects junk", () => {
  assert.deepEqual(parseIssueNumbers(["577", "#578", "577"]), [577, 578]);
  assert.throws(() => parseIssueNumbers([]), DispatchCheckError);
  assert.throws(() => parseIssueNumbers(["abc"]), /not an issue number/u);
  assert.throws(() => parseIssueNumbers(["0"]), DispatchCheckError);
});

void test("parseDevCommits splits records on the separators", () => {
  const parsed = parseDevCommits(commit("abc123", "fix: a (#1)", "Closes #1") + commit("def", "x"));
  assert.deepEqual(parsed, [
    { sha: "abc123", subject: "fix: a (#1)", body: "Closes #1" },
    { sha: "def", subject: "x", body: "" },
  ]);
});

void test("collectDevHealth takes the latest completed run per workflow and skips cancelled", () => {
  const health = collectDevHealth([
    { workflowName: "A", conclusion: "cancelled", status: "completed" },
    { workflowName: "A", conclusion: "failure", status: "completed" },
    { workflowName: "A", conclusion: "success", status: "completed" },
    { workflowName: "B", conclusion: "success", status: "completed" },
    { workflowName: "B", conclusion: "failure", status: "completed" },
    { workflowName: "C", conclusion: "skipped", status: "completed" },
  ]);
  assert.deepEqual(health, { red: ["A"], workflows: 3 });
});

void test("an untouched open issue is CLEAR with DEV-GREEN and exits 0", () => {
  const { code, lines } = check(["10"]);
  assert.equal(code, 0);
  assert.match(lines[0], /^DEV-GREEN worktrees 1\/5$/u);
  assert.match(lines[1], /^#10 CLEAR /u);
});

void test("a closed issue is STALE", () => {
  const { code, lines } = check(["11"], { issues: { 11: { state: "CLOSED" } } });
  assert.equal(code, 2);
  assert.equal(lines[1], "#11 STALE issue is closed");
});

void test("a merged PR with a closing keyword makes it STALE", () => {
  const { lines } = check(["12"], {
    mergedPrs: [{ number: 99, title: "feat: x", body: "Part of #1\nCloses #12", headRefName: "x" }],
  });
  assert.equal(lines[1], "#12 STALE merged PR #99 closes it");
});

void test("a merged PR that only mentions the issue does not make it STALE", () => {
  const { lines } = check(["12"], {
    mergedPrs: [{ number: 99, title: "feat: x", body: "Part of #12", headRefName: "x" }],
  });
  assert.match(lines[1], /^#12 CLEAR /u);
});

void test("a dev commit mentioning the issue with feat or fix makes it STALE", () => {
  const { lines } = check(["13"], {
    issues: { 13: { commits: [commit("1234567890ab", "fix(ui): repair banner (#13)")] } },
  });
  assert.equal(lines[1], "#13 STALE origin/dev 12345678 fix(ui): repair banner (#13)");
});

void test("a dev commit that matches only a longer issue number is ignored", () => {
  const { lines } = check(["57"], {
    issues: { 57: { commits: [commit("1234567890ab", "feat(x): other (#577)")] } },
  });
  assert.match(lines[1], /^#57 CLEAR /u);
});

void test("a dev commit without fix, feat or closes is ignored", () => {
  const { lines } = check(["14"], {
    issues: { 14: { commits: [commit("1234567890ab", "docs: note (#14)")] } },
  });
  assert.match(lines[1], /^#14 CLEAR /u);
});

void test("an open PR referencing the issue makes it CLAIMED", () => {
  const { code, lines } = check(["15"], {
    openPrs: [{ number: 7, title: "wip", body: "Refs #15", headRefName: "feat/other" }],
  });
  assert.equal(code, 2);
  assert.equal(lines[1], "#15 CLAIMED open PR #7 references it");
});

void test("an open PR whose branch names the issue makes it CLAIMED", () => {
  const { lines } = check(["16"], {
    openPrs: [{ number: 8, title: "wip", body: "", headRefName: "feat/issue-16-thing" }],
  });
  assert.equal(lines[1], "#16 CLAIMED open PR #8 references it");
});

void test("a worktree branch containing issue-N makes it CLAIMED, not issue-N prefixed digits", () => {
  const claimed = check(["17"], { branches: ["dev", "feat/issue-17-x"] });
  assert.equal(claimed.lines[1], "#17 CLAIMED worktree branch feat/issue-17-x");
  const other = check(["17"], { branches: ["dev", "feat/issue-170-x"] });
  assert.match(other.lines[1], /^#17 CLEAR /u);
});

void test("a live registry row scoped to #N makes it CLAIMED; terminal rows do not", () => {
  const row = { slug: "wave-a", scope: "Slice for #18", status: "running" };
  const live = check(["18"], { registry: [row] });
  assert.equal(live.lines[1], "#18 CLAIMED worktrees scope wave-a (running)");
  const done = check(["18"], { registry: [{ ...row, status: "merged" }] });
  assert.match(done.lines[1], /^#18 CLEAR /u);
});

void test("needs-decision, needs-triage and needs-info labels give NEEDS-DECISION", () => {
  for (const label of ["needs-decision", "needs-triage", "needs-info"]) {
    const { code, lines } = check(["19"], { issues: { 19: { labels: [label, "bug"] } } });
    assert.equal(code, 2);
    assert.equal(lines[1], `#19 NEEDS-DECISION label ${label}`);
  }
  const ready = check(["19"], { issues: { 19: { labels: ["ready-for-agent"] } } });
  assert.match(ready.lines[1], /^#19 CLEAR /u);
});

void test("STALE outranks CLAIMED and CLAIMED outranks NEEDS-DECISION", () => {
  const stale = check(["20"], {
    issues: { 20: { state: "CLOSED", labels: ["needs-triage"] } },
    openPrs: [{ number: 1, title: "#20", body: "", headRefName: "x" }],
  });
  assert.match(stale.lines[1], /^#20 STALE /u);
  const claimed = check(["20"], {
    issues: { 20: { labels: ["needs-triage"] } },
    openPrs: [{ number: 1, title: "#20", body: "", headRefName: "x" }],
  });
  assert.match(claimed.lines[1], /^#20 CLAIMED /u);
});

void test("a red dev workflow prints DEV-RED and exits 2 even when every issue is CLEAR", () => {
  const { code, lines } = check(["21"], {
    runs: [
      { workflowName: "Determinism Gate", conclusion: "failure", status: "completed" },
      { workflowName: "CI", conclusion: "success", status: "completed" },
    ],
  });
  assert.equal(code, 2);
  assert.equal(lines[0], "DEV-RED (Determinism Gate) worktrees 1/5");
  assert.match(lines[1], /^#21 CLEAR /u);
});

void test("the header reports the worktree count against the cap", () => {
  const { lines } = check(["22"], { branches: ["dev", "a", "b", "c", "d", "e"] });
  assert.match(lines[0], /worktrees 6\/5$/u);
});

void test("every issue gets its own line in argument order", () => {
  const { lines } = check(["31", "30"], { issues: { 30: { state: "CLOSED" } } });
  assert.equal(lines.length, 3);
  assert.match(lines[1], /^#31 CLEAR /u);
  assert.match(lines[2], /^#30 STALE /u);
});

void test("a tool failure exits 1 and prints no verdicts", () => {
  const { code, lines } = check(["23"], { failOn: "issue view" });
  assert.equal(code, 1);
  assert.deepEqual(lines, []);
});

void test("invalid arguments exit 1 without running anything", () => {
  const { code, calls } = check(["nope"]);
  assert.equal(code, 1);
  assert.deepEqual(calls, []);
});
