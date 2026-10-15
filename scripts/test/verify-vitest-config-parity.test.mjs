// Tests for scripts/verify-vitest-config-parity.mjs — the Vitest baseline
// parity gate's detection boundary (maintainability-hardening ticket 03). Covers
// the two failure paths (absent config, config that dropped the baseline) and
// the baseline's own required keys.
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  BASELINE_MODULE,
  checkBaseline,
  checkConfigParity,
  importsSharedBaseline,
} from "../verify-vitest-config-parity.mjs";

const BASELINE_CONFIG = [
  'import { defineConfig } from "vite-plus";',
  `import { sharedTestConfig } from "../../${BASELINE_MODULE}";`,
  "",
  "export default defineConfig({ test: { ...sharedTestConfig } });",
].join("\n");

const PROJECT = { dir: "packages/keeper", name: "@bluewave/keeper" };

const readFrom = (configs) => (dir) =>
  Object.hasOwn(configs, dir)
    ? { path: `${dir}/vitest.config.ts`, text: configs[dir] ?? "" }
    : undefined;

void test("importsSharedBaseline admits a config that imports and spreads the baseline", () => {
  assert.equal(importsSharedBaseline(BASELINE_CONFIG), true);
});

void test("importsSharedBaseline rejects a hand-rolled config", () => {
  assert.equal(importsSharedBaseline("export default { test: { testTimeout: 15000 } };\n"), false);
});

void test("importsSharedBaseline requires the spread, not just the import", () => {
  const importedOnly = [
    `import { sharedTestConfig } from "../../${BASELINE_MODULE}";`,
    "export default { test: {} };",
  ].join("\n");
  assert.equal(importsSharedBaseline(importedOnly), false);
});

void test("importsSharedBaseline ignores the baseline named only in a comment", () => {
  const commentOnly = [
    `// import { sharedTestConfig } from "../../${BASELINE_MODULE}";`,
    "export default { test: { testTimeout: 15000 } };",
  ].join("\n");
  assert.equal(importsSharedBaseline(commentOnly), false);
});

void test("checkConfigParity passes when every project inherits the baseline", () => {
  const problems = checkConfigParity({
    projects: [PROJECT],
    readConfig: readFrom({ [PROJECT.dir]: BASELINE_CONFIG }),
  });
  assert.deepEqual(problems, []);
});

void test("checkConfigParity fails an absent config, naming the package", () => {
  const problems = checkConfigParity({ projects: [PROJECT], readConfig: readFrom({}) });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /@bluewave\/keeper \(packages\/keeper\): no vitest config/);
});

void test("checkConfigParity fails a config that dropped the baseline, naming the package", () => {
  const problems = checkConfigParity({
    projects: [PROJECT],
    readConfig: readFrom({ [PROJECT.dir]: "export default { test: {} };\n" }),
  });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /@bluewave\/keeper \(packages\/keeper\)/);
  assert.match(problems[0], /does not import the shared baseline/);
});

void test("checkConfigParity reports a drifting project without flagging a compliant one", () => {
  const second = { dir: "apps/other", name: "@bluewave/other" };
  const problems = checkConfigParity({
    projects: [PROJECT, second],
    readConfig: readFrom({ [second.dir]: BASELINE_CONFIG }),
  });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /packages\/keeper/);
});

void test("checkBaseline requires the explicit timeout and the shared cache", () => {
  assert.deepEqual(checkBaseline({ testTimeout: 15000, fsModuleCache: true }), []);
  assert.equal(checkBaseline({ fsModuleCache: true }).length, 1);
  assert.equal(checkBaseline({ testTimeout: 15000 }).length, 1);
  assert.equal(checkBaseline(undefined).length, 2);
});

void test("checkBaseline rejects a timeout at or below Vitest's default", () => {
  assert.equal(checkBaseline({ testTimeout: 5000, fsModuleCache: true }).length, 1);
  assert.equal(checkBaseline({ testTimeout: 4999, fsModuleCache: true }).length, 1);
});
