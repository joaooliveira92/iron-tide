// Tests for scripts/worktree-registry.mjs: strict decode, canonical write,
// atomic replacement, fail-closed corruption and lock contention.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  WorktreeRegistryError,
  acquireRegistryLock,
  decodeRegistry,
  readRegistryFile,
  serializeRegistry,
  updateRegistry,
  writeRegistryFile,
} from "../worktree-registry.mjs";

const cleanups = [];

function scratch() {
  const root = mkdtempSync(join(tmpdir(), "wt-registry-"));
  cleanups.push(root);
  return join(root, "ai", "worktrees.json");
}

function row(overrides = {}) {
  return {
    slug: "a",
    branch: "feat/a",
    scope: "a",
    owner: "orchestrator",
    status: "active",
    base: "dev",
    created: "2026-10-27",
    pr: "—",
    path: "/repo/.worktrees/a",
    ...overrides,
  };
}

test.after(() => {
  for (const dir of cleanups) rmSync(dir, { recursive: true, force: true });
});

void test("serializeRegistry is canonical and round-trips", () => {
  const text = serializeRegistry([row({ slug: "b" }), row({ slug: "a" })]);
  assert.deepEqual(
    JSON.parse(text).rows.map((r) => r.slug),
    ["a", "b"],
  );
  assert.deepEqual(
    decodeRegistry(JSON.parse(text)).rows.map((r) => r.slug),
    ["a", "b"],
  );
});

void test("decodeRegistry rejects unknown schema versions and fields", () => {
  assert.throws(
    () => decodeRegistry({ schemaVersion: 2, rows: [] }),
    (error) => error.code === "WORKTREE_REGISTRY_UNSUPPORTED",
  );
  assert.throws(
    () => decodeRegistry({ schemaVersion: 1, rows: [], extra: true }),
    (error) => error.code === "WORKTREE_REGISTRY_CORRUPT",
  );
  assert.throws(
    () => decodeRegistry({ schemaVersion: 1, rows: [{ ...row(), extra: true }] }),
    (error) => error.code === "WORKTREE_REGISTRY_CORRUPT",
  );
  assert.throws(
    () => decodeRegistry({ schemaVersion: 1, rows: [row(), row()] }),
    (error) => error.code === "WORKTREE_REGISTRY_CORRUPT",
  );
});

void test("decodeRegistry requires absolute, canonical paths", () => {
  assert.throws(
    () => decodeRegistry({ schemaVersion: 1, rows: [row({ path: ".worktrees/a" })] }),
    (error) => error.code === "WORKTREE_REGISTRY_CORRUPT",
  );
  const decoded = decodeRegistry({
    schemaVersion: 1,
    rows: [row({ path: "/repo/.worktrees/../.worktrees/a" })],
  });
  assert.equal(decoded.rows[0].path, "/repo/.worktrees/a");
});

void test("writeRegistryFile replaces atomically and leaves no lock", () => {
  const path = scratch();
  writeRegistryFile([row()], path);
  assert.equal(readRegistryFile(path).rows.length, 1);
  writeRegistryFile([row({ slug: "b" })], path);
  assert.deepEqual(
    readRegistryFile(path).rows.map((r) => r.slug),
    ["b"],
  );
  assert.match(readFileSync(path, "utf8"), /"schemaVersion": 1/);
  assert.equal(existsSync(`${path}.lock`), false);
});

void test("a corrupt registry fails closed and is not overwritten", () => {
  const path = scratch();
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, "{not json");
  assert.throws(
    () => readRegistryFile(path),
    (error) => error instanceof WorktreeRegistryError && error.code === "WORKTREE_REGISTRY_CORRUPT",
  );
  assert.throws(
    () => updateRegistry(() => [row()], path),
    (error) => error.code === "WORKTREE_REGISTRY_CORRUPT",
  );
  assert.equal(readFileSync(path, "utf8"), "{not json");
});

void test("the lock excludes concurrent writers and rejects a held lock", () => {
  const path = scratch();
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(`${path}.lock`, "held\n");
  assert.throws(
    () => acquireRegistryLock(path, { timeoutMs: 50 }),
    (error) => error.code === "WORKTREE_REGISTRY_LOCKED",
  );
});

void test("updateRegistry mutates under the lock and releases it", () => {
  const path = scratch();
  updateRegistry(() => [row()], path);
  updateRegistry((rows) => [...rows, row({ slug: "b", path: "/repo/.worktrees/b" })], path);
  assert.deepEqual(
    readRegistryFile(path).rows.map((r) => r.slug),
    ["a", "b"],
  );
  assert.equal(existsSync(`${path}.lock`), false);
});
