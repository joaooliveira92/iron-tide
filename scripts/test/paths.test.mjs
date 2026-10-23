import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

import { isEntryPoint, repoRelativePath, toPosixPath } from "../lib/paths.mjs";
import { slugFromPath } from "../worktree.mjs";

void test("toPosixPath joins native Windows segments with forward slashes", () => {
  assert.equal(toPosixPath("packages\\w\\src\\t.ts", path.win32), "packages/w/src/t.ts");
});

void test("toPosixPath normalises mixed separators on Windows", () => {
  assert.equal(toPosixPath("packages\\w/src\\t.ts", path.win32), "packages/w/src/t.ts");
});

void test("toPosixPath leaves POSIX paths untouched, backslashes in names included", () => {
  assert.equal(toPosixPath("packages/w/src/t.ts", path.posix), "packages/w/src/t.ts");
  assert.equal(toPosixPath("packages/w/a\\b.ts", path.posix), "packages/w/a\\b.ts");
});

void test("toPosixPath preserves spaces", () => {
  assert.equal(toPosixPath("My Docs\\a b\\t.ts", path.win32), "My Docs/a b/t.ts");
});

void test("repoRelativePath returns a POSIX path for an absolute Windows file", () => {
  assert.equal(
    repoRelativePath("D:\\a\\iron-tide", "D:\\a\\iron-tide\\packages\\w\\src\\t.ts", path.win32),
    "packages/w/src/t.ts",
  );
});

void test("repoRelativePath accepts a forward-slash file under a backslash root", () => {
  assert.equal(
    repoRelativePath("D:\\a\\iron-tide", "D:/a/iron-tide/packages/w/t.ts", path.win32),
    "packages/w/t.ts",
  );
});

void test("repoRelativePath ignores drive-letter case on Windows", () => {
  assert.equal(repoRelativePath("d:\\repo", "D:\\repo\\a.ts", path.win32), "a.ts");
});

void test("repoRelativePath keeps spaces in the root and the file", () => {
  assert.equal(
    repoRelativePath(
      "C:\\Users\\Jo Ao\\my repo",
      "C:\\Users\\Jo Ao\\my repo\\a b\\t.ts",
      path.win32,
    ),
    "a b/t.ts",
  );
});

void test("repoRelativePath passes an already normalised POSIX path through", () => {
  assert.equal(
    repoRelativePath("/work/repo", "/work/repo/packages/w/t.ts", path.posix),
    "packages/w/t.ts",
  );
});

void test("repoRelativePath names the root itself with a dot", () => {
  assert.equal(repoRelativePath("/work/repo", "/work/repo", path.posix), ".");
  assert.equal(repoRelativePath("C:\\repo", "C:\\repo", path.win32), ".");
});

void test("repoRelativePath refuses a sibling that shares the root as a name prefix", () => {
  assert.equal(repoRelativePath("/work/repo", "/work/repo-copy/a.ts", path.posix), null);
  assert.equal(repoRelativePath("C:\\work\\repo", "C:\\work\\repo-copy\\a.ts", path.win32), null);
});

void test("repoRelativePath refuses a parent, an outside worktree and another drive", () => {
  assert.equal(repoRelativePath("/work/repo", "/work", path.posix), null);
  assert.equal(repoRelativePath("/work/repo", "/work/feature-a/t.ts", path.posix), null);
  assert.equal(repoRelativePath("C:\\work\\repo", "C:\\work\\feature-a\\t.ts", path.win32), null);
  assert.equal(repoRelativePath("C:\\work\\repo", "E:\\work\\repo\\t.ts", path.win32), null);
});

void test("slugFromPath reads a worktree slug from native and git-reported Windows paths", () => {
  assert.equal(slugFromPath("C:\\Users\\Jo Ao\\repo\\.worktrees\\feature-a"), "feature-a");
  assert.equal(slugFromPath("C:/Users/Jo Ao/repo/.worktrees/feature-a/"), "feature-a");
  assert.equal(slugFromPath("/work/repo/.worktrees/feature-a"), "feature-a");
});

void test("slugFromPath returns null for a worktree outside .worktrees", () => {
  assert.equal(slugFromPath("C:\\work\\feature-a"), null);
  assert.equal(slugFromPath("/work/repo-copy/feature-a"), null);
});

function scratch() {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "paths-")));
  mkdirSync(path.join(root, "sub dir"));
  const file = path.join(root, "sub dir", "entry.mjs");
  writeFileSync(
    file,
    [
      'import { isEntryPoint } from "' +
        pathToFileURL(path.resolve("scripts/lib/paths.mjs")).href +
        '";',
      "console.log(String(isEntryPoint(import.meta.url)));",
    ].join("\n"),
  );
  return { root, file };
}

void test("isEntryPoint is true when the module is the process entry point", () => {
  const { root, file } = scratch();
  try {
    const run = spawnSync(process.execPath, [file], { encoding: "utf8" });
    assert.equal(run.stdout.trim(), "true");
    const relative = spawnSync(process.execPath, [path.relative(path.dirname(file), file)], {
      cwd: path.dirname(file),
      encoding: "utf8",
    });
    assert.equal(relative.stdout.trim(), "true");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

void test("isEntryPoint is false when the module is imported by another script", () => {
  const { root, file } = scratch();
  try {
    const other = path.join(root, "other.mjs");
    writeFileSync(other, `await import(${JSON.stringify(pathToFileURL(file).href)});\n`);
    const run = spawnSync(process.execPath, [other], { encoding: "utf8" });
    assert.equal(run.stdout.trim(), "false");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

void test("isEntryPoint is false with no argv[1] or a missing file", () => {
  assert.equal(isEntryPoint(import.meta.url, ""), false);
  assert.equal(isEntryPoint(import.meta.url, path.join(tmpdir(), "does-not-exist.mjs")), false);
});

void test("isEntryPoint sees through a symlinked directory", (t) => {
  const { root, file } = scratch();
  try {
    const link = `${root}-link`;
    try {
      symlinkSync(root, link, "junction");
    } catch {
      t.skip("symlinks unavailable");
      return;
    }
    try {
      const run = spawnSync(process.execPath, [path.join(link, "sub dir", path.basename(file))], {
        encoding: "utf8",
      });
      assert.equal(run.stdout.trim(), "true");
    } finally {
      rmSync(link, { force: true });
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
