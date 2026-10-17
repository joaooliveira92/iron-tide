#!/usr/bin/env node
// Worktree coordinator for concurrent agents (ADR-0220).
//
// Several orchestrator sessions may run at once, each scoped to one `.scratch/<slug>`
// effort. They must never share a checkout — ADR-0165's incident was two agents in
// the same `dev` tree, one `git add -A` sweeping the other's work. So each effort
// gets a dedicated worktree under `.worktrees/<slug>` on a short-lived branch, and
// the set of live subtrees is tracked in `.ai/WORKTREES.md`.
//
// This tool owns that ledger and the worktree lifecycle:
//
//   new <slug>      create `.worktrees/<slug>` on a branch from `dev`, register it
//   list            live worktrees joined with the ledger, with drift warnings
//   sync            reconcile the ledger with actual git worktrees
//   prune           remove merged/gone/phantom subtrees and their ledger rows
//   remove <slug>   remove one subtree (refuses on uncommitted changes)
//
// `prune --check` reports without mutating (used by the preflight hygiene gate).
// Everything here reads git state only; no clock, RNG, network, or environment.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const REPO_ROOT = resolve(import.meta.dirname, "..");
export const WORKTREES_DIR = join(REPO_ROOT, ".worktrees");
export const LEDGER_PATH = join(REPO_ROOT, ".ai", "WORKTREES.md");
export const DEFAULT_BASE = "dev";
export const DEFAULT_BRANCH_PREFIX = "feat/";

const LEDGER_BEGIN = "<!-- worktrees:begin -->";
const LEDGER_END = "<!-- worktrees:end -->";
const COLUMNS = ["Slug", "Branch", "Scope", "Owner", "Status", "Base", "Created", "PR"];

/** Non-terminal subtree states. `prune` removes everything else. */
export const TERMINAL_STATES = new Set(["merged", "gone", "phantom"]);

function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

function gitOk(args) {
  try {
    git(args);
    return true;
  } catch {
    return false;
  }
}

/** Parse `git worktree list --porcelain` into `{ path, head, branch|null }`. */
export function parseWorktreeList(porcelain) {
  const entries = [];
  let current = null;
  for (const line of porcelain.split("\n")) {
    if (line.startsWith("worktree ")) {
      if (current) entries.push(current);
      current = { path: line.slice("worktree ".length), head: "", branch: null };
    } else if (current && line.startsWith("HEAD ")) {
      current.head = line.slice("HEAD ".length);
    } else if (current && line.startsWith("branch ")) {
      current.branch = line.slice("branch ".length).replace(/^refs\/heads\//u, "");
    } else if (line === "" && current) {
      entries.push(current);
      current = null;
    }
  }
  if (current) entries.push(current);
  return entries;
}

/** Rows of the generated ledger table, in file order. */
export function parseLedger(markdown) {
  const lines = markdown.split("\n");
  const begin = lines.findIndex((l) => l.trim() === LEDGER_BEGIN);
  const end = lines.findIndex((l) => l.trim() === LEDGER_END);
  if (begin === -1 || end === -1 || end < begin) return [];
  return lines
    .slice(begin + 1, end)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"))
    .map((line) =>
      line
        .slice(1, line.endsWith("|") ? -1 : line.length)
        .split("|")
        .map((cell) => cell.trim()),
    )
    .filter((cells) => cells.length === COLUMNS.length)
    .filter((cells) => !cells.every((c) => /^-+$/u.test(c)))
    .filter((cells) => cells[0] !== COLUMNS[0])
    .map((cells) => ({
      slug: cells[0],
      branch: cells[1],
      scope: cells[2],
      owner: cells[3],
      status: cells[4],
      base: cells[5],
      created: cells[6],
      pr: cells[7],
    }));
}

/** Render the marker-delimited ledger table `rows` replacing the old block. */
export function renderLedger(markdown, rows) {
  const cells = (row) => COLUMNS.map((c) => row[c.toLowerCase()] || "—");
  const table = [
    `| ${COLUMNS.join(" | ")} |`,
    `| ${COLUMNS.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${cells(row).join(" | ")} |`),
  ];
  const block = [LEDGER_BEGIN, ...table, LEDGER_END].join("\n");
  const begin = markdown.indexOf(LEDGER_BEGIN);
  const end = markdown.indexOf(LEDGER_END);
  if (begin === -1 || end === -1) return `${markdown.trimEnd()}\n\n${block}\n`;
  return `${markdown.slice(0, begin)}${block}${markdown.slice(end + LEDGER_END.length)}`;
}

export function readLedger() {
  if (!existsSync(LEDGER_PATH)) return [];
  return parseLedger(readFileSync(LEDGER_PATH, "utf8"));
}

export function writeLedger(rows) {
  const base = existsSync(LEDGER_PATH) ? readFileSync(LEDGER_PATH, "utf8") : "# Active worktrees\n";
  writeFileSync(LEDGER_PATH, renderLedger(base, rows));
}

