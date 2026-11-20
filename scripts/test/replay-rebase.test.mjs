import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { parseArguments, replayRebase } from "../replay-rebase.mjs";

const git = (cwd, ...args) =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

const put = (root, path, text) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};

const approvalFile = (cause, migrationAssessment, changeClass) =>
  `${JSON.stringify({ schema: "x", entries: [{ changeClass, cause, migrationAssessment }] })}\n`;

function fixture({ newOnBase = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), "replay-rebase-"));
  git(root, "init", "-q", "-b", "dev");
  git(root, "config", "user.email", "t@example.test");
  git(root, "config", "user.name", "t");
  git(root, "config", "commit.gpgsign", "false");
  git(root, "config", "core.autocrlf", "true");
  put(root, "golden/replays/a.replay.json", "base-a\n");
  put(root, "golden/replays/b.replay.json", "base-b\n");
  put(root, "golden/replay-approvals/legacy.json", "legacy\n");
  git(root, "add", ".");
  git(root, "commit", "-q", "-m", "base");
  git(root, "checkout", "-q", "-b", "feature");
  put(root, "golden/replays/a.replay.json", "feature-a\n");
  put(
    root,
    "golden/replay-approvals/feature.json",
    approvalFile("engine rule moved", "no migration", "EXPECTED_GAMEPLAY_CHANGE"),
  );
  git(root, "add", ".");
  git(root, "commit", "-q", "-m", "feature");
  git(root, "checkout", "-q", "dev");
  put(root, "golden/replays/a.replay.json", "dev-a\n");
  put(root, "golden/replays/b.replay.json", "dev-b\n");
  if (newOnBase) put(root, "golden/replays/c.replay.json", "dev-c\n");
  put(
    root,
    "golden/replay-approvals/dev.json",
    approvalFile("dev cause", "dev migration", "SERIALIZATION_ONLY"),
  );
  git(root, "add", ".");
  git(root, "commit", "-q", "-m", "dev moves");
  git(root, "checkout", "-q", "feature");
  return root;
}

function fakeExec(root, calls, checkStatus = 0) {
  return (command, args) => {
    calls.push([command, ...args]);
    if (args[0] === "replay:record") {
      put(root, `golden/replays/${args[1]}.replay.json`, `recorded-${args[1]}\n`);
    }
    if (args[0] === "replay:approve") {
      put(root, "golden/replay-approvals/regenerated.json", "regenerated\n");
    }
    return args[0] === "check:replay-approvals" ? checkStatus : 0;
  };
}

function mergeDevIntoFeature(root) {
  assert.throws(() => git(root, "merge", "dev", "--no-edit"));
  assert.match(git(root, "diff", "--name-only", "--diff-filter=U"), /a\.replay\.json/);
}

