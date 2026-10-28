// End-to-end tests for scripts/worktree.mjs against throwaway git repositories.
// Each test copies the script into a scratch repo (the script resolves its repo
// root from its own location) so nothing here can touch the real checkout.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { renderLedger } from "../worktree.mjs";
import { normalizePath } from "../worktree-registry.mjs";

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(SCRIPTS, "worktree.mjs");
const REGISTRY = join(SCRIPTS, "worktree-registry.mjs");
const PATHS_HELPER = join(SCRIPTS, "lib", "paths.mjs");

function installScript(scriptsDir) {
  mkdirSync(join(scriptsDir, "lib"), { recursive: true });
  copyFileSync(SCRIPT, join(scriptsDir, "worktree.mjs"));
  copyFileSync(REGISTRY, join(scriptsDir, "worktree-registry.mjs"));
  copyFileSync(PATHS_HELPER, join(scriptsDir, "lib", "paths.mjs"));
}
const cleanups = [];
const compareText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function makeRepo() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "wt-cli-")));
  cleanups.push(root);
  const origin = join(root, "origin.git");
  const repo = join(root, "repo");
  git(root, "init", "--bare", "-b", "dev", origin);
  mkdirSync(join(repo, "scripts"), { recursive: true });
  mkdirSync(join(repo, ".ai"), { recursive: true });
  git(repo, "init", "-b", "dev");
  git(repo, "config", "user.email", "t@example.test");
  git(repo, "config", "user.name", "t");
  git(repo, "config", "commit.gpgsign", "false");
  installScript(join(repo, "scripts"));
  writeFileSync(join(repo, ".gitignore"), ".worktrees\n");
  mkdirSync(join(repo, ".worktrees"), { recursive: true });
  writeFileSync(join(repo, ".worktrees", "LEDGER.md"), renderLedger("# Active worktrees\n", []));
  git(repo, "add", "-A");
  git(repo, "commit", "-m", "init");
  git(repo, "remote", "add", "origin", origin);
  git(repo, "push", "-u", "origin", "dev");
  return repo;
}

