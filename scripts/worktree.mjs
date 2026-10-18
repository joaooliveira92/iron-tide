#!/usr/bin/env node
// Worktree coordinator for concurrent agents (ADR-0220).
//
// Several orchestrator sessions may run at once, each scoped to one effort `<slug>`
// (a wayfinder map or spec issue on the tracker). They must never share a checkout — ADR-0165's incident was two agents in
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
//   audit           read-only inventory + reconciliation of worktrees, branches,
//                   remotes, the ledger, and (via `gh`) merged pull requests
//
// `prune --check` reports without mutating (used by the preflight hygiene gate).
// Arguments are parsed and validated in full before any command touches git or
// the ledger: an unknown option fails closed with exit 2 and changes nothing.
// Everything here reads git state only (plus `gh pr list` for `audit`); no
// clock, RNG, or environment.

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

/**
 * The ref a branch is measured against. Prefer the remote-tracking base so a
 * merge only counts once it has reached the shared branch; fall back to the
 * local base for repositories without a remote.
 */
export function resolveBaseRef(base = DEFAULT_BASE) {
  return gitOk(["show-ref", "--verify", "--quiet", `refs/remotes/origin/${base}`])
    ? `origin/${base}`
    : base;
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
// prunable. (Squash-merged PRs are not detectable this way; `audit` finds them
// through `gh`, and they are removed explicitly with `worktrees remove`.)
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
export function classifyWorktree({
  pathExists,
  branchExists: branchLive,
  merged,
  dirty,
  detached = false,
}) {
  if (!pathExists) return { state: "phantom", warnings: ["ledger row has no worktree on disk"] };
  // A detached HEAD has no branch to test, so it can carry unreferenced commits;
  // never treat it as prunable.
  if (detached) {
    return {
      state: "detached",
      warnings: ["detached HEAD — not auto-pruned; check out a branch or remove it explicitly"],
    };
  }
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
  const baseRef = resolveBaseRef(base);
  return rows.map((row) => {
    const entry = live.get(row.slug);
    const pathExists = entry ? existsSync(entry.path) : false;
    const detached = entry ? entry.branch === null : false;
    const branchLive = entry && !detached ? branchExists(entry.branch) : false;
    const merged = entry && branchLive ? isBranchMerged(entry.branch, baseRef) : false;
    const dirty = entry && pathExists ? isDirty(entry.path) : false;
    const { state, warnings } = classifyWorktree({
      pathExists,
      branchExists: entry ? (detached ? true : branchLive) : false,
      detached,
      merged,
      dirty,
    });
    return {
      ...row,
      path: entry?.path,
      branch: entry?.branch ?? row.branch,
      state,
      dirty,
      warnings,
    };
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
      scope: w.slug,
      owner: "unknown",
      status: "active",
      base: DEFAULT_BASE,
      created: "—",
      pr: "—",
    }));
}

/**
 * Every subtree hygiene commands act on: the ledger rows plus live worktrees the
 * ledger does not know about. Pruning only the ledger left an unregistered merged
 * worktree invisible to `prune`, so it lingered until someone noticed.
 */
function hygieneRows() {
  const ledger = readLedger();
  return [
    ...ledger.map((row) => ({ ...row, registered: true })),
    ...unregisteredWorktrees(ledger).map((row) => ({ ...row, registered: false })),
  ];
}

const LEDGER_FIELDS = ["slug", "branch", "scope", "owner", "status", "base", "created", "pr"];
const ledgerRow = (row) => Object.fromEntries(LEDGER_FIELDS.map((f) => [f, row[f]]));

// --- audit -------------------------------------------------------------------

const BASE_BRANCH_NAMES = ["master", "main"];

/** Index of merged pull requests from `gh pr list --state merged --json …`. */
export function parsePullRequests(json) {
  const merged = new Map();
  for (const pr of JSON.parse(json)) {
    const tips = merged.get(pr.headRefName) ?? new Set();
    tips.add(pr.headRefOid);
    merged.set(pr.headRefName, tips);
  }
  return { isMerged: (name, tip) => merged.get(name)?.has(tip) ?? false };
}

