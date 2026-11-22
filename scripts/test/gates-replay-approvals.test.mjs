import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const workflow = readFileSync(
  new URL("../../.github/workflows/gates.yml", import.meta.url),
  "utf8",
);

function jobBlock(name, nextName) {
  const start = workflow.indexOf(`\n  ${name}:\n`);
  assert.notEqual(start, -1, `job ${name} is missing from gates.yml`);
  const end = nextName === undefined ? -1 : workflow.indexOf(`\n  ${nextName}:\n`, start);
  return end === -1 ? workflow.slice(start) : workflow.slice(start, end);
}

function steps(block) {
  return block
    .split(/\n      - /)
    .slice(1)
    .map((step) => `      - ${step}`);
}

const gatesSteps = steps(jobBlock("gates", "gates-ok"));
const stepIndexWith = (line) => gatesSteps.findIndex((step) => step.includes(line));
const approvalsIndex = stepIndexWith("run: pnpm check:replay-approvals");
const buildIndex = stepIndexWith("run: pnpm --filter @bluewave/cross-process-test build");

void test("the gates matrix runs check:replay-approvals on pull requests", () => {
  assert.notEqual(approvalsIndex, -1, "gates job never runs pnpm check:replay-approvals");
  assert.ok(
    gatesSteps[approvalsIndex].includes("if: github.event_name == 'pull_request'"),
    "the approvals step must run for every pull request, not only workflow_dispatch",
  );
});

void test("the approvals check diffs against the PR base sha", () => {
  assert.notEqual(approvalsIndex, -1, "gates job never runs pnpm check:replay-approvals");
  assert.ok(
    gatesSteps[approvalsIndex].includes(
      "REPLAY_APPROVALS_BASE: ${{ github.event.pull_request.base.sha }}",
    ),
    "REPLAY_APPROVALS_BASE must be the PR base sha, not the origin/dev fallback",
  );
});

void test("the replay CLI is built before the approvals check runs", () => {
  assert.notEqual(approvalsIndex, -1, "gates job never runs pnpm check:replay-approvals");
  assert.notEqual(buildIndex, -1, "gates job never builds @bluewave/cross-process-test");
  assert.ok(buildIndex < approvalsIndex, "build must precede check:replay-approvals");
});

void test("the full history checkout keeps the PR base sha reachable", () => {
  assert.ok(
    jobBlock("gates", "gates-ok").includes("fetch-depth: 0"),
    "gates checkout must fetch full history so the base sha resolves",
  );
});

void test("gates-ok fails unless the approvals-bearing gates matrix succeeded", () => {
  const block = jobBlock("gates-ok");
  assert.ok(block.includes("needs: gates"), "gates-ok must need the gates job");
  assert.ok(
    block.includes('if [ "$RESULT" != "success" ]'),
    "gates-ok must fail on any non-success",
  );
});
