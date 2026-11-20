import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  COMMIT_SUBJECT,
  LOCK_PATH,
  devLockProblems,
  promote,
  promotionBranchName,
} from "../content-lock-promotion.mjs";

const HASH = "b".repeat(64);

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), "bw-content-lock-promotion-"));
  git(dir, ["init", "-q", "-b", "dev"]);
  git(dir, ["config", "user.name", "Promotion Test"]);
  git(dir, ["config", "user.email", "promotion-test@example.invalid"]);
  git(dir, ["config", "commit.gpgsign", "false"]);
  mkdirSync(join(dir, "content/production/1880"), { recursive: true });
  writeFileSync(join(dir, "content/production/1880/areas.ts"), "export const areas = [];\n");
  writeLock(dir, { contentVersion: "0.5.0", algorithm: "sha256" });
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-q", "-m", "chore: seed dev"]);
  return dir;
}

function writeLock(dir, lock) {
  writeFileSync(join(dir, LOCK_PATH), `${JSON.stringify(lock, null, 2)}\n`, "utf8");
}

const recordHash = (cwd) => {
  const lock = JSON.parse(readFileSync(join(cwd, LOCK_PATH), "utf8"));
  writeLock(cwd, { ...lock, bodyHash: HASH });
};

function withRepo(body) {
  const dir = makeRepo();
  try {
    body(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("promotionBranchName cuts promote/<date> and rejects anything but a real calendar date", () => {
  assert.equal(promotionBranchName("2026-11-20"), "promote/2026-11-20");
  assert.throws(() => promotionBranchName("2026-02-30"), /YYYY-MM-DD/u);
  assert.throws(() => promotionBranchName("20-11-2026"), /YYYY-MM-DD/u);
  assert.throws(() => promotionBranchName("2026-11-20; rm -rf ."), /YYYY-MM-DD/u);
});

test("devLockProblems accepts a lock without a body hash and rejects one that records it", () => {
  assert.deepEqual(devLockProblems({ contentVersion: "0.5.0", algorithm: "sha256" }), []);
  const problems = devLockProblems({
    contentVersion: "0.5.0",
    algorithm: "sha256",
    bodyHash: HASH,
  });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /must not carry it/u);
});

test("promote cuts the branch from base and commits only the lock body hash", () => {
  withRepo((dir) => {
    const baseBefore = git(dir, ["rev-parse", "dev"]).trim();
    const result = promote({ cwd: dir, date: "2026-11-20", base: "dev", runLock: recordHash });

    assert.equal(result.branch, "promote/2026-11-20");
    assert.equal(git(dir, ["branch", "--show-current"]).trim(), "promote/2026-11-20");
    assert.equal(git(dir, ["log", "-1", "--format=%s"]).trim(), COMMIT_SUBJECT);
    assert.equal(git(dir, ["rev-parse", "HEAD~1"]).trim(), baseBefore);
    assert.deepEqual(git(dir, ["show", "--name-only", "--format=", "HEAD"]).trim().split("\n"), [
      LOCK_PATH,
    ]);
    assert.equal(JSON.parse(git(dir, ["show", `HEAD:${LOCK_PATH}`])).bodyHash, HASH);
    assert.equal(git(dir, ["rev-parse", "dev"]).trim(), baseBefore);
    assert.equal(git(dir, ["status", "--porcelain"]).trim(), "");
  });
});

test("promote refuses a dirty working tree before touching any branch", () => {
  withRepo((dir) => {
    writeFileSync(join(dir, "scratch.txt"), "wip\n");
    assert.throws(
      () => promote({ cwd: dir, date: "2026-11-20", base: "dev", runLock: recordHash }),
      /uncommitted changes/u,
    );
    assert.equal(git(dir, ["branch", "--list", "promote/*"]).trim(), "");
  });
});

test("promote refuses to reuse an existing promote branch", () => {
  withRepo((dir) => {
    git(dir, ["branch", "promote/2026-11-20", "dev"]);
    assert.throws(
      () => promote({ cwd: dir, date: "2026-11-20", base: "dev", runLock: recordHash }),
      /already exists/u,
    );
    assert.equal(git(dir, ["branch", "--show-current"]).trim(), "dev");
  });
});

test("promote fails when content:lock changes a path other than the lock", () => {
  withRepo((dir) => {
    const touchOtherFile = (cwd) => {
      recordHash(cwd);
      writeFileSync(join(cwd, "content/production/1880/areas.ts"), "export const areas = [1];\n");
    };
    assert.throws(
      () => promote({ cwd: dir, date: "2026-11-20", base: "dev", runLock: touchOtherFile }),
      /unexpected paths: .*areas\.ts/u,
    );
    assert.equal(
      git(dir, ["log", "-1", "--format=%s", "promote/2026-11-20"]).trim(),
      "chore: seed dev",
    );
  });
});

test("promote fails when content:lock leaves the lock unchanged", () => {
  withRepo((dir) => {
    assert.throws(
      () => promote({ cwd: dir, date: "2026-11-20", base: "dev", runLock: () => {} }),
      /unchanged/u,
    );
  });
});