/**
 * Integration status of a ref relative to the base. `gone` (upstream deleted)
 * is reported only when the work is *not* integrated: a deleted remote on a
 * merged branch is just housekeeping, while on an unmerged one it is at risk.
 */
function classifyIntegration(branch, { baseTip }, baseNames) {
  if (baseNames.has(branch.name)) return "base";
  if (branch.ancestor) return branch.tip === baseTip ? "fresh" : "merged";
  if (branch.prMerged) return "merged-by-PR";
  if (branch.upstream === "gone") return "gone";
  return "open-unmerged";
}

const STALE = new Set(["merged", "merged-by-PR", "gone"]);
const compareText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const byText = (key) => (a, b) => compareText(a[key], b[key]);

/**
 * Pure reconciliation of collected git/ledger/PR facts. Integration status and
 * cleanliness are separate fields: a dirty worktree is never relabelled, and
 * dirtiness alone is not drift. Open unmerged branches are legitimate work and
 * never drift either.
 */
export function buildAudit(facts) {
  const baseNames = new Set([facts.base, ...BASE_BRANCH_NAMES]);
  const branches = facts.branches
    .map((b) => ({
      name: b.name,
      tip: b.tip,
      integration: classifyIntegration(b, facts, baseNames),
      unique: b.unique,
      remote: b.upstream,
    }))
    .sort(byText("name"));
  const branchByName = new Map(branches.map((b) => [b.name, b]));
  const ledgerBySlug = new Map(facts.ledger.map((r) => [r.slug, r]));
  const drift = [];
  const prunable = new Set();
  const flag = (code, subject, detail, action) => drift.push({ code, subject, detail, action });

  const worktrees = facts.worktrees.map((w, index) => {
    const slug = index === 0 ? null : slugFromPath(w.path);
    const location = index === 0 ? "primary" : slug === null ? "outside" : ".worktrees";
    const exists = w.exists !== false;
    const detached = w.branch === null;
    const b = detached ? null : branchByName.get(w.branch);
    const row = slug === null ? undefined : ledgerBySlug.get(slug);
    const item = {
      path: w.path,
      slug,
      location,
      branch: w.branch,
      integration: detached ? "detached" : (b?.integration ?? "missing"),
      unique: b?.unique ?? null,
      dirty: w.dirty,
      registered: index === 0 ? null : row !== undefined,
    };
    if (index === 0 || !exists) return item;
    const subject = slug ?? w.path;
    if (location === "outside") {
      flag(
        "worktree-outside",
        subject,
        "worktree is outside .worktrees/",
        "git worktree remove it, or recreate with `pnpm worktrees new`",
      );
    }
    if (detached) {
      flag(
        "worktree-detached",
        subject,
        "detached HEAD",
        "check out a branch or remove the worktree",
      );
    } else if (STALE.has(item.integration)) {
      const dirty = w.dirty ? " (uncommitted changes: needs --force)" : "";
      flag(
        "worktree-stale",
        subject,
        `branch ${w.branch} is ${item.integration}${dirty}`,
        "pnpm worktrees remove " + (slug ?? "<slug>"),
      );
      if (slug !== null && item.integration === "merged") prunable.add(slug);
    }
    if (slug !== null && row === undefined) {
      flag(
        "worktree-unregistered",
        subject,
        "worktree is absent from .ai/WORKTREES.md",
        "pnpm worktrees sync",
      );
    } else if (row !== undefined && !detached && row.branch !== w.branch) {
      flag(
        "ledger-branch-mismatch",
        subject,
        `ledger says ${row.branch}, worktree has ${w.branch}`,
        "fix the ledger row or the checkout",
      );
    }
    return item;
  });
  worktrees.sort(byText("path"));

  const liveSlugs = new Set(
    facts.worktrees
      .slice(1)
      .filter((w) => w.exists !== false)
      .map((w) => slugFromPath(w.path)),
  );
  for (const row of facts.ledger) {
    if (!liveSlugs.has(row.slug)) {
      flag("ledger-phantom", row.slug, "ledger row has no worktree", "pnpm worktrees:prune");
      prunable.add(row.slug);
    }
  }

  const checkedOut = new Set(facts.worktrees.map((w) => w.branch));
  for (const b of branches) {
    if (checkedOut.has(b.name)) continue;
    if (b.integration === "merged" || b.integration === "merged-by-PR") {
      flag(
        "branch-stale",
        b.name,
        `branch is ${b.integration} and has no worktree`,
        `git branch -D ${b.name}`,
      );
    } else if (b.integration === "gone") {
      flag(
        "branch-gone",
        b.name,
        `upstream deleted with ${b.unique} unintegrated commit(s)`,
        "push it, open a PR, or delete it deliberately",
      );
    }
  }

  const remotes = facts.remotes
    .map((r) => ({
      name: r.name,
      tip: r.tip,
      integration: classifyIntegration(
        { ...r, name: r.name.replace(/^origin\//u, ""), upstream: "present" },
        facts,
        baseNames,
      ),
      unique: r.unique,
      local: branchByName.has(r.name.replace(/^origin\//u, "")),
    }))
    .sort(byText("name"));

  const warnings = [];
  if (facts.prLookup !== "ok") {
    warnings.push("pull-request lookup skipped: squash-merged branches are not detected");
  }
  drift.sort((a, b) => byText("code")(a, b) || byText("subject")(a, b));
  return {
    schema: 1,
    base: facts.baseRef,
    ok: drift.length === 0,
    worktrees,
    branches,
    remotes,
    ledger: facts.ledger.map((r) => ({
      slug: r.slug,
      branch: r.branch,
      worktree: liveSlugs.has(r.slug),
    })),
    prunable: [...prunable].sort(compareText),
    drift,
    warnings,
  };
}

class AuditToolError extends Error {}

function readMergedPullRequests() {
  try {
    const json = execFileSync(
      "gh",
      [
        "pr",
        "list",
        "--state",
        "merged",
        "--limit",
        "1000",
        "--json",
        "number,headRefName,headRefOid",
      ],
      { cwd: REPO_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    return parsePullRequests(json);
  } catch (error) {
    const detail = String(error.stderr || error.message)
      .trim()
      .split("\n")[0];
    throw new AuditToolError(
      `cannot read merged pull requests via gh (${detail}); pass --no-gh to audit without them`,
    );
  }
}

/** Collect the facts `buildAudit` reconciles. Read-only. */
export function collectFacts({ gh }) {
  const base = DEFAULT_BASE;
  const baseRef = resolveBaseRef(base);
  const prs = gh ? readMergedPullRequests() : null;
  const measure = (name, tip) => ({
    ancestor: gitOk(["merge-base", "--is-ancestor", tip, baseRef]),
    unique: Number(git(["rev-list", "--count", `${baseRef}..${tip}`]).trim()),
    prMerged: prs ? prs.isMerged(name, tip) : false,
  });
  const refs = (namespace, format) =>
    git(["for-each-ref", `--format=${format}`, namespace])
      .split("\n")
      .filter(Boolean)
      .map((line) => line.split("\t"));

  const branches = refs(
    "refs/heads",
    "%(refname:short)%09%(objectname)%09%(upstream)%09%(upstream:track)",
  ).map(([name, tip, upstream, track]) => ({
    name,
    tip,
    upstream: track.includes("gone") ? "gone" : upstream === "" ? "none" : "present",
    ...measure(name, tip),
  }));
  const remotes = refs("refs/remotes/origin", "%(refname:short)%09%(objectname)")
    .filter(([name]) => name !== "origin" && name !== "origin/HEAD")
    .map(([name, tip]) => ({ name, tip, ...measure(name.replace(/^origin\//u, ""), tip) }));
  const worktrees = parseWorktreeList(git(["worktree", "list", "--porcelain"])).map((w) => {
    const exists = existsSync(w.path);
    return { ...w, exists, dirty: exists ? isDirty(w.path) : false };
  });
  return {
    base,
    baseRef,
    baseTip: revParse(baseRef),
    repoRoot: REPO_ROOT,
    worktrees,
    branches,
    remotes,
    ledger: readLedger(),
    prLookup: gh ? "ok" : "skipped",
  };
}

function formatAudit(audit) {
  const cell = (value) => (value === null || value === undefined ? "-" : String(value));
  const lines = [`audit against ${audit.base}`, "", "worktrees"];
  for (const w of audit.worktrees) {
    lines.push(
      `  ${w.location}\t${cell(w.slug ?? w.path)}\t${cell(w.branch)}\t${w.integration}\tunique=${cell(w.unique)}\t${w.dirty ? "dirty" : "clean"}\tregistered=${cell(w.registered)}`,
    );
  }
  lines.push("", "branches");
  for (const b of audit.branches) {
    lines.push(`  ${b.name}\t${b.integration}\tunique=${b.unique}\tremote=${b.remote}`);
  }
  lines.push("", "remote branches");
  for (const r of audit.remotes) {
    lines.push(`  ${r.name}\t${r.integration}\tunique=${r.unique}\tlocal=${r.local}`);
  }
  lines.push(
    "",
    `ledger rows: ${audit.ledger.length}; auto-prunable: ${audit.prunable.join(", ") || "none"}`,
  );
  for (const w of audit.warnings) lines.push(`warning: ${w}`);
  lines.push("", audit.ok ? "drift: none" : `drift: ${audit.drift.length}`);
  for (const d of audit.drift) lines.push(`  ${d.code}\t${d.subject}\t${d.detail}\t-> ${d.action}`);
  return lines.join("\n");
}

function cmdAudit({ flags }) {
  let audit;
  try {
    audit = buildAudit(collectFacts({ gh: !flags["no-gh"] }));
  } catch (error) {
    if (!(error instanceof AuditToolError)) throw error;
    console.error(`audit: ${error.message}`);
    process.exitCode = 2;
    return;
  }
  console.log(flags.json ? JSON.stringify(audit, null, 2) : formatAudit(audit));
  process.exitCode = audit.ok ? 0 : 1;
}

// --- argument parsing --------------------------------------------------------

const USAGE = `usage: worktree.mjs <command> [options]

commands:
  new <slug> [--branch <name>] [--base <ref>] [--owner <role>]
                   create .worktrees/<slug> on a branch and register it
  list [--json]    live worktrees joined with the ledger
  sync             reconcile the ledger with git worktrees
  prune [--check|--force]
                   remove merged, gone, and phantom subtrees (--check only reports)
  remove <slug> [--force]
                   remove one subtree
  audit [--json] [--no-gh]
                   read-only inventory of worktrees, branches, remotes, ledger and
                   merged PRs; exit 0 clean, 1 drift, 2 error (--no-gh skips PRs)
  help             show this message

Unknown commands or options fail with exit 2 and change nothing.`;

const COMMAND_SPECS = {
  new: { positional: "slug", flags: [], values: ["branch", "base", "owner"] },
  list: { flags: ["json"], values: [] },
  sync: { flags: [], values: [] },
  prune: { flags: ["check", "force"], values: [], exclusive: [["check", "force"]] },
  remove: { positional: "slug", flags: ["force"], values: [] },
  audit: { flags: ["json", "no-gh"], values: [] },
};

const isHelp = (arg) => arg === "--help" || arg === "-h";

/**
 * Parse and validate argv in full, with no side effects. Anything not declared
 * in COMMAND_SPECS is an error, so no mutating command can run on a typo.
 */
export function parseCliArgs(argv) {
  const [command, ...rest] = argv;
  if (command === undefined || command === "help" || isHelp(command)) {
    return { ok: true, help: true };
  }
  const spec = COMMAND_SPECS[command];
  if (!spec) return { ok: false, error: `unknown command "${command}"` };
  if (rest.some(isHelp)) return { ok: true, help: true, command };

  const flags = {};
  const values = {};
  const positionals = [];
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (!arg.startsWith("-")) {
      positionals.push(arg);
      continue;
    }
    const [rawName, inline] = arg.startsWith("--")
      ? arg.slice(2).split(/=(.*)/su)
      : [arg, undefined];
    if (spec.values.includes(rawName)) {
      const value = inline ?? rest[(i += 1)];
      if (value === undefined || value === "" || value.startsWith("-")) {
        return { ok: false, command, error: `option --${rawName} needs a value` };
      }
      values[rawName] = value;
    } else if (spec.flags.includes(rawName) && inline === undefined) {
      flags[rawName] = true;
    } else {
      return { ok: false, command, error: `unknown option "${arg}" for "${command}"` };
    }
  }
  const expected = spec.positional ? 1 : 0;
  if (positionals.length !== expected) {
    return {
      ok: false,
      command,
      error: expected
        ? `"${command}" takes exactly one <${spec.positional}>`
        : `"${command}" takes no positional arguments`,
    };
  }
  for (const group of spec.exclusive ?? []) {
    if (group.every((name) => flags[name])) {
      return { ok: false, command, error: `--${group.join(" and --")} cannot be combined` };
    }
  }
  return { ok: true, command, positionals, flags, values };
}

// --- commands ----------------------------------------------------------------

function todayIso() {
  // Local date only — never authoritative; stamped for human coordination.
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

function cmdNew({ positionals: [slug], values }) {
  const branch = values.branch ?? `${DEFAULT_BRANCH_PREFIX}${slug}`;
  const base = values.base ?? DEFAULT_BASE;
  const owner = values.owner ?? "orchestrator";
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
    scope: slug,
    owner,
    status: "active",
    base,
    created: todayIso(),
    pr: "—",
  });
  writeLedger(rows);
  console.log(`created ${path} on ${branch} (base ${base})`);
  console.log(`next: work this subtree's frontier with ".opencode/command/work.md <root issue>"`);
}

function cmdList({ flags }) {
  const rows = readLedger();
  const inspected = inspectRows(rows);
  const extra = unregisteredWorktrees(rows);
  if (flags.json) {
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
    if (row.dirty && !force) {
      return { removed: false, message: `skipped ${row.slug}: uncommitted changes (use --force)` };
    }
    git(["worktree", "remove", ...(force ? ["--force"] : []), row.path]);
  }
  if (row.state === "merged" && branchExists(row.branch)) git(["branch", "-D", row.branch]);
  return { removed: true, message: `removed ${row.slug} (${row.state})` };
}

function cmdPrune({ flags }) {
  const check = Boolean(flags.check);
  const force = Boolean(flags.force);
  const inspected = inspectRows(hygieneRows());
  const keep = [];
  const lines = [];
  let stale = 0;
  let removedCount = 0;
  for (const row of inspected) {
    if (!TERMINAL_STATES.has(row.state)) {
      keep.push(row);
      if (row.warnings.length) lines.push(`warn ${row.slug}: ${row.warnings.join("; ")}`);
      continue;
    }
    stale += 1;
    if (check) {
      lines.push(`stale ${row.slug} (${row.state}): ${row.warnings[0] ?? "prune it"}`);
      continue;
    }
    const { removed, message } = removeWorktree(row, { force });
    lines.push(message);
    if (removed) removedCount += 1;
    // A row we could not remove (e.g. dirty without --force) must stay registered.
    if (!removed) keep.push(row);
  }
  if (!check) writeLedger(keep.filter((r) => r.registered).map(ledgerRow));
  for (const line of lines) console.log(line);
  if (check) {
    console.log(
      stale === 0
        ? "worktrees: clean"
        : "worktrees: stale subtrees present — run `pnpm worktrees:prune`",
    );
  } else {
    console.log(`pruned ${removedCount} subtree(s); ${keep.length} kept`);
  }
}

function cmdRemove({ positionals: [slug], flags }) {
  const rows = hygieneRows();
  const inspected = inspectRows(rows).find((r) => r.slug === slug);
  if (!inspected) {
    console.error(`no subtree "${slug}"`);
    process.exitCode = 1;
    return;
  }
  const { removed, message } = removeWorktree(inspected, { force: Boolean(flags.force) });
  if (!removed) {
    console.error(message);
    process.exitCode = 1;
    return;
  }
  writeLedger(rows.filter((r) => r.registered && r.slug !== slug).map(ledgerRow));
  console.log(message);
}

const COMMANDS = {
  new: cmdNew,
  list: cmdList,
  sync: cmdSync,
  prune: cmdPrune,
  remove: cmdRemove,
  audit: cmdAudit,
};

function main() {
  const parsed = parseCliArgs(process.argv.slice(2));
  if (!parsed.ok) {
    console.error(`worktree.mjs: ${parsed.error}\n\n${USAGE}`);
    process.exitCode = 2;
    return;
  }
  if (parsed.help) {
    console.log(USAGE);
    return;
  }
  COMMANDS[parsed.command](parsed);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
