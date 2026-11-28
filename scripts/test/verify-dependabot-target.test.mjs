import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { checkDependabotTarget } from "../verify-dependabot-target.mjs";

const ROOT = resolve(import.meta.dirname, "../..");

const DEV_NPM = `version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    target-branch: "dev"
    schedule:
      interval: "weekly"
`;

const DEV_ACTIONS = `  - package-ecosystem: "github-actions"
    directory: "/"
    target-branch: dev
    schedule:
      interval: "weekly"
`;

void test("the checked-in dependabot config targets dev for every ecosystem", () => {
  const text = readFileSync(resolve(ROOT, ".github/dependabot.yml"), "utf8");
  assert.deepEqual(checkDependabotTarget(text), []);
});

void test("quoted and unquoted dev targets both pass", () => {
  assert.deepEqual(checkDependabotTarget(DEV_NPM + DEV_ACTIONS), []);
});

void test("an ecosystem without target-branch is refused and named", () => {
  const text = `version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
`;
  const problems = checkDependabotTarget(text);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /npm/u);
  assert.match(problems[0], /target-branch "dev"/u);
});

void test("a target-branch other than dev is refused", () => {
  const problems = checkDependabotTarget(DEV_NPM.replace('"dev"', '"main"'));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /npm/u);
  assert.match(problems[0], /"main"/u);
});

void test("each ecosystem is judged on its own target-branch", () => {
  const text = `version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
  - package-ecosystem: "github-actions"
    directory: "/"
    target-branch: "dev"
`;
  const problems = checkDependabotTarget(text);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /npm/u);
  assert.doesNotMatch(problems[0], /github-actions/u);
});

void test("a config with no ecosystems is refused", () => {
  const problems = checkDependabotTarget("version: 2\nupdates: []\n");
  assert.equal(problems.length, 1);
  assert.match(problems[0], /no package-ecosystem/u);
});
