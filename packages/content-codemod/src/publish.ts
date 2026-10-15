/**
 * Atomic staging publication (ship-part-model ticket 11c).
 *
 * A whole tree is written into a sibling temporary directory and then renamed into place, so a
 * failed or interrupted run never leaves a partially valid output tree: the destination is
 * either its previous state or the complete new tree. Temporary files are removed in every
 * path, and the destination may be refused (`"error"`) or republished (`"replace"`) when it
 * already exists — `"replace"` is a no-op when the existing tree has the same content hash, so
 * re-running the writer against its own result produces no diff.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { migrationFailure } from "./failure.js";
import type { MigrationResult } from "./failure.js";
import { validateStagingDir } from "./paths.js";
import type { MigrationPlan } from "./types.js";

const TMP_SUFFIX = ".codemod-tmp";
const BACKUP_SUFFIX = ".codemod-old";

export interface PublishOptions {
  readonly stagingDir: string;
  readonly protectedRoots?: readonly string[];
  /** `"error"` (default) refuses an existing destination; `"replace"` republishes it. */
  readonly ifExists?: "error" | "replace";
}

export interface PublishResult {
  readonly stagingDir: string;
  readonly files: number;
  /** True when the destination already held this exact content and nothing was written. */
  readonly noop: boolean;
}

const ioFailure = (path: string, error: unknown): MigrationResult<PublishResult> => ({
  ok: false,
  failures: [
    migrationFailure(
      "CODEMOD_IO_FAILURE",
      path,
      error instanceof Error ? error.message : String(error),
    ),
  ],
});

/** Whether `stagingDir` already holds exactly the plan's files and bytes, and nothing else. */
function treeMatches(stagingDir: string, plan: MigrationPlan): boolean {
  const expected = new Map(
    [...plan.files, plan.manifestFile].map((file) => [file.path, file.content]),
  );
  let seen = 0;
  const walk = (current: string, prefix: string): boolean => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absolute = join(current, entry.name);
      const rel = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isDirectory()) {
        if (!walk(absolute, rel)) return false;
      } else if (entry.isFile()) {
        const content = expected.get(rel);
        if (content === undefined || readFileSync(absolute, "utf8") !== content) return false;
        seen += 1;
      } else {
        return false;
      }
    }
    return true;
  };
  try {
    return walk(stagingDir, "") && seen === expected.size;
  } catch {
    return false;
  }
}

/** Publish a planned migration to an explicit staging directory, atomically. */
export function publishMigration(
  plan: MigrationPlan,
  options: PublishOptions,
): MigrationResult<PublishResult> {
  const checked = validateStagingDir({
    stagingDir: options.stagingDir,
    protectedRoots: options.protectedRoots,
  });
  if (!checked.ok) return checked;
  const stagingDir = checked.value;
  const ifExists = options.ifExists ?? "error";
  const existed = existsSync(stagingDir);
  if (existed) {
    if (ifExists === "error") {
      return {
        ok: false,
        failures: [
          migrationFailure(
            "CODEMOD_EXISTING_OUTPUT",
            stagingDir,
            "the staging directory already exists; pass ifExists:'replace' to republish.",
          ),
        ],
      };
    }
    if (treeMatches(stagingDir, plan)) {
      return { ok: true, value: { stagingDir, files: 0, noop: true } };
    }
  }

  const tmpDir = `${stagingDir}${TMP_SUFFIX}`;
  const backupDir = `${stagingDir}${BACKUP_SUFFIX}`;
  const all = [...plan.files, plan.manifestFile];
  try {
    rmSync(tmpDir, { recursive: true, force: true });
    rmSync(backupDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
    for (const file of all) {
      const dest = join(tmpDir, file.path);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, file.content, "utf8");
    }
    if (existed) renameSync(stagingDir, backupDir);
    try {
      renameSync(tmpDir, stagingDir);
    } catch (error) {
      if (existed && existsSync(backupDir) && !existsSync(stagingDir)) {
        renameSync(backupDir, stagingDir);
      }
      throw error;
    }
    rmSync(backupDir, { recursive: true, force: true });
    return { ok: true, value: { stagingDir, files: all.length, noop: false } };
  } catch (error) {
    rmSync(tmpDir, { recursive: true, force: true });
    return ioFailure(stagingDir, error);
  }
}
