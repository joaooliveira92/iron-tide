import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";

import {
  collectProblems,
  commitNeedsRepin,
  isAuthoritativeSource,
  isReferenceRunExempt,
} from "../verify-golden-repin.mjs";

void test("recognises authoritative package source", () => {
  assert.equal(isAuthoritativeSource("packages/combat/src/gunnery/accuracy.ts"), true);
  assert.equal(isAuthoritativeSource("packages/campaign/src/state.tsx"), true);
  assert.equal(isAuthoritativeSource("packages/phase-engine/src/month.ts"), true);
});

void test("ignores tests, other packages, and non-source", () => {
  assert.equal(isAuthoritativeSource("packages/combat/test/gunnery/accuracy.test.ts"), false);
  assert.equal(isAuthoritativeSource("packages/desktop/src/main/index.ts"), false);
  assert.equal(isAuthoritativeSource("docs/rules/gunnery.md"), false);
  assert.equal(isAuthoritativeSource("golden/hashes.json"), false);
});

void test("authored content is exempt: the reference run uses an in-code fixture", () => {
  assert.equal(isReferenceRunExempt("content/production/1880/pack.json"), true);
  assert.equal(isAuthoritativeSource("content/production/1880/pack.json"), false);
  assert.equal(
    isAuthoritativeSource("content/production/1880/ship-building/naval-profiles/uk.yaml"),
    false,
  );
});

void test("reference-inert dock plumbing is exempt but sibling ship-design source is not", () => {
  assert.equal(isReferenceRunExempt("packages/ship-design/src/dock.ts"), true);
  assert.equal(isAuthoritativeSource("packages/ship-design/src/dock.ts"), false);
  assert.equal(isAuthoritativeSource("packages/campaign/src/state.ts"), false);
  assert.equal(isAuthoritativeSource("packages/content-schema/src/naval-profile.ts"), false);
  // A different ship-design module is still gated.
  assert.equal(isAuthoritativeSource("packages/ship-design/src/construction.ts"), true);
  assert.equal(isAuthoritativeSource("packages/phase-engine/src/month.ts"), true);
});

void test("a docs-only commit never needs a re-pin", () => {
  assert.equal(commitNeedsRepin(["docs/adr/ADR-0001.md"], "docs: add ADR"), false);
});

void test("a content-only commit never needs a re-pin", () => {
  assert.equal(
    commitNeedsRepin(
      ["content/production/1880/ship-building/naval-profiles/uk.yaml"],
      "content(shipbuilding): author dock record",
    ),
    false,
  );
});

void test("authoritative source without golden needs a re-pin", () => {
  assert.equal(
    commitNeedsRepin(["packages/combat/src/gunnery/accuracy.ts"], "fix(combat): tune accuracy"),
    true,
  );
});

void test("re-pinning the golden in the same commit satisfies the guard", () => {
  assert.equal(
    commitNeedsRepin(
      ["packages/combat/src/gunnery/accuracy.ts", "golden/hashes.json"],
      "fix(combat): tune accuracy",
    ),
    false,
  );
});

void test("the not-needed trailer records a deliberate no-output change", () => {
  const message =
    "refactor(phase-engine): type the pipeline throws\n\nNo authoritative output changes.\nGolden-Repin: not-needed\n";
  assert.equal(commitNeedsRepin(["packages/phase-engine/src/errors.ts"], message), false);
});

void test("collectProblems reports only offending commits", () => {
  const commits = [
    {
      hash: "a".repeat(40),
      subject: "fix: ok",
      message: "fix: ok\n",
      paths: ["packages/combat/src/x.ts", "golden/hashes.json"],
    },
    {
      hash: "b".repeat(40),
      subject: "fix: drift",
      message: "fix: drift\n",
      paths: ["packages/phase-engine/src/y.ts"],
    },
  ];
  const problems = collectProblems(commits);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].hash, "b".repeat(40));
  assert.deepEqual(problems[0].files, ["packages/phase-engine/src/y.ts"]);
});

