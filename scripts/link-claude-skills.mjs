#!/usr/bin/env node
// Keep `.claude/skills/<name>` symlinked to `.agents/skills/<name>`.
//
// The repo's canonical skills live under `.agents/skills/` (the shared
// opencode / mattpocock convention), but Claude Code only discovers skills in
// `.claude/skills/`. One symlink per skill bridges the two. `.claude/` is
// gitignored, so those links are local-only and vanish on a fresh checkout or a
// `.claude/` cleanup — this script recreates them. It is idempotent (safe to run
// on every install and every preflight) and never clobbers a real file/dir (so
// the force-tracked `.claude/skills/resolving-merge-conflicts` copy stays put).
//
// Wired into `prepare` (a normal `pnpm install`) and the `preflight` gate set.
// Runnable directly; `--check` verifies without modifying.

import { lstatSync, mkdirSync, readdirSync, readlinkSync, rmSync, symlinkSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const AGENTS_SKILLS = ".agents/skills";
const CLAUDE_SKILLS = ".claude/skills";

/**
 * @typedef {{ created: string[], repaired: string[], present: string[], skipped: string[], missing: string[] }} SyncResult
 */

/**
 * Reconcile `.claude/skills` links with the skills under `.agents/skills`.
 * @param {{ root?: string, agentsDir?: string, claudeDir?: string, check?: boolean }} [options]
 * @returns {SyncResult}
 */
export function syncSkillLinks(options = {}) {
  const root = options.root ?? ROOT;
  const agentsDir = resolve(root, options.agentsDir ?? AGENTS_SKILLS);
  const claudeDir = resolve(root, options.claudeDir ?? CLAUDE_SKILLS);
  const check = options.check ?? false;

  /** @type {SyncResult} */
  const result = { created: [], repaired: [], present: [], skipped: [], missing: [] };

  let names;
  try {
    names = readdirSync(agentsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return result; // no `.agents/skills` — nothing to reconcile
  }

  if (!check) mkdirSync(claudeDir, { recursive: true });

  for (const name of names) {
    const linkPath = join(claudeDir, name);
    // Compare separator-agnostically: the target is written POSIX-style so the
    // link is identical on every OS, but Windows `readlink` normalizes it back to
    // backslashes, so the raw strings differ by platform.
    const expectedTarget = relative(claudeDir, join(agentsDir, name)).split(sep).join("/");
    const toPosix = (p) => p.split(sep).join("/");

    let stats;
    try {
      stats = lstatSync(linkPath);
    } catch {
      stats = undefined;
    }

    if (stats === undefined) {
      if (check) result.missing.push(name);
      else {
        symlinkSync(expectedTarget, linkPath);
        result.created.push(name);
      }
      continue;
    }

    if (!stats.isSymbolicLink()) {
      // A real file/dir (e.g. the tracked resolving-merge-conflicts copy): leave it alone.
      result.skipped.push(name);
      continue;
    }

    if (toPosix(readlinkSync(linkPath)) === expectedTarget) {
      result.present.push(name);
      continue;
    }

    if (check) {
      result.missing.push(name);
      continue;
    }
    rmSync(linkPath);
    symlinkSync(expectedTarget, linkPath);
    result.repaired.push(name);
  }

  return result;
}

function summarise(result) {
  const parts = [`${result.present.length} present`];
  if (result.created.length > 0) parts.push(`${result.created.length} created`);
  if (result.repaired.length > 0) parts.push(`${result.repaired.length} repaired`);
  if (result.skipped.length > 0) parts.push(`${result.skipped.length} skipped`);
  if (result.missing.length > 0) parts.push(`${result.missing.length} missing`);
  return parts.join(", ");
}

export function main(argv = process.argv.slice(2)) {
  const check = argv.includes("--check");
  const result = syncSkillLinks({ check });

  if (check && result.missing.length > 0) {
    process.stderr.write(
      `link-claude-skills: ${result.missing.length} skill link(s) missing or stale: ` +
        `${result.missing.join(", ")}\n` +
        "  run `node scripts/link-claude-skills.mjs` (or `pnpm install`) to recreate them\n",
    );
    return 1;
  }

  process.stdout.write(`link-claude-skills: ${summarise(result)}\n`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  process.exitCode = main();
}
