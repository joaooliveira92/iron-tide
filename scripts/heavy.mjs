#!/usr/bin/env node
import { spawn } from "node:child_process";
import { availableParallelism, loadavg } from "node:os";

import {
  acquireHeavyLock,
  ancestorPidsOf,
  DEFAULT_POLL_MS,
  defaultLockDir,
  isProcessAlive,
  loadWarning,
} from "./lib/heavy-lock.mjs";

const command = process.argv.slice(2);
if (command.length === 0) {
  console.error("usage: node scripts/heavy.mjs <command> [args...]");
  process.exit(2);
}

const warning = loadWarning({ load: loadavg()[0] ?? 0, cores: availableParallelism() });
if (warning !== undefined) console.error(warning);

const release = await acquireHeavyLock({
  lockDir: process.env.BLUEWAVE_HEAVY_LOCK_DIR ?? defaultLockDir(),
  pid: process.pid,
  command: command.join(" "),
  isAlive: isProcessAlive,
  ancestorPids: ancestorPidsOf(process.pid),
  wait: () => new Promise((resolve) => setTimeout(resolve, DEFAULT_POLL_MS)),
  onWait: (holder) =>
    console.error(
      `heavy: waiting for pid ${String(holder?.pid ?? "?")} (${holder?.command ?? "unknown"})`,
    ),
});

const child = spawn(command[0], command.slice(1), {
  stdio: "inherit",
  env: { ...process.env, VITEST_MAX_WORKERS: process.env.VITEST_MAX_WORKERS ?? "4" },
});

const forward = (signal) => child.kill(signal);
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, () => forward(signal));

child.on("exit", (code, signal) => {
  release();
  process.exit(code ?? (signal === null ? 1 : 128));
});
child.on("error", (error) => {
  release();
  console.error(`heavy: ${error.message}`);
  process.exit(1);
});
