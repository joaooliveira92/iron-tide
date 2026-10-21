// Tests for scripts/verify-probe-retirement.mjs: the checkable retirement criterion
// for legacy golden probes (ADR-0246). A probe is retire-eligible only when the
// register cites a corpus mutation test that exists by name; every pinned probe
// must be classified, and nothing is ever reported as retired by this check.
import assert from "node:assert/strict";
import { test } from "node:test";

import { evaluateRetirement } from "../verify-probe-retirement.mjs";

const SOURCE = `describe("m", () => { it("detects an injected command", () => {}); });`;
const golden = { aHash: "x", bHash: "y", success: true };
const register = {
  probes: {
    aHash: { mutation: { file: "t.ts", test: "detects an injected command" } },
    bHash: { mutation: null, reason: "no corpus mutation covers it yet" },
  },
};
const read = (file) => (file === "t.ts" ? SOURCE : undefined);

void test("a probe citing an existing mutation test is eligible; others stay retained", () => {
  const r = evaluateRetirement({ golden, register, read });
  assert.equal(r.ok, true);
  assert.deepEqual(r.eligible, ["aHash"]);
  assert.deepEqual(r.retained, ["bHash"]);
});

void test("fails when a cited mutation test does not exist", () => {
  const bad = {
    probes: { ...register.probes, aHash: { mutation: { file: "t.ts", test: "nope" } } },
  };
  const r = evaluateRetirement({ golden, register: bad, read });
  assert.equal(r.ok, false);
  assert.match(r.problems.join("\n"), /aHash.*nope/u);
});

void test("fails when a cited file is missing", () => {
  const r = evaluateRetirement({ golden, register, read: () => undefined });
  assert.equal(r.ok, false);
  assert.match(r.problems.join("\n"), /t\.ts/u);
});

void test("fails on a pinned probe that is not classified", () => {
  const r = evaluateRetirement({ golden: { ...golden, cHash: "z" }, register, read });
  assert.equal(r.ok, false);
  assert.match(r.problems.join("\n"), /cHash.*not classified/u);
});

void test("fails on a register entry for a probe no longer pinned", () => {
  const r = evaluateRetirement({ golden: { aHash: "x" }, register, read });
  assert.equal(r.ok, false);
  assert.match(r.problems.join("\n"), /bHash.*not pinned/u);
});

void test("an unmapped probe must state why", () => {
  const bad = { probes: { ...register.probes, bHash: { mutation: null } } };
  const r = evaluateRetirement({ golden, register: bad, read });
  assert.equal(r.ok, false);
  assert.match(r.problems.join("\n"), /bHash.*reason/u);
});
