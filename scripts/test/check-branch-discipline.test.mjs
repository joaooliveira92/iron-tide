import assert from "node:assert/strict";
import { test } from "node:test";

import {
  PROTECTED_BRANCHES,
  branchDisciplineProblems,
  isProtectedBranch,
} from "../check-branch-discipline.mjs";

void test("protects the integration branches only", () => {
  assert.deepEqual(PROTECTED_BRANCHES, ["dev", "main"]);
  assert.equal(isProtectedBranch("dev"), true);
  assert.equal(isProtectedBranch("main"), true);
  assert.equal(isProtectedBranch("feat/production-hardening"), false);
  assert.equal(isProtectedBranch("hardening/maintainability"), false);
  // A detached HEAD reports "HEAD"; it is not an integration branch.
  assert.equal(isProtectedBranch("HEAD"), false);
});

void test("a commit on a protected branch is refused, naming it", () => {
  const problems = branchDisciplineProblems({ branch: "dev" });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /protected branch "dev"/);
});

void test("a commit on a short-lived branch is allowed", () => {
  assert.deepEqual(branchDisciplineProblems({ branch: "feat/production-hardening" }), []);
  assert.deepEqual(branchDisciplineProblems({ branch: "HEAD" }), []);
});
