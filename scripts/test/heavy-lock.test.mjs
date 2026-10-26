import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { acquireHeavyLock, loadWarning } from "../lib/heavy-lock.mjs";

function scratch() {
  const dir = mkdtempSync(join(tmpdir(), "bw-heavy-lock-"));
  return {
    dir,
    lockDir: join(dir, "lock"),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

const base = (lockDir, over = {}) => ({
  lockDir,
  pid: 100,
  command: "pnpm check",
  isAlive: () => true,
  ancestorPids: [],
  wait: async () => {},
  onWait: () => {},
  staleMs: 10_000,
  ...over,
});

function seedHolder(lockDir, pid, command) {
  const options = base(lockDir, { pid, command });
  return acquireHeavyLock(options);
}

void test("takes a free lock, records the holder and removes it on release", async () => {
  const { lockDir, cleanup } = scratch();
  try {
    const release = await acquireHeavyLock(base(lockDir));
    assert.equal(readFileSync(join(lockDir, "pid"), "utf8"), "100");
    assert.equal(readFileSync(join(lockDir, "cmd"), "utf8"), "pnpm check");
    release();
    assert.equal(existsSync(lockDir), false);
  } finally {
    cleanup();
  }
});

void test("waits while a live holder owns the lock, then takes it once released", async () => {
  const { lockDir, cleanup } = scratch();
  try {
    const releaseHolder = await seedHolder(lockDir, 7, "pnpm test:run");
    const seen = [];
    let polls = 0;
    const release = await acquireHeavyLock(
      base(lockDir, {
        onWait: (holder) => seen.push(holder),
        wait: async () => {
          polls += 1;
          if (polls === 3) releaseHolder();
        },
      }),
    );
    assert.deepEqual(seen, [{ pid: 7, command: "pnpm test:run" }]);
    assert.equal(polls, 3);
    assert.equal(readFileSync(join(lockDir, "pid"), "utf8"), "100");
    release();
  } finally {
    cleanup();
  }
});

void test("reclaims a lock whose holder process is gone", async () => {
  const { lockDir, cleanup } = scratch();
  try {
    await seedHolder(lockDir, 7, "pnpm check");
    const release = await acquireHeavyLock(base(lockDir, { isAlive: (pid) => pid !== 7 }));
    assert.equal(readFileSync(join(lockDir, "pid"), "utf8"), "100");
    release();
  } finally {
    cleanup();
  }
});

void test("proceeds without waiting when an ancestor process already holds the lock", async () => {
  const { lockDir, cleanup } = scratch();
  try {
    const releaseHolder = await seedHolder(lockDir, 7, "heavy pnpm check");
    let waited = false;
    const release = await acquireHeavyLock(
      base(lockDir, { ancestorPids: [50, 7], wait: async () => (waited = true) }),
    );
    release();
    assert.equal(waited, false);
    assert.equal(readFileSync(join(lockDir, "pid"), "utf8"), "7");
    releaseHolder();
  } finally {
    cleanup();
  }
});

void test("reclaims a lock directory that never recorded a holder once it is stale", async () => {
  const { lockDir, cleanup } = scratch();
  try {
    const first = await seedHolder(lockDir, 7, "x");
    rmSync(join(lockDir, "pid"));
    const old = new Date(Date.now() - 60_000);
    utimesSync(lockDir, old, old);
    const release = await acquireHeavyLock(base(lockDir));
    assert.equal(readFileSync(join(lockDir, "pid"), "utf8"), "100");
    release();
    first();
  } finally {
    cleanup();
  }
});

void test("a lock directory with no holder yet is waited on while fresh", async () => {
  const { lockDir, cleanup } = scratch();
  try {
    await seedHolder(lockDir, 7, "x");
    writeFileSync(join(lockDir, "note"), "");
    rmSync(join(lockDir, "pid"));
    let polls = 0;
    const release = await acquireHeavyLock(
      base(lockDir, {
        wait: async () => {
          polls += 1;
          if (polls === 2) rmSync(lockDir, { recursive: true, force: true });
        },
      }),
    );
    assert.equal(polls, 2);
    release();
  } finally {
    cleanup();
  }
});

void test("warns when the one-minute load exceeds the core count and stays silent otherwise", () => {
  assert.equal(loadWarning({ load: 3.2, cores: 10 }), undefined);
  assert.equal(loadWarning({ load: 10, cores: 10 }), undefined);
  const warning = loadWarning({ load: 53.4, cores: 10 });
  assert.match(warning, /load average 53\.4 on 10 cores/u);
  assert.match(warning, /environmental/u);
});