function run(repo, ...args) {
  const r = spawnSync("node", [join(repo, "scripts", "worktree.mjs"), ...args], {
    cwd: repo,
    encoding: "utf8",
  });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

/** A worktree under .worktrees/<slug> whose branch is later merged into dev. */
function mergedWorktree(repo, slug, { outside = false } = {}) {
  const path = outside ? join(dirname(repo), slug) : join(repo, ".worktrees", slug);
  git(repo, "worktree", "add", "-b", `feat/${slug}`, path, "dev");
  writeFileSync(join(path, `${slug}.txt`), slug);
  git(path, "add", "-A");
  git(path, "commit", "-m", `work ${slug}`);
  git(repo, "merge", "--no-ff", "-m", `merge ${slug}`, `feat/${slug}`);
  git(repo, "push", "origin", "dev");
  return path;
}

function openWorktree(repo, slug) {
  const path = join(repo, ".worktrees", slug);
  git(repo, "worktree", "add", "-b", `research/${slug}`, path, "dev");
  writeFileSync(join(path, `${slug}.txt`), slug);
  git(path, "add", "-A");
  git(path, "commit", "-m", `work ${slug}`);
  return path;
}

function registryFile(repo) {
  return join(repo, ".git", "ai", "worktrees.json");
}

function register(repo, rows) {
  const full = rows.map(([slug, branch]) => ({
    slug,
    branch,
    scope: slug,
    owner: "t",
    status: "active",
    base: "dev",
    created: "2026-10-18",
    pr: "—",
    path: join(repo, ".worktrees", slug),
  }));
  const file = registryFile(repo);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify({ schemaVersion: 1, rows: full }, null, 2)}\n`);
}

function registryRows(repo) {
  const file = registryFile(repo);
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")).rows : [];
}

function snapshot(repo) {
  return JSON.stringify({
    worktrees: git(repo, "worktree", "list", "--porcelain"),
    branches: git(repo, "for-each-ref", "--format=%(refname) %(objectname)"),
    registry: existsSync(registryFile(repo)) ? readFileSync(registryFile(repo), "utf8") : null,
    ledger: existsSync(join(repo, ".worktrees", "LEDGER.md"))
      ? readFileSync(join(repo, ".worktrees", "LEDGER.md"), "utf8")
      : null,
    status: git(repo, "status", "--porcelain"),
    stash: git(repo, "stash", "list"),
  });
}

test.after(() => {
  for (const dir of cleanups) rmSync(dir, { recursive: true, force: true });
});

// --- prune defect: worktrees missing from the ledger were invisible ----------

void test("prune --check sees a merged worktree that was never registered", () => {
  const repo = makeRepo();
  mergedWorktree(repo, "a");
  const { code, out } = run(repo, "prune", "--check");
  assert.equal(code, 0);
  assert.match(out, /stale a \(merged\)/);
});

void test("prune removes a merged unregistered worktree and its branch", () => {
  const repo = makeRepo();
  const path = mergedWorktree(repo, "a");
  const { code } = run(repo, "prune");
  assert.equal(code, 0);
  assert.equal(existsSync(path), false);
  assert.equal(git(repo, "branch", "--list", "feat/a").trim(), "");
});

void test("prune leaves unmerged and detached unregistered worktrees alone", () => {
  const repo = makeRepo();
  const open = openWorktree(repo, "r1");
  const detached = join(repo, ".worktrees", "det");
  git(repo, "worktree", "add", "--detach", detached, "dev");
  writeFileSync(join(detached, "x.txt"), "x");
  git(detached, "add", "-A");
  git(detached, "commit", "-m", "unreferenced work");
  const { code } = run(repo, "prune");
  assert.equal(code, 0);
  assert.equal(existsSync(open), true);
  assert.equal(existsSync(detached), true);
  assert.notEqual(git(repo, "branch", "--list", "research/r1").trim(), "");
});

void test("prune keeps the ledger row of a dirty merged worktree it skips", () => {
  const repo = makeRepo();
  const path = mergedWorktree(repo, "a");
  register(repo, [["a", "feat/a"]]);
  writeFileSync(join(path, "scratch.txt"), "uncommitted");
  const { out } = run(repo, "prune");
  assert.match(out, /skipped a/);
  assert.equal(existsSync(path), true);
  assert.deepEqual(
    registryRows(repo).map((r) => r.slug),
    ["a"],
  );
});

void test("prune does not register unregistered survivors in the ledger", () => {
  const repo = makeRepo();
  openWorktree(repo, "r1");
  const before = snapshot(repo);
  run(repo, "prune");
  assert.equal(registryRows(repo).length, 0);
  assert.equal(git(repo, "status", "--porcelain").trim(), "");
  assert.match(before, /"worktrees":/);
});

void test("registering a worktree leaves the checkout clean and the ledger shared", () => {
  const repo = makeRepo();
  assert.equal(run(repo, "new", "a").code, 0);
  assert.equal(git(repo, "status", "--porcelain").trim(), "");
  assert.deepEqual(
    registryRows(repo).map((r) => r.slug),
    ["a"],
  );
  installScript(join(repo, ".worktrees", "a", "scripts"));
  const inner = spawnSync(
    "node",
    [join(repo, ".worktrees", "a", "scripts", "worktree.mjs"), "list"],
    {
      cwd: join(repo, ".worktrees", "a"),
      encoding: "utf8",
    },
  );
  assert.equal(inner.status, 0);
  assert.equal(existsSync(join(repo, ".worktrees", "a", ".worktrees", "LEDGER.md")), false);
  assert.equal(existsSync(join(repo, ".worktrees", "a", ".git", "ai", "worktrees.json")), false);
});

// --- fail closed -------------------------------------------------------------

void test("help is real output and mutates nothing", () => {
  const repo = makeRepo();
  const path = mergedWorktree(repo, "a");
  const before = snapshot(repo);
  for (const argv of [["--help"], ["prune", "--help"], ["help"], ["audit", "-h"]]) {
    const r = run(repo, ...argv);
    assert.equal(r.code, 0, argv.join(" "));
    assert.match(r.out, /usage/i);
  }
  assert.equal(existsSync(path), true);
  assert.equal(snapshot(repo), before);
});

void test("invalid arguments exit non-zero and cannot trigger cleanup", () => {
  const repo = makeRepo();
  const path = mergedWorktree(repo, "a");
  const before = snapshot(repo);
  for (const argv of [
    ["prune", "--bogus"],
    ["prune", "-x"],
    ["prune", "extra"],
    ["prune", "--check", "--force"],
    ["sync", "--wat"],
    ["remove", "a", "--wat"],
    ["new", "z", "--wat", "x"],
    ["audit", "--force"],
    ["bogus"],
  ]) {
    const r = run(repo, ...argv);
    assert.equal(r.code, 2, argv.join(" "));
    assert.match(r.err, /usage/i);
  }
  assert.equal(existsSync(path), true);
  assert.equal(snapshot(repo), before);
});

// --- audit -------------------------------------------------------------------

void test("audit is read-only and reports drift with exit 1", () => {
  const repo = makeRepo();
  mergedWorktree(repo, "a");
  openWorktree(repo, "r1");
  const before = snapshot(repo);
  const r = run(repo, "audit", "--no-gh");
  assert.equal(r.code, 1);
  assert.match(r.out, /worktree-stale/);
  assert.match(r.out, /worktree-unregistered/);
  assert.equal(snapshot(repo), before);
});

void test("audit exits 0 when every worktree is registered and nothing is stale", () => {
  const repo = makeRepo();
  openWorktree(repo, "r1");
  register(repo, [["r1", "research/r1"]]);
  const r = run(repo, "audit", "--no-gh");
  assert.equal(r.code, 0, r.out);
});

void test("audit detects worktrees outside .worktrees/ and phantom ledger rows", () => {
  const repo = makeRepo();
  mergedWorktree(repo, "far", { outside: true });
  register(repo, [["ghost", "feat/ghost"]]);
  const report = JSON.parse(run(repo, "audit", "--no-gh", "--json").out);
  const codes = report.drift.map((d) => d.code);
  assert.ok(codes.includes("worktree-outside"));
  assert.ok(codes.includes("ledger-phantom"));
  assert.equal(report.ok, false);
});

void test("audit --json is stable across runs and carries unique-commit counts", () => {
  const repo = makeRepo();
  openWorktree(repo, "r1");
  register(repo, [["r1", "research/r1"]]);
  const first = run(repo, "audit", "--no-gh", "--json").out;
  const second = run(repo, "audit", "--no-gh", "--json").out;
  assert.equal(first, second);
  const report = JSON.parse(first);
  const b = report.branches.find((x) => x.name === "research/r1");
  assert.equal(b.integration, "open-unmerged");
  assert.equal(b.unique, 1);
});

void test("audit and prune --check agree on what is safe to remove", () => {
  const repo = makeRepo();
  mergedWorktree(repo, "a");
  mergedWorktree(repo, "b");
  openWorktree(repo, "r1");
  register(repo, [
    ["b", "feat/b"],
    ["ghost", "feat/ghost"],
  ]);
  const report = JSON.parse(run(repo, "audit", "--no-gh", "--json").out);
  const stale = run(repo, "prune", "--check")
    .out.split("\n")
    .filter((l) => l.startsWith("stale "))
    .map((l) => l.split(" ")[1])
    .sort(compareText);
  assert.deepEqual([...report.prunable].sort(compareText), stale);
  assert.deepEqual(stale, ["a", "b", "ghost"]);
});

void test("audit without --no-gh fails loudly when pull requests cannot be read", () => {
  const repo = makeRepo();
  const before = snapshot(repo);
  const r = run(repo, "audit");
  assert.equal(r.code, 2);
  assert.match(r.err, /gh|pull request/i);
  assert.equal(snapshot(repo), before);
});

// --- shared registry (ADR-0313) ---------------------------------------------

void test("two linked worktrees register into one shared registry", () => {
  const repo = makeRepo();
  assert.equal(run(repo, "new", "a").code, 0);
  installScript(join(repo, ".worktrees", "a", "scripts"));
  const inner = spawnSync(
    "node",
    [join(repo, ".worktrees", "a", "scripts", "worktree.mjs"), "new", "b", "--branch", "feat/b"],
    { cwd: join(repo, ".worktrees", "a"), encoding: "utf8" },
  );
  assert.equal(inner.status, 0, inner.stderr);
  assert.equal(existsSync(join(repo, ".worktrees", "b")), true);
  assert.deepEqual(
    registryRows(repo)
      .map((r) => r.slug)
      .sort(),
    ["a", "b"],
  );
  const root = normalizePath(realpathSync(repo));
  const registryPaths = registryRows(repo).map((r) => ({
    stored: r.path,
    resolved: normalizePath(realpathSync(r.path)),
  }));
  assert.ok(
    registryPaths.every((entry) => entry.resolved.startsWith(root)),
    JSON.stringify({ root, registryPaths }),
  );
  assert.equal(existsSync(join(repo, ".worktrees", "a", ".worktrees", "b")), false);
});

void test("malformed registry fails closed without overwriting it", () => {
  const repo = makeRepo();
  openWorktree(repo, "a");
  const file = registryFile(repo);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, "{not json");
  const before = readFileSync(file, "utf8");
  const r = run(repo, "list");
  assert.equal(r.code, 2);
  assert.match(r.err, /worktree registry/i);
  assert.equal(readFileSync(file, "utf8"), before);
});

void test("legacy ledger metadata migrates once and drops phantom rows", () => {
  const repo = makeRepo();
  openWorktree(repo, "a");
  const legacy = join(repo, ".worktrees", "LEDGER.md");
  writeFileSync(
    legacy,
    renderLedger("# Active worktrees\n", [
      {
        slug: "a",
        branch: "research/a",
        scope: "a",
        owner: "t",
        status: "active",
        base: "dev",
        created: "2026-10-18",
        pr: "—",
      },
      {
        slug: "ghost",
        branch: "feat/ghost",
        scope: "ghost",
        owner: "t",
        status: "active",
        base: "dev",
        created: "2026-10-18",
        pr: "—",
      },
    ]),
  );
  const r = run(repo, "sync");
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(
    registryRows(repo).map((row) => row.slug),
    ["a"],
  );
  assert.equal(existsSync(join(repo, ".worktrees", "a", ".worktrees", "LEDGER.md")), false);
  assert.match(readFileSync(legacy, "utf8"), /\| ghost \|/);
  const second = run(repo, "sync");
  assert.equal(second.code, 0, second.stderr);
  assert.deepEqual(
    registryRows(repo).map((row) => row.slug),
    ["a"],
  );
});
