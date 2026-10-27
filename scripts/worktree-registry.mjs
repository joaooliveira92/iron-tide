#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

export const REGISTRY_SCHEMA_VERSION = 1;
export const REGISTRY_FIELDS = [
  "slug",
  "branch",
  "scope",
  "owner",
  "status",
  "base",
  "created",
  "pr",
  "path",
];
export const DEFAULT_LOCK_TIMEOUT_MS = 5_000;
export const LOCK_STALE_MS = 60_000;

const LOCK_RETRY_DELAY_MS = 25;

export class WorktreeRegistryError extends Error {
  constructor(code, message, context = {}) {
    super(message);
    this.name = "WorktreeRegistryError";
    this.code = code;
    this.context = context;
  }
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function resolveCommonDir(cwd = process.cwd()) {
  try {
    return execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    throw new WorktreeRegistryError(
      "WORKTREE_REGISTRY_NO_GIT",
      `cannot resolve the Git common directory: ${String(error.message).split("\n")[0]}`,
    );
  }
}

export function registryPathFor(commonDir) {
  return join(resolve(commonDir), "ai", "worktrees.json");
}

export function registryPath(cwd = process.cwd()) {
  return registryPathFor(resolveCommonDir(cwd));
}

export function lockPathFor(path) {
  return `${path}.lock`;
}

export function normalizePath(path) {
  return resolve(path).replace(/\\/gu, "/");
}

function requireString(value, field, index) {
  if (typeof value !== "string" || value.length === 0) {
    throw new WorktreeRegistryError(
      "WORKTREE_REGISTRY_CORRUPT",
      `rows[${index}].${field} must be a non-empty string`,
      { path: field, index },
    );
  }
  return value;
}

export function validateRegistryRow(row, index) {
  if (typeof row !== "object" || row === null || Array.isArray(row)) {
    throw new WorktreeRegistryError(
      "WORKTREE_REGISTRY_CORRUPT",
      `rows[${index}] must be an object`,
      { index },
    );
  }
  const unknown = Object.keys(row).filter((key) => !REGISTRY_FIELDS.includes(key));
  if (unknown.length > 0) {
    throw new WorktreeRegistryError(
      "WORKTREE_REGISTRY_CORRUPT",
      `rows[${index}] has unknown field(s): ${unknown.join(", ")}`,
      { index, fields: unknown },
    );
  }
  const path = requireString(row.path, "path", index);
  if (!isAbsolute(path)) {
    throw new WorktreeRegistryError(
      "WORKTREE_REGISTRY_CORRUPT",
      `rows[${index}].path must be absolute`,
      { index, path },
    );
  }
  return {
    slug: requireString(row.slug, "slug", index),
    branch: requireString(row.branch, "branch", index),
    scope: requireString(row.scope, "scope", index),
    owner: requireString(row.owner, "owner", index),
    status: requireString(row.status, "status", index),
    base: requireString(row.base, "base", index),
    created: requireString(row.created, "created", index),
    pr: requireString(row.pr, "pr", index),
    path: normalizePath(path),
  };
}

export function canonicalizeRows(rows) {
  const seen = new Set();
  const canonical = rows.map((row, index) => {
    const validated = validateRegistryRow(row, index);
    if (seen.has(validated.slug)) {
      throw new WorktreeRegistryError(
        "WORKTREE_REGISTRY_CORRUPT",
        `duplicate slug "${validated.slug}"`,
        { slug: validated.slug },
      );
    }
    seen.add(validated.slug);
    return validated;
  });
  canonical.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  return canonical;
}

export function decodeRegistry(parsed) {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new WorktreeRegistryError("WORKTREE_REGISTRY_CORRUPT", "registry must be a JSON object");
  }
  if (parsed.schemaVersion !== REGISTRY_SCHEMA_VERSION) {
    throw new WorktreeRegistryError(
      "WORKTREE_REGISTRY_UNSUPPORTED",
      `unsupported registry schemaVersion ${String(parsed.schemaVersion)}; expected ${REGISTRY_SCHEMA_VERSION}`,
      { schemaVersion: parsed.schemaVersion },
    );
  }
  const unknown = Object.keys(parsed).filter((key) => !["schemaVersion", "rows"].includes(key));
  if (unknown.length > 0) {
    throw new WorktreeRegistryError(
      "WORKTREE_REGISTRY_CORRUPT",
      `registry has unknown field(s): ${unknown.join(", ")}`,
      { fields: unknown },
    );
  }
  if (!Array.isArray(parsed.rows)) {
    throw new WorktreeRegistryError("WORKTREE_REGISTRY_CORRUPT", "registry.rows must be an array");
  }
  return { schemaVersion: REGISTRY_SCHEMA_VERSION, rows: canonicalizeRows(parsed.rows) };
}