void test("the campaign-engine world map stays gated: no path was exempted to clear 341ce675", () => {
  assert.equal(isReferenceRunExempt("packages/campaign-engine/src/world-map.ts"), false);
  assert.equal(isAuthoritativeSource("packages/campaign-engine/src/world-map.ts"), true);
  assert.equal(
    commitNeedsRepin(
      ["packages/campaign-engine/src/world-map.ts"],
      "feat(map): draw sea lanes from the campaign's compiled routes",
    ),
    true,
  );
});

const SCRIPT = resolve(import.meta.dirname, "../verify-golden-repin.mjs");
const BASELINE = resolve(import.meta.dirname, "../golden-repin.baseline");
const WORLD_MAP = "packages/campaign-engine/src/world-map.ts";

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

/** Commits `path` with `message` in `cwd` and returns the new commit's SHA. */
function commit(cwd, path, message) {
  mkdirSync(dirname(join(cwd, path)), { recursive: true });
  writeFileSync(join(cwd, path), `${message}\n${Math.random()}\n`);
  git(cwd, "add", "-A");
  git(cwd, "commit", "-q", "-m", message);
  return git(cwd, "rev-parse", "HEAD");
}

function runGuard(cwd, range) {
  return spawnSync(process.execPath, [SCRIPT, "--range", range], { cwd, encoding: "utf8" });
}

void test("the ratchet acknowledges only the baseline commit: later commits are still rejected", () => {
  const repo = mkdtempSync(join(tmpdir(), "golden-repin-"));
  try {
    git(repo, "init", "-q");
    git(repo, "config", "user.email", "test@example.com");
    git(repo, "config", "user.name", "Test");
    git(repo, "config", "commit.gpgsign", "false");
    // The incident: an authoritative edit with no re-pin and no trailer, now the baseline.
    const baseline = commit(repo, WORLD_MAP, "feat(map): the acknowledged violation");
    const range = `${baseline}..HEAD`;

    // Nothing after the baseline yet: the acknowledged commit no longer fails the guard.
    assert.equal(runGuard(repo, range).status, 0);

    // The same kind of edit after the baseline is rejected, and only that commit is named.
    const offender = commit(repo, WORLD_MAP, "feat(map): a new violation");
    const rejected = runGuard(repo, range);
    assert.equal(rejected.status, 1);
    assert.match(rejected.stderr, new RegExp(offender.slice(0, 8)));
    assert.doesNotMatch(rejected.stderr, new RegExp(baseline.slice(0, 8)));

    // Either remedy clears a later commit: a golden update, or the not-needed trailer.
    const repinned = mkdtempSync(join(tmpdir(), "golden-repin-ok-"));
    try {
      git(repinned, "init", "-q");
      git(repinned, "config", "user.email", "test@example.com");
      git(repinned, "config", "user.name", "Test");
      git(repinned, "config", "commit.gpgsign", "false");
      const base = commit(repinned, WORLD_MAP, "feat(map): baseline");
      writeFileSync(join(repinned, WORLD_MAP), "changed\n");
      mkdirSync(join(repinned, "golden"), { recursive: true });
      writeFileSync(join(repinned, "golden/hashes.json"), "{}\n");
      git(repinned, "add", "-A");
      git(repinned, "commit", "-q", "-m", "fix(map): re-pinned in the same commit");
      commit(repinned, WORLD_MAP, "refactor(map): no output change\n\nGolden-Repin: not-needed");
      assert.equal(runGuard(repinned, `${base}..HEAD`).status, 0);
    } finally {
      rmSync(repinned, { recursive: true, force: true });
    }
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

void test("the recorded baseline is a full SHA that is reachable, so the guard cannot silently skip", () => {
  const baseline = readFileSync(BASELINE, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line !== "" && !line.startsWith("#"));
  assert.match(baseline ?? "", /^[0-9a-f]{40}$/);
  // A shallow checkout cannot resolve history; the guard skips there by design, so skip here too.
  if (git(process.cwd(), "rev-parse", "--is-shallow-repository") === "true") return;
  assert.doesNotThrow(() => git(process.cwd(), "merge-base", "--is-ancestor", baseline, "HEAD"));
});
