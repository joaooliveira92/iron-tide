import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, describe, test } from "node:test";

import { buildResumeContext, latestHandoff, matchBrief } from "../lib/session-resume.mjs";

const HOOK = resolve(import.meta.dirname, "..", "hooks", "session-start-resume.mjs");
const roots = [];

after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

const tempRoot = () => {
  const dir = mkdtempSync(join(tmpdir(), "session-resume-"));
  roots.push(dir);
  return dir;
};

void describe("matchBrief", () => {
  const briefs = ["issue-574-accelerate-halt.md", "t-2-tactical-navigation.md", "events.md"];

  void test("matches a brief whose slug is inside the branch", () => {
    assert.equal(
      matchBrief("feat/t-2-tactical-navigation-fix", briefs),
      ".ai/briefs/t-2-tactical-navigation.md",
    );
  });

  void test("matches by issue number", () => {
    assert.equal(
      matchBrief("feat/issue-574-halt", briefs),
      ".ai/briefs/issue-574-accelerate-halt.md",
    );
  });

  void test("ignores short numeric tokens that are not issue numbers", () => {
    assert.equal(matchBrief("t3/context-efficiency-round-2", briefs), null);
  });

  void test("returns null when nothing matches", () => {
    assert.equal(matchBrief("docs/other", briefs), null);
    assert.equal(matchBrief("", briefs), null);
  });
});

void describe("buildResumeContext", () => {
  const base = {
    branch: "feat/issue-1-x",
    statusLines: [" M a.ts", "?? b.ts"],
    brief: ".ai/briefs/x.md",
    handoff: "/tmp/handoff-x.md",
    maxChars: 600,
  };

  void test("names branch, status, brief and handoff", () => {
    const text = buildResumeContext(base);
    assert.match(text, /branch: feat\/issue-1-x/u);
    assert.match(text, / M a\.ts/u);
    assert.match(text, /brief: \.ai\/briefs\/x\.md/u);
    assert.match(text, /handoff: \/tmp\/handoff-x\.md/u);
  });

  void test("says the tree is clean and omits missing pointers", () => {
    const text = buildResumeContext({ ...base, statusLines: [], brief: null, handoff: null });
    assert.match(text, /status: clean/u);
    assert.doesNotMatch(text, /brief:|handoff:/u);
  });

  void test("never exceeds the cap and keeps the pointers when status is long", () => {
    const statusLines = Array.from(
      { length: 80 },
      (_, k) => ` M packages/some/long/path/file-${k}.ts`,
    );
    const text = buildResumeContext({ ...base, statusLines, maxChars: 300 });
    assert.ok(text.length <= 300, `${text.length}`);
    assert.match(text, /brief: \.ai\/briefs\/x\.md/u);
    assert.match(text, /handoff: \/tmp\/handoff-x\.md/u);
  });
});

void describe("latestHandoff", () => {
  void test("returns the newest handoff file", () => {
    const dir = tempRoot();
    writeFileSync(join(dir, "handoff-old.md"), "x");
    writeFileSync(join(dir, "handoff-new.md"), "x");
    writeFileSync(join(dir, "notes.md"), "x");
    utimesSync(join(dir, "handoff-old.md"), new Date(1_000), new Date(1_000));
    utimesSync(join(dir, "handoff-new.md"), new Date(2_000), new Date(2_000));
    assert.equal(
      latestHandoff(dir, { nowMs: 2_500, maxAgeMs: 10_000 }),
      join(dir, "handoff-new.md"),
    );
  });

  void test("ignores handoffs older than the age cap", () => {
    const dir = tempRoot();
    writeFileSync(join(dir, "handoff-old.md"), "x");
    utimesSync(join(dir, "handoff-old.md"), new Date(1_000), new Date(1_000));
    assert.equal(latestHandoff(dir, { nowMs: 50_000, maxAgeMs: 10_000 }), null);
  });

  void test("returns null for a missing or empty directory", () => {
    assert.equal(latestHandoff(join(tempRoot(), "absent")), null);
    assert.equal(latestHandoff(tempRoot()), null);
  });
});

void describe("session-start-resume hook", () => {
  void test("prints the resume context for the project checkout", () => {
    const root = tempRoot();
    const tmp = tempRoot();
    execFileSync("git", ["init", "-q", "-b", "feat/issue-9-demo"], { cwd: root });
    mkdirSync(join(root, ".ai", "briefs"), { recursive: true });
    writeFileSync(join(root, ".ai", "briefs", "issue-9-demo.md"), "brief\n");
    writeFileSync(join(root, "dirty.txt"), "x\n");
    writeFileSync(join(tmp, "handoff-demo.md"), "x");
    const result = spawnSync("node", [HOOK], {
      input: JSON.stringify({ source: "compact" }),
      encoding: "utf8",
      env: { ...process.env, CLAUDE_PROJECT_DIR: root, TMPDIR: tmp },
    });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /branch: feat\/issue-9-demo/u);
    assert.match(result.stdout, /\?\? dirty\.txt/u);
    assert.match(result.stdout, /brief: \.ai\/briefs\/issue-9-demo\.md/u);
    assert.match(result.stdout, /handoff: .*handoff-demo\.md/u);
  });

  void test("stays silent and exits 0 outside a git checkout", () => {
    const result = spawnSync("node", [HOOK], {
      input: "{}",
      encoding: "utf8",
      env: { ...process.env, CLAUDE_PROJECT_DIR: tempRoot() },
    });
    assert.equal(result.status, 0);
    assert.equal(result.stdout, "");
  });
});
