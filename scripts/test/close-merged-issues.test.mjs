import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  closeReferencedIssues,
  isDeliveringBase,
  main,
  parseIssueReferences,
} from "../close-merged-issues.mjs";

const fakeRun =
  (state, onClose = () => {}) =>
  (command, args) => {
    const key = `${command} ${args.join(" ")}`;
    if (command === "gh" && args[0] === "issue" && args[1] === "view") {
      return JSON.stringify({ state: state(args[2]) });
    }
    if (command === "gh" && args[0] === "issue" && args[1] === "close") {
      onClose(args[2], args);
      return "";
    }
    throw new Error(`unexpected ${key}`);
  };

const capture = (environment, run) => {
  const lines = [];
  const code = main(environment, { run, out: (line) => lines.push(line) });
  return { code, text: lines.join("\n") };
};

void describe("parseIssueReferences", () => {
  void test("finds close and fix forms in prose", () => {
    const body = "Closes #12\nfixes #34\nFixed: #56\nresolve #78 fixed #12";
    assert.deepEqual(parseIssueReferences(body), [12, 34, 56]);
  });

  void test("ignores fenced and inline code", () => {
    const body = ["Closes #1", "```", "Closes #2", "```", "`Closes #3`"].join("\n");
    assert.deepEqual(parseIssueReferences(body), [1]);
  });

  void test("tolerates a missing body and unrelated words", () => {
    assert.deepEqual(parseIssueReferences(undefined), []);
    assert.deepEqual(parseIssueReferences("This closes the loop on #9"), []);
  });
});

void describe("isDeliveringBase", () => {
  void test("accepts the delivering branches only", () => {
    assert.equal(isDeliveringBase("dev"), true);
    assert.equal(isDeliveringBase("main"), true);
    assert.equal(isDeliveringBase("feat/x"), false);
    assert.equal(isDeliveringBase(""), false);
  });
});

void describe("closeReferencedIssues", () => {
  void test("closes open issues and skips closed ones", () => {
    const closed = [];
    const run = fakeRun(
      (issue) => (issue === "7" ? "CLOSED" : "OPEN"),
      (issue) => closed.push(issue),
    );
    const summary = closeReferencedIssues({
      refs: [7, 8],
      prNumber: 99,
      baseRef: "dev",
      run,
    });
    assert.deepEqual(summary.closed, [8]);
    assert.deepEqual(summary.alreadyClosed, [7]);
    assert.deepEqual(closed, ["8"]);
  });

  void test("reports a failed close without throwing", () => {
    const summary = closeReferencedIssues({
      refs: [4],
      prNumber: 99,
      baseRef: "dev",
      run: (command, args) => {
        if (args[1] === "view") return JSON.stringify({ state: "OPEN" });
        throw new Error("permission denied");
      },
    });
    assert.deepEqual(
      summary.failed.map((entry) => entry.issue),
      [4],
    );
  });
});

void describe("main", () => {
  const merged = {
    PR_MERGED: "true",
    PR_NUMBER: "99",
    PR_BASE_REF: "dev",
    PR_BODY: "Closes #5",
  };

  void test("closes references for a merged dev pull request", () => {
    const calls = [];
    const run = fakeRun(
      () => "OPEN",
      (issue, args) => calls.push({ issue, args }),
    );
    const { code, text } = capture(merged, run);
    assert.equal(code, 0);
    assert.match(text, /closed 1/);
    assert.equal(calls[0].issue, "5");
    assert.deepEqual(calls[0].args.slice(0, 4), ["issue", "close", "5", "--reason"]);
    assert.match(calls[0].args.join(" "), /completed/);
  });

  void test("does nothing for an unmerged pull request or a non-delivering base", () => {
    const run = () => {
      throw new Error("must not run");
    };
    assert.equal(capture({ ...merged, PR_MERGED: "false" }, run).code, 0);
    assert.equal(capture({ ...merged, PR_BASE_REF: "feat/x" }, run).code, 0);
  });

  void test("fails when a close fails so the run is visible", () => {
    const run = fakeRun(
      () => "OPEN",
      () => {
        throw new Error("denied");
      },
    );
    assert.equal(capture(merged, run).code, 1);
  });
});
