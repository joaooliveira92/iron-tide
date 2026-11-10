import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import {
  evaluateDelegation,
  issuesNamed,
  readStamps,
  recordStamps,
  unstamped,
} from "../lib/dispatch-stamp.mjs";

const HOOK = resolve(import.meta.dirname, "..", "hooks", "pre-tool-use-delegate.mjs");
const POLICY = {
  dispatchStampMaxMinutes: 240,
  dispatchOverrideToken: "dispatch-check: skip",
  overrideMinReasonChars: 3,
};
const NOW = Date.UTC(2026, 10, 10, 12, 0, 0);
const MINUTE = 60_000;
const dirs = [];

after(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

const freshDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "dispatch-stamp-"));
  dirs.push(dir);
  return dir;
};

const delegation = (overrides = {}) => ({
  role: "implementation",
  title: "#572 unfixable warnings",
  task: "Fix it.",
  ...overrides,
});

await test("reads issue numbers from the title shapes coordinators use", () => {
  assert.deepEqual(issuesNamed("#572 unfixable warnings"), [572]);
  assert.deepEqual(issuesNamed("Issue 580: one construction order dialog"), [580]);
  assert.deepEqual(issuesNamed("Anatomy motion: hull (#533)"), [533]);
  assert.deepEqual(issuesNamed("#541 and #546 together"), [541, 546]);
  assert.deepEqual(issuesNamed("no number here"), []);
});

await test("a missing stamp file means nothing was checked", () => {
  assert.deepEqual(readStamps(freshDir()), {});
  assert.deepEqual(unstamped(freshDir(), [572], NOW, 240 * MINUTE), [572]);
});

await test("recorded stamps are fresh until they age out", () => {
  const dir = freshDir();
  recordStamps(dir, [{ number: 572, verdict: "STALE" }], NOW);
  assert.deepEqual(unstamped(dir, [572], NOW + 239 * MINUTE, 240 * MINUTE), []);
  assert.deepEqual(unstamped(dir, [572], NOW + 241 * MINUTE, 240 * MINUTE), [572]);
  assert.deepEqual(unstamped(dir, [573], NOW, 240 * MINUTE), [573]);
});

await test("a later check keeps the stamps of other issues", () => {
  const dir = freshDir();
  recordStamps(dir, [{ number: 1, verdict: "CLEAR" }], NOW);
  recordStamps(dir, [{ number: 2, verdict: "CLAIMED" }], NOW + MINUTE);
  assert.deepEqual(unstamped(dir, [1, 2], NOW + MINUTE, 240 * MINUTE), []);
});

await test("blocks an implementation delegation whose issue was never checked", () => {
  const verdict = evaluateDelegation({
    input: delegation(),
    policy: POLICY,
    dir: freshDir(),
    nowMs: NOW,
  });
  assert.equal(verdict.decision, "block");
  assert.match(verdict.message, /pnpm dispatch:check 572/u);
});

await test("allows once dispatch:check ran, whatever its verdict", () => {
  const dir = freshDir();
  recordStamps(dir, [{ number: 572, verdict: "CLAIMED" }], NOW);
  const verdict = evaluateDelegation({ input: delegation(), policy: POLICY, dir, nowMs: NOW });
  assert.equal(verdict.decision, "allow");
});

await test("does not gate other roles or titles without an issue", () => {
  const dir = freshDir();
  for (const input of [
    delegation({ role: "test" }),
    delegation({ role: "review" }),
    delegation({ title: "tidy the docs" }),
  ]) {
    assert.equal(evaluateDelegation({ input, policy: POLICY, dir, nowMs: NOW }).decision, "allow");
  }
});

await test("an audited override token with a reason allows the delegation", () => {
  const dir = freshDir();
  const allowed = delegation({ task: "Fix it. dispatch-check: skip slice 2 of an open umbrella" });
  const bare = delegation({ task: "Fix it. dispatch-check: skip" });
  assert.equal(
    evaluateDelegation({ input: allowed, policy: POLICY, dir, nowMs: NOW }).decision,
    "allow",
  );
  assert.equal(
    evaluateDelegation({ input: bare, policy: POLICY, dir, nowMs: NOW }).decision,
    "block",
  );
});

function runHook(payload, telemetryDir) {
  return spawnSync("node", [HOOK], {
    input: typeof payload === "string" ? payload : JSON.stringify(payload),
    encoding: "utf8",
    env: { ...process.env, CLAUDE_TELEMETRY_DIR: telemetryDir },
  });
}

await test("hook exits 2 with the instruction when the issue was not checked", () => {
  const result = runHook({ tool_input: delegation() }, freshDir());
  assert.equal(result.status, 2);
  assert.match(result.stderr, /pnpm dispatch:check 572/u);
});

await test("hook passes after a stamp and fails open on unreadable input", () => {
  const dir = freshDir();
  recordStamps(dir, [{ number: 572, verdict: "CLEAR" }], Date.now());
  assert.equal(runHook({ tool_input: delegation() }, dir).status, 0);
  assert.equal(runHook("not json", dir).status, 0);
  assert.equal(runHook({}, dir).status, 0);
});