export function serializeRegistry(rows) {
  return `${JSON.stringify(
    { schemaVersion: REGISTRY_SCHEMA_VERSION, rows: canonicalizeRows(rows) },
    null,
    2,
  )}\n`;
}

export function readRegistryFile(path = registryPath()) {
  if (!existsSync(path)) return null;
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch (error) {
    throw new WorktreeRegistryError(
      "WORKTREE_REGISTRY_UNREADABLE",
      `cannot read ${path}: ${String(error.message).split("\n")[0]}`,
      { path },
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new WorktreeRegistryError(
      "WORKTREE_REGISTRY_CORRUPT",
      `${path} is not valid JSON: ${String(error.message).split("\n")[0]}; refusing to overwrite it`,
      { path },
    );
  }
  return decodeRegistry(parsed);
}

function writeFileAtomic(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${Date.now().toString(36)}.tmp`;
  const descriptor = openSync(temporary, "wx", 0o600);
  try {
    writeSync(descriptor, content);
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  try {
    renameSync(temporary, path);
  } catch (error) {
    try {
      unlinkSync(temporary);
    } catch {
      // The rename failed; the temp file may already be gone.
    }
    throw error;
  }
}

export function writeRegistryFile(rows, path = registryPath()) {
  writeFileAtomic(path, serializeRegistry(rows));
}

function removeStaleLock(lock) {
  try {
    if (Date.now() - statSync(lock).mtimeMs > LOCK_STALE_MS) {
      unlinkSync(lock);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export function acquireRegistryLock(
  path = registryPath(),
  { timeoutMs = DEFAULT_LOCK_TIMEOUT_MS } = {},
) {
  const lock = lockPathFor(path);
  mkdirSync(dirname(lock), { recursive: true });
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const descriptor = openSync(lock, "wx", 0o600);
      try {
        writeSync(descriptor, `${process.pid}\n`);
      } finally {
        closeSync(descriptor);
      }
      return () => {
        try {
          unlinkSync(lock);
        } catch {
          // A concurrent stale-lock sweep may have removed it.
        }
      };
    } catch (error) {
      if (error.code !== "EEXIST") {
        throw new WorktreeRegistryError(
          "WORKTREE_REGISTRY_LOCK_FAILED",
          `cannot lock ${path}: ${String(error.message).split("\n")[0]}`,
          { path },
        );
      }
      if (removeStaleLock(lock)) continue;
      if (Date.now() >= deadline) {
        throw new WorktreeRegistryError(
          "WORKTREE_REGISTRY_LOCKED",
          `${path} is locked by another worktree command; retry after it finishes`,
          { path, lock },
        );
      }
      sleep(LOCK_RETRY_DELAY_MS);
    }
  }
}

export function withRegistryLock(fn, path = registryPath()) {
  const release = acquireRegistryLock(path);
  try {
    return fn();
  } finally {
    release();
  }
}

export function updateRegistry(mutator, path = registryPath()) {
  return withRegistryLock(() => {
    const current = readRegistryFile(path);
    const rows = current?.rows ?? [];
    const next = mutator(rows);
    if (next === undefined) return rows;
    writeRegistryFile(next, path);
    return next;
  }, path);
}
