import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const DEFAULT_POLL_MS = 3000;
export const DEFAULT_STALE_MS = 10_000;

export function defaultLockDir() {
  const root = process.platform === "win32" ? tmpdir() : "/tmp";
  return join(root, "bluewave-heavy.lock");
}

function readHolder(lockDir) {
  try {
    const pid = Number(readFileSync(join(lockDir, "pid"), "utf8").trim());
    if (!Number.isInteger(pid) || pid <= 0) return undefined;
    let command = "";
    try {
      command = readFileSync(join(lockDir, "cmd"), "utf8").trim();
    } catch {
      command = "";
    }
    return { pid, command };
  } catch {
    return undefined;
  }
}

function lockAgeMs(lockDir) {
  try {
    return Date.now() - statSync(lockDir).mtimeMs;
  } catch {
    return 0;
  }
}

export async function acquireHeavyLock({
  lockDir,
  pid,
  command,
  isAlive,
  ancestorPids,
  wait,
  onWait,
  staleMs = DEFAULT_STALE_MS,
}) {
  let announced = false;
  for (;;) {
    try {
      mkdirSync(lockDir);
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
    const holder = readHolder(lockDir);
    if (holder !== undefined && ancestorPids.includes(holder.pid)) return () => {};
    const abandoned = holder === undefined ? lockAgeMs(lockDir) > staleMs : !isAlive(holder.pid);
    if (abandoned) {
      rmSync(lockDir, { recursive: true, force: true });
      continue;
    }
    if (!announced) {
      announced = true;
      onWait(holder);
    }
    await wait();
  }
  writeFileSync(join(lockDir, "pid"), String(pid));
  writeFileSync(join(lockDir, "cmd"), command);
  return () => rmSync(lockDir, { recursive: true, force: true });
}

export function loadWarning({ load, cores }) {
  if (load <= cores) return undefined;
  return `heavy: load average ${load.toFixed(1)} on ${String(cores)} cores; a test timeout in this run is environmental, not a code failure`;
}

export function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

export function ancestorPidsOf(pid) {
  if (process.platform === "win32") return [];
  const found = [];
  let current = pid;
  for (let depth = 0; depth < 64; depth++) {
    let parent;
    try {
      parent = Number(
        execFileSync("ps", ["-o", "ppid=", "-p", String(current)], { encoding: "utf8" }).trim(),
      );
    } catch {
      break;
    }
    if (!Number.isInteger(parent) || parent <= 1) break;
    found.push(parent);
    current = parent;
  }
  return found;
}
