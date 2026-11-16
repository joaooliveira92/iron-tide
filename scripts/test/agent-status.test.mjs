import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { main, parseArguments, render, summariseChecks } from "../agent-status.mjs";

const PR = JSON.stringify({
  number: 42,
  state: "OPEN",
  isDraft: true,
  url: "https://example.test/pr/42",
  reviewDecision: "",
  statusCheckRollup: [
    { name: "lint", status: "COMPLETED", conclusion: "SUCCESS" },
    { name: "test", status: "COMPLETED", conclusion: "FAILURE" },
    { name: "build", status: "IN_PROGRESS", conclusion: "" },
  ],
});

const fakeRun =
  (overrides = {}) =>
  (command, args) => {
    const key = `${command} ${args.join(" ")}`;
    for (const [prefix, value] of Object.entries(overrides)) {
      if (key.startsWith(prefix)) {
        if (value instanceof Error) throw value;
        return value;
      }
    }
    throw new Error(`unexpected ${key}`);
  };

const BASE = {
  "git branch": "feat/x\n",
  "git log": "abc1234 feat: x\n",
  "git rev-list": "2\t5\n",
  "git status": " M a.ts\n?? b.ts\n",
  "gh pr": PR,
  "tail -n": "line1\nline2\n",
};

const capture = (argv, overrides) => {
  const lines = [];
  const code = main(argv, { run: fakeRun({ ...BASE, ...overrides }), out: (l) => lines.push(l) });
  return { code, text: lines.join("\n") };
};

void describe("parseArguments", () => {
  void test("defaults and flags", () => {
    assert.deepEqual(parseArguments([]), { log: null, base: "dev", pr: true });
    assert.deepEqual(parseArguments(["--log", "/tmp/a.log", "--no-pr", "--base", "main"]), {
      log: "/tmp/a.log",
      base: "main",
      pr: false,
    });
  });
  void test("rejects unknown flags", () => {
    assert.throws(() => parseArguments(["--nope"]));
  });
});

void describe("summariseChecks", () => {
  void test("splits failed from pending", () => {
    const summary = summariseChecks(JSON.parse(PR).statusCheckRollup);
    assert.deepEqual(summary, { total: 3, failed: ["test"], pending: ["build"] });
  });
  void test("tolerates a missing rollup", () => {
    assert.deepEqual(summariseChecks(undefined), { total: 0, failed: [], pending: [] });
  });
});

void describe("agent:status", () => {
  void test("reports git, PR and checks in one block", () => {
    const { code, text } = capture([]);
    assert.equal(code, 0);
    assert.match(text, /branch feat\/x @ abc1234 feat: x/u);
    assert.match(text, /ahead 5, behind 2/u);
    assert.match(text, /tree dirty: 2 paths/u);
    assert.match(text, /PR #42 OPEN draft/u);
    assert.match(text, /1 ok, 1 failed, 1 pending/u);
  });
  void test("appends the log tail only when asked", () => {
    assert.doesNotMatch(capture([]).text, /log /u);
    assert.match(capture(["--log", "/tmp/g.log"]).text, /log \/tmp\/g\.log:\nline1\nline2/u);
  });
  void test("degrades when gh or git fail", () => {
    const failing = new Error("boom");
    const { code, text } = capture([], { "gh pr": failing, "git rev-list": failing });
    assert.equal(code, 0);
    assert.match(text, /PR: none found/u);
    assert.doesNotMatch(text, /ahead/u);
  });
  void test("clean tree and capped dirty list", () => {
    assert.match(capture([], { "git status": "" }).text, /tree clean/u);
    const many = Array.from({ length: 14 }, (_, k) => ` M f${k}.ts`).join("\n");
    assert.match(
      render({
        branch: "b",
        head: "h",
        base: "dev",
        ahead: null,
        behind: null,
        dirty: many.split("\n"),
        pr: null,
        log: null,
      }).join("\n"),
      /\.\.\. 4 more/u,
    );
  });
  void test("usage errors exit 2", () => {
    assert.equal(capture(["--nope"]).code, 2);
  });
});
