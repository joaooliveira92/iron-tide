// Tests for scripts/precommit-staged.mjs — the staged-file format check the
// `pre-commit` hook runs. The hook can run from a GUI or non-login shell whose
// PATH lacks the package manager (but has node), so the check must resolve the
// formatter directly (the workspace vite-plus entry point) and never depend on
// `pnpm` being on PATH, nor reject a valid commit with a misleading "not
// formatted" error when the formatter cannot be found (ADR-0107).
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const script = join(dirname(fileURLToPath(import.meta.url)), "..", "precommit-staged.mjs");

// The real workspace formatter entry, read from vite-plus' own package `bin` so
// the fixture cannot silently agree with a wrong path hardcoded in the script.
const vitePlusBin = createRequire(import.meta.url)("vite-plus/package.json").bin.vp;

const EXTENSIONS = process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];

function dirHas(dir, name) {
  return EXTENSIONS.some((extension) => existsSync(join(dir, name + extension)));
}

// A PATH like the current one with every directory that provides `name` removed,
// so the fixture proves the check works without that executable. The kept
// directories still provide git (present in its own system directory here).
function pathWithout(...names) {
  return (process.env.PATH || "")
    .split(delimiter)
    .filter((dir) => dir !== "" && !names.some((name) => dirHas(dir, name)))
    .join(delimiter);
}

// Whether `name` is reachable on `path`, by scanning the directories directly
// (no child process, so it is deterministic across shells/OSes).
function isOnPath(name, path) {
  return path.split(delimiter).some((dir) => dir !== "" && dirHas(dir, name));
}

function git(cwd, args) {
  execFileSync("git", args, { cwd, encoding: "utf8" });
}

// A fresh git repo with one staged text file and, when requested, a fake
// workspace `vite-plus` formatter that the script resolves and runs.
function makeRepo({ formatterExit } = {}) {
  const repo = mkdtempSync(join(tmpdir(), "bw-precommit-"));
  git(repo, ["init", "-q", "-b", "main"]);
  writeFileSync(join(repo, "staged.txt"), "hello\n");
  git(repo, ["add", "staged.txt"]);
  if (formatterExit !== undefined) {
    const packageDir = join(repo, "node_modules", "vite-plus");
    mkdirSync(dirname(join(packageDir, vitePlusBin)), { recursive: true });
    writeFileSync(join(packageDir, vitePlusBin), `process.exit(${formatterExit});\n`);
  }
  return repo;
}

function run(repo, path) {
  return spawnSync(process.execPath, [script], {
    encoding: "utf8",
    cwd: repo,
    env: { ...process.env, PATH: path },
  });
}

void test("runs the staged format check when PATH lacks the package manager", () => {
  const repo = makeRepo({ formatterExit: 0 });
  try {
    const path = pathWithout("pnpm");
    assert.equal(isOnPath("pnpm", path), false, "fixture PATH must not expose pnpm");
    assert.equal(isOnPath("git", path), true, "fixture PATH must still expose git");
    const result = run(repo, path);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ok \(1 staged file\(s\)\)/u);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

void test("runs the check unchanged when the package manager is already on PATH", () => {
  assert.equal(isOnPath("pnpm", process.env.PATH), true, "fixture requires pnpm on PATH");
  const repo = makeRepo({ formatterExit: 0 });
  try {
    const result = run(repo, process.env.PATH);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ok \(1 staged file\(s\)\)/u);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

void test("reports unformatted files with the existing message", () => {
  const repo = makeRepo({ formatterExit: 1 });
  try {
    const result = run(repo, pathWithout("pnpm"));
    assert.equal(result.status, 1);
    assert.match(result.stderr, /not formatted/u);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

void test("names the missing formatter instead of claiming files are unformatted", () => {
  const repo = makeRepo();
  try {
    const result = run(repo, pathWithout("pnpm", "vp"));
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stderr, /not formatted/u);
    assert.match(result.stderr, /could not run the formatter/u);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
