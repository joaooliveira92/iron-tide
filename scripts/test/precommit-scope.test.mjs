// Tests for scripts/precommit-scope.mjs — the staged-set decision the `pre-commit`
// hook uses to skip code gates for docs-only commits, and the one-line Node
// version guard that runs before the code gates.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { classifyScope, nodeVersionError } from "../precommit-scope.mjs";

const script = join(dirname(fileURLToPath(import.meta.url)), "..", "precommit-scope.mjs");

test("a markdown-only staged set is docs scope", () => {
  assert.equal(classifyScope(["README.md", "docs/agents/change-scope.md"]), "docs");
  assert.equal(classifyScope(["content/notes.mdx"]), "docs");
});

test("any non-markdown staged path makes the set code scope", () => {
  assert.equal(classifyScope(["README.md", "packages/engine/src/index.ts"]), "code");
  assert.equal(classifyScope(["package.json"]), "code");
  assert.equal(classifyScope(["docs/logo.png", "a.md"]), "code");
});

test("an empty staged set is docs scope, so no code gate runs", () => {
  assert.equal(classifyScope([]), "docs");
});

test("a Node version below engines is a one-line actionable error", () => {
  const message = nodeVersionError("22.23.4", ">=24.0.0");
  assert.match(message, /22\.23\.4/u);
  assert.match(message, />=24\.0\.0/u);
  assert.equal(message.split("\n").length, 1);
});

test("a Node version that satisfies engines passes", () => {
  assert.equal(nodeVersionError("24.18.0", ">=24.0.0"), null);
  assert.equal(nodeVersionError("25.1.0", ">=24.0.0"), null);
});

const git = (cwd, args) => execFileSync("git", args, { cwd, encoding: "utf8" });

function repoWithStaged(files) {
  const dir = mkdtempSync(join(tmpdir(), "bw-precommit-scope-"));
  git(dir, ["init", "-q", "-b", "main"]);
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  git(dir, ["add", ...Object.keys(files)]);
  return dir;
}

test("the script prints docs for a staged markdown-only set on any Node", () => {
  const dir = repoWithStaged({ "decision.md": "# Decision\n" });
  try {
    const result = spawnSync(process.execPath, [script], { cwd: dir, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "docs");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the script prints code for a staged code file on a supported Node", () => {
  const dir = repoWithStaged({ "index.ts": "export {};\n" });
  try {
    const result = spawnSync(process.execPath, [script], { cwd: dir, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "code");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