void test("a conflicted replay is re-recorded on the merged tree and the branch approval is regenerated", () => {
  const root = fixture();
  try {
    mergeDevIntoFeature(root);
    const calls = [];
    const status = replayRebase({
      root,
      base: "dev",
      git: (...args) => git(root, ...args),
      exec: fakeExec(root, calls),
      options: {},
      print: () => {},
    });
    assert.equal(status, 0);
    assert.equal(git(root, "diff", "--name-only", "--diff-filter=U"), "");
    const text = (path) => readFileSync(join(root, path), "utf8").replaceAll("\r\n", "\n");
    assert.equal(text("golden/replays/a.replay.json"), "recorded-a\n");
    assert.equal(text("golden/replays/b.replay.json"), "dev-b\n");
    assert.equal(existsSync(join(root, "golden/replay-approvals/feature.json")), false);
    assert.equal(existsSync(join(root, "golden/replay-approvals/dev.json")), true);
    assert.equal(existsSync(join(root, "golden/replay-approvals/legacy.json")), true);
    assert.deepEqual(
      calls.filter((call) => call[1] === "replay:record"),
      [["pnpm", "replay:record", "a"]],
    );
    assert.deepEqual(
      calls.filter((call) => call[1] === "replay:approve"),
      [
        [
          "pnpm",
          "replay:approve",
          "--base",
          "dev",
          "--cause",
          "engine rule moved",
          "--migration",
          "no migration",
          "--class",
          "EXPECTED_GAMEPLAY_CHANGE",
        ],
      ],
    );
    assert.equal(calls.at(-1)[1], "check:replay-approvals");
    assert.match(git(root, "status", "--short"), /golden\/replay-approvals\/regenerated\.json/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

void test("a replay that is new on the base is re-recorded during the merge", () => {
  const root = fixture({ newOnBase: true });
  try {
    mergeDevIntoFeature(root);
    const calls = [];
    const status = replayRebase({
      root,
      base: "dev",
      git: (...args) => git(root, ...args),
      exec: fakeExec(root, calls),
      options: {},
      print: () => {},
    });
    assert.equal(status, 0);
    assert.deepEqual(
      calls.filter((call) => call[1] === "replay:record"),
      [
        ["pnpm", "replay:record", "a"],
        ["pnpm", "replay:record", "c"],
      ],
    );
    const text = (path) => readFileSync(join(root, path), "utf8").replaceAll("\r\n", "\n");
    assert.equal(text("golden/replays/b.replay.json"), "dev-b\n");
    assert.equal(text("golden/replays/c.replay.json"), "recorded-c\n");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

void test("outside a merge a replay that matches the base is left alone", () => {
  const root = fixture({ newOnBase: true });
  try {
    mergeDevIntoFeature(root);
    git(root, "merge", "--abort");
    git(root, "checkout", "-q", "dev");
    const calls = [];
    replayRebase({
      root,
      base: "dev",
      git: (...args) => git(root, ...args),
      exec: fakeExec(root, calls),
      options: {},
      print: () => {},
    });
    assert.deepEqual(
      calls.filter((call) => call[1] === "replay:record"),
      [],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

void test("flags override carried approval metadata", () => {
  const root = fixture();
  try {
    mergeDevIntoFeature(root);
    const calls = [];
    replayRebase({
      root,
      base: "dev",
      git: (...args) => git(root, ...args),
      exec: fakeExec(root, calls),
      options: { cause: "c", migration: "m", changeClass: "SERIALIZATION_ONLY" },
      print: () => {},
    });
    const approve = calls.find((call) => call[1] === "replay:approve");
    assert.deepEqual(approve.slice(-6), [
      "--cause",
      "c",
      "--migration",
      "m",
      "--class",
      "SERIALIZATION_ONLY",
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

void test("without any metadata it records but does not approve and reports the next step", () => {
  const root = fixture();
  try {
    mergeDevIntoFeature(root);
    git(root, "rm", "-q", "-f", "golden/replay-approvals/feature.json");
    const calls = [];
    const lines = [];
    replayRebase({
      root,
      base: "dev",
      git: (...args) => git(root, ...args),
      exec: fakeExec(root, calls),
      options: {},
      print: (line) => lines.push(line),
    });
    assert.equal(
      calls.some((call) => call[1] === "replay:approve"),
      false,
    );
    assert.match(lines.join(""), /pnpm replay:approve/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

void test("a failing approvals check is returned as the exit status", () => {
  const root = fixture();
  try {
    mergeDevIntoFeature(root);
    const status = replayRebase({
      root,
      base: "dev",
      git: (...args) => git(root, ...args),
      exec: fakeExec(root, [], 1),
      options: {},
      print: () => {},
    });
    assert.equal(status, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

void test("parseArguments reads the base and the approval flags", () => {
  assert.deepEqual(
    parseArguments(["--base", "origin/main", "--cause", "c", "--migration", "m", "--class", "k"]),
    { base: "origin/main", cause: "c", migration: "m", changeClass: "k" },
  );
  assert.deepEqual(parseArguments([]), { base: "origin/dev" });
});
