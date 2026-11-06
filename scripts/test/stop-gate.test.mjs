import assert from "node:assert/strict";
import { test } from "node:test";

import { evaluateStop, parseStatusCount } from "../lib/stop-gate.mjs";

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

await test("counts porcelain lines", () => {
  assert.equal(parseStatusCount(" M a\n?? b\n"), 2);
  assert.equal(parseStatusCount(""), 0);
});
