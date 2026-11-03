// Tests for scripts/verify-ui-acceptance-map.mjs: the UI acceptance map gate
// The gate is pure over a ledger and a list of spec texts, so each test builds both in memory.
import assert from "node:assert/strict";
import { test } from "node:test";

import { evaluateMap, extractStepIds, isDebugSpec } from "../verify-ui-acceptance-map.mjs";

const row = (id, status, extra = {}) => ({
  id,
  player_verb: `Verb of ${id}`,
  status,
  engine_package: "desktop",
  engine_modules: [],
  engine_symbols: [],
  main_commands: [],
  renderer_screen: null,
  evidence_test: null,
  decision: null,
  ...extra,
});

const ledger = (...rows) => ({ version: 2, capabilities: rows });
const step = (id) => `  await test.step("reachable:${id}", async () => {});\n`;
const spec = (path, ...ids) => ({ path, text: ids.map(step).join("") });

void test("extractStepIds reads double-quoted reachable steps in source order", () => {
  const source = [
    step("alpha"),
    `  await test.step('reachable:single', async () => {});\n`,
    `  await test.step("plain step", async () => {});\n`,
    `  await test.step(\n    "reachable:beta",\n    async () => {},\n  );\n`,
    `  await test.step(\`reachable:template\`, async () => {});\n`,
  ].join("");
  assert.deepEqual(extractStepIds(source), ["alpha", "beta"]);
});

void test("extractStepIds ignores a step disabled by a whole-line comment", () => {
  assert.deepEqual(extractStepIds(`// await test.step("reachable:gone", async () => {});\n`), []);
});

void test("isDebugSpec matches only debug specs", () => {
  assert.equal(isDebugSpec("apps/desktop/e2e/campaign-battle-drill.debug.spec.ts"), true);
  assert.equal(isDebugSpec("apps/desktop/e2e/mvp-loop.spec.ts"), false);
});

void test("passes when every reachable row has a step and reports how many are mapped", () => {
  const result = evaluateMap({
    ledger: ledger(row("alpha", "reachable"), row("beta", "reachable"), row("gamma", "internal")),
    specs: [spec("a.spec.ts", "alpha"), spec("b.spec.ts", "beta", "alpha")],
  });
  assert.deepEqual(result.problems, []);
  assert.equal(result.ok, true);
  assert.equal(result.mapped, 2);
});

void test("fails a reachable row that has no step", () => {
  const result = evaluateMap({
    ledger: ledger(row("alpha", "reachable"), row("beta", "reachable")),
    specs: [spec("a.spec.ts", "alpha")],
  });
  assert.equal(result.ok, false);
  assert.equal(result.mapped, 1);
  assert.equal(result.problems.length, 1);
  assert.match(result.problems[0], /"beta": reachable row has no e2e step/u);
});

void test("fails a step that names an unknown id", () => {
  const result = evaluateMap({
    ledger: ledger(row("alpha", "reachable")),
    specs: [spec("a.spec.ts", "alpha", "ghost")],
  });
  assert.equal(result.ok, false);
  assert.match(
    result.problems.join("\n"),
    /a\.spec\.ts: step "reachable:ghost" is not a ledger row/u,
  );
});

void test("fails a step that names a dormant or internal row", () => {
  const result = evaluateMap({
    ledger: ledger(
      row("alpha", "reachable"),
      row("sleeper", "dormant-by-decision", { decision: "#1" }),
      row("plumbing", "internal"),
    ),
    specs: [spec("a.spec.ts", "alpha", "sleeper", "plumbing")],
  });
  assert.equal(result.ok, false);
  assert.match(
    result.problems.join("\n"),
    /"reachable:sleeper" is dormant-by-decision, not reachable/u,
  );
  assert.match(result.problems.join("\n"), /"reachable:plumbing" is internal, not reachable/u);
});

void test("fails a reachable row claimed only by a debug spec", () => {
  const result = evaluateMap({
    ledger: ledger(row("alpha", "reachable")),
    specs: [spec("apps/desktop/e2e/drill.debug.spec.ts", "alpha")],
  });
  assert.equal(result.ok, false);
  assert.equal(result.mapped, 0);
  assert.match(
    result.problems[0],
    /"alpha": reachable row is claimed only by debug spec .*drill\.debug\.spec\.ts/u,
  );
});

void test("a debug spec may repeat an id a default-lane spec already claims", () => {
  const result = evaluateMap({
    ledger: ledger(row("alpha", "reachable")),
    specs: [spec("a.spec.ts", "alpha"), spec("drill.debug.spec.ts", "alpha")],
  });
  assert.deepEqual(result.problems, []);
  assert.equal(result.mapped, 1);
});

void test("a debug spec step naming a non-reachable id still fails", () => {
  const result = evaluateMap({
    ledger: ledger(
      row("alpha", "reachable"),
      row("sleeper", "dormant-by-decision", { decision: "#1" }),
    ),
    specs: [spec("a.spec.ts", "alpha"), spec("drill.debug.spec.ts", "sleeper")],
  });
  assert.equal(result.ok, false);
  assert.match(result.problems[0], /drill\.debug\.spec\.ts: debug step "reachable:sleeper"/u);
});

void test("rejects a malformed ledger before mapping", () => {
  const result = evaluateMap({ ledger: { version: 2, capabilities: [{ id: "x" }] }, specs: [] });
  assert.equal(result.ok, false);
  assert.ok(result.problems.length > 0);
});