function revParse(ref) {
  try {
    return git(["rev-parse", ref]).trim();
  } catch {
    return null;
  }
}

// A subtree is merged only once its base has advanced past its tip. A branch
// created moments ago is trivially an ancestor of its base but carries no work,
// so tip equality excludes it — otherwise every fresh subtree would read as
// prunable. (Squash-merged PRs are not detectable this way; prune those by name.)
function isBranchMerged(branch, base) {
  if (!gitOk(["merge-base", "--is-ancestor", branch, base])) return false;
  const tip = revParse(branch);
  const baseTip = revParse(base);
  return tip !== null && baseTip !== null && tip !== baseTip;
}

function branchExists(branch) {
  return gitOk(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]);
}

function isDirty(path) {
  try {
    const out = execFileSync("git", ["-C", path, "status", "--porcelain"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return out.trim().length > 0;
  } catch {
    return true;
  }
}

export function liveWorktrees() {
  const all = parseWorktreeList(git(["worktree", "list", "--porcelain"]));
  return all
    .map((entry) => ({ ...entry, slug: slugFromPath(entry.path) }))
    .filter((entry) => entry.slug !== null);
}

export function slugFromPath(path) {
  const normalized = path.replace(/\\/gu, "/").replace(/\/+$/u, "");
  const idx = normalized.lastIndexOf("/.worktrees/");
  if (idx === -1) return null;
  return normalized.slice(idx + "/.worktrees/".length) || null;
}

/** Classify one subtree for hygiene. Pure over the facts it is given. */
export function classifyWorktree({ pathExists, branchExists: branchLive, merged, dirty }) {
  if (!pathExists) return { state: "phantom", warnings: ["ledger row has no worktree on disk"] };
  if (branchLive === false) {
    return { state: "gone", warnings: ["worktree branch no longer exists"] };
  }
  if (merged) {
    const warnings = ["branch is merged into its base — prune it"];
    if (dirty) warnings.push("worktree has uncommitted changes; prune needs --force");
    return { state: "merged", warnings };
  }
  return { state: "active", warnings: [] };
}

/** Live git facts for a registry row, joined for `list`/`prune`. */
export function inspectRows(rows, { base = DEFAULT_BASE } = {}) {
  const live = new Map(liveWorktrees().map((w) => [w.slug, w]));
  return rows.map((row) => {
    const entry = live.get(row.slug);
    const pathExists = entry ? existsSync(entry.path) : false;
    const branchLive = entry ? branchExists(entry.branch) : false;
    const merged = entry && branchLive ? isBranchMerged(entry.branch, base) : false;
    const dirty = entry && pathExists ? isDirty(entry.path) : false;
    const { state, warnings } = classifyWorktree({
      pathExists,
      branchExists: entry ? branchLive : false,
      merged,
      dirty,
    });
    return { ...row, path: entry?.path, state, dirty, warnings };
  });
}

/** Registry rows for live worktrees that are absent from the ledger. */
export function unregisteredWorktrees(rows) {
  const known = new Set(rows.map((r) => r.slug));
  return liveWorktrees()
    .filter((w) => !known.has(w.slug))
    .map((w) => ({
      slug: w.slug,
      branch: w.branch || "detached",
      scope: `.scratch/${w.slug}`,
      owner: "unknown",
      status: "active",
      base: DEFAULT_BASE,
      created: "—",
      pr: "—",
    }));
}

function todayIso() {
  // Local date only — never authoritative; stamped for human coordination.
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

function cmdNew(args) {
  const [slug] = args;
  if (!slug || slug.startsWith("-")) {
    console.error(
      "usage: worktree.mjs new <slug> [--branch <name>] [--base <ref>] [--owner <role>]",
    );
    process.exitCode = 1;
    return;
  }
  const flag = (name, fallback) => {
    const i = args.indexOf(`--${name}`);
    return i === -1 ? fallback : args[i + 1];
  };
  const branch = flag("branch", `${DEFAULT_BRANCH_PREFIX}${slug}`);
  const base = flag("base", DEFAULT_BASE);
  const owner = flag("owner", "orchestrator");
  const path = join(WORKTREES_DIR, slug);

  const rows = readLedger();
  if (rows.some((r) => r.slug === slug)) {
    console.error(`worktree "${slug}" is already registered in the ledger`);
    process.exitCode = 1;
    return;
  }
  if (existsSync(path)) {
    console.error(`path already exists: ${path}`);
    process.exitCode = 1;
    return;
  }
  if (branchExists(branch)) {
    console.error(`branch already exists: ${branch} (pass --branch to pick another)`);
    process.exitCode = 1;
    return;
  }

  mkdirSync(WORKTREES_DIR, { recursive: true });
  git(["worktree", "add", "-b", branch, path, base]);
  rows.push({
    slug,
    branch,
    scope: `.scratch/${slug}`,
    owner,
    status: "active",
    base,
    created: todayIso(),
    pr: "—",
  });
  writeLedger(rows);
  console.log(`created ${path} on ${branch} (base ${base})`);
  console.log(`next: work this subtree's frontier with ".opencode/command/work.md ${path}"`);
}

function cmdList(args) {
  const rows = readLedger();
  const inspected = inspectRows(rows);
  const extra = unregisteredWorktrees(rows);
  if (args.includes("--json")) {
    console.log(JSON.stringify({ registered: inspected, unregistered: extra }, null, 2));
    return;
  }
  if (inspected.length === 0 && extra.length === 0) {
    console.log("no active subtrees registered (.ai/WORKTREES.md)");
    return;
  }
  for (const r of inspected) {
    const flag = r.warnings.length ? `  ⚠ ${r.warnings.join("; ")}` : "";
    console.log(`${r.slug}\t${r.branch}\t${r.state}\t${r.scope}${flag}`);
  }
  for (const r of extra) {
    console.log(`${r.slug}\t${r.branch}\tunregistered\t${r.scope}  ⚠ run "worktree.mjs sync"`);
  }
}

function cmdSync() {
  const rows = readLedger();
  const live = liveWorktrees();
  const liveSlugs = new Set(live.map((w) => w.slug));
  const kept = rows.filter((r) => liveSlugs.has(r.slug));
  const dropped = rows.filter((r) => !liveSlugs.has(r.slug)).map((r) => r.slug);
  const added = unregisteredWorktrees(rows);
  writeLedger([...kept, ...added]);
  console.log(`ledger reconciled: +${added.length}, -${dropped.length}, =${kept.length}`);
  if (added.length) console.log(`  registered: ${added.map((r) => r.slug).join(", ")}`);
  if (dropped.length) console.log(`  dropped: ${dropped.map((s) => s).join(", ")}`);
}

function removeWorktree(row, { force }) {
  if (row.path && existsSync(row.path)) {
    if (row.dirty && !force) return `skipped ${row.slug}: uncommitted changes (use --force)`;
    git(["worktree", "remove", ...(force ? ["--force"] : []), row.path]);
  }
  if (row.state === "merged" || !branchExists(row.branch)) {
    if (branchExists(row.branch)) git(["branch", "-D", row.branch]);
  }
  return `removed ${row.slug} (${row.state})`;
}

function cmdPrune(args) {
  const check = args.includes("--check");
  const force = args.includes("--force");
  const rows = readLedger();
  const inspected = inspectRows(rows);
  const keep = [];
  const lines = [];
  let stale = 0;
  for (const row of inspected) {
    if (TERMINAL_STATES.has(row.state)) {
      stale += 1;
      if (check) {
        lines.push(`stale ${row.slug} (${row.state}): ${row.warnings[0] ?? "prune it"}`);
      } else {
        lines.push(removeWorktree(row, { force }));
      }
    } else {
      keep.push(row);
      if (row.warnings.length) lines.push(`warn ${row.slug}: ${row.warnings.join("; ")}`);
    }
  }
  if (!check) {
    writeLedger(
      keep.map((r) => ({
        slug: r.slug,
        branch: r.branch,
        scope: r.scope,
        owner: r.owner,
        status: r.status,
        base: r.base,
        created: r.created,
        pr: r.pr,
      })),
    );
  }
  for (const line of lines) console.log(line);
  if (check) {
    console.log(
      stale === 0
        ? "worktrees: clean"
        : "worktrees: stale subtrees present — run `pnpm worktrees:prune`",
    );
  } else {
    console.log(`pruned ${stale} subtree(s); ${keep.length} active`);
  }
}

function cmdRemove(args) {
  const [slug] = args;
  const force = args.includes("--force");
  if (!slug || slug.startsWith("-")) {
    console.error("usage: worktree.mjs remove <slug> [--force]");
    process.exitCode = 1;
    return;
  }
  const rows = readLedger();
  const inspected = inspectRows(rows).find((r) => r.slug === slug);
  if (!inspected) {
    console.error(`no registered subtree "${slug}"`);
    process.exitCode = 1;
    return;
  }
  const message = removeWorktree(inspected, { force });
  if (message.startsWith("skipped")) {
    console.error(message);
    process.exitCode = 1;
    return;
  }
  writeLedger(rows.filter((r) => r.slug !== slug));
  console.log(message);
}

function main() {
  const [command, ...args] = process.argv.slice(2);
  switch (command) {
    case "new":
      cmdNew(args);
      break;
    case "list":
      cmdList(args);
      break;
    case "sync":
      cmdSync();
      break;
    case "prune":
      cmdPrune(args);
      break;
    case "remove":
      cmdRemove(args);
      break;
    default:
      console.log(
        "usage: worktree.mjs <new <slug>|list|sync|prune [--check]|remove <slug>> [--json|--force]",
      );
      process.exitCode = command ? 1 : 0;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
