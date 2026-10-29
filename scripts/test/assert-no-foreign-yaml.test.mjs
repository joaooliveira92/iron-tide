import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  classifyAll,
  classifyPath,
  diffInventory,
  ratchetAdditionsSince,
} from "../assert-no-foreign-yaml.mjs";

void test("localization catalogues are the only internationalization exception", () => {
  assert.equal(classifyPath("content/production/1880/ui/en-US.yaml"), "internationalization");
  assert.equal(classifyPath("content/production/1880/ui/pt.yaml"), "internationalization");
  assert.equal(classifyPath("content/production/1940/ui/en-US.yml"), "internationalization");
  assert.equal(classifyPath("content/production/1880/ui/nested/en-US.yaml"), "foreign");
  assert.equal(classifyPath("content/production/1880/areas.yaml"), "foreign");
});

void test("domain content and repository-owned configuration are foreign YAML", () => {
  assert.equal(classifyPath("content/production/1880/countries.yaml"), "foreign");
  assert.equal(classifyPath("content/ship-visual/parts.yaml"), "foreign");
  assert.equal(classifyPath("content/production/1880/ship-building/parts/gun.yaml"), "foreign");
  assert.equal(classifyPath("apps/desktop/electron-builder.yml"), "foreign");
});

void test("externally mandated infrastructure is its own category, never i18n", () => {
  assert.equal(classifyPath("pnpm-workspace.yaml"), "infrastructure");
  assert.equal(classifyPath("pnpm-lock.yaml"), "infrastructure");
  assert.equal(classifyPath(".github/workflows/gates.yml"), "infrastructure");
  assert.equal(classifyPath(".github/dependabot.yml"), "infrastructure");
  assert.equal(classifyPath(".agents/skills/tdd/agents/openai.yaml"), "infrastructure");
});

void test("classification splits a mixed inventory into sorted categories", () => {
  const inventory = classifyAll([
    "content/production/1880/ui/en-US.yaml",
    "pnpm-lock.yaml",
    "content/production/1880/routes.yaml",
    "content/production/1880/areas.yaml",
  ]);
  assert.deepEqual(inventory.internationalization, ["content/production/1880/ui/en-US.yaml"]);
  assert.deepEqual(inventory.infrastructure, ["pnpm-lock.yaml"]);
  assert.deepEqual(inventory.foreign, [
    "content/production/1880/areas.yaml",
    "content/production/1880/routes.yaml",
  ]);
});

void test("a new foreign path outside the ratchet is reported", () => {
  const diff = diffInventory(
    { internationalization: [], infrastructure: [], foreign: ["a.yaml", "b.yaml"] },
    { entries: ["a.yaml"] },
  );
  assert.deepEqual(diff.added, ["b.yaml"]);
  assert.deepEqual(diff.stale, []);
});

void test("a ratchet entry whose file is gone must be removed", () => {
  const diff = diffInventory(
    { internationalization: [], infrastructure: [], foreign: ["a.yaml"] },
    { entries: ["a.yaml", "gone.yaml"] },
  );
  assert.deepEqual(diff.added, []);
  assert.deepEqual(diff.stale, ["gone.yaml"]);
});

void test("a migration that deletes YAML and its ratchet entry is clean", () => {
  const diff = diffInventory(
    { internationalization: ["ui/en-US.yaml"], infrastructure: [], foreign: [] },
    { entries: [] },
  );
  assert.deepEqual(diff.added, []);
  assert.deepEqual(diff.stale, []);
});

void test("growing the ratchet since a base ref is refused; shrinking is allowed", () => {
  const dir = mkdtempSync(join(tmpdir(), "yaml-boundary-"));
  try {
    const git = (...args) =>
      execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    git("init", "-q");
    git("config", "user.email", "test@example.com");
    git("config", "user.name", "test");
    mkdirSync(join(dir, "scripts/data"), { recursive: true });
    const ratchet = join(dir, "scripts/data/yaml-boundary.ratchet.json");
    writeFileSync(ratchet, '{\n  "entries": [\n    "a.yaml"\n  ]\n}\n');
    git("add", "-A");
    git("commit", "-qm", "seed");
    git("tag", "base");

    writeFileSync(ratchet, '{\n  "entries": [\n    "a.yaml",\n    "b.yaml"\n  ]\n}\n');
    assert.deepEqual(ratchetAdditionsSince(dir, "base"), ["b.yaml"]);

    writeFileSync(ratchet, '{\n  "entries": []\n}\n');
    assert.deepEqual(ratchetAdditionsSince(dir, "base"), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
