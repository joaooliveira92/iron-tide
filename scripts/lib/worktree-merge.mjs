import { execFileSync } from "node:child_process";

const MAX_BUFFER = 32 * 1024 * 1024;
const MAX_LISTED = 8;

export function runGit(cwd, args) {
  return execFileSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    maxBuffer: MAX_BUFFER,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function tryGit(cwd, args) {
  try {
    return { ok: true, out: runGit(cwd, args) };
  } catch (error) {
    return { ok: false, out: `${error.stdout ?? ""}`, err: `${error.stderr ?? error.message}` };
  }
}

function summarise(items) {
  const shown = items.slice(0, MAX_LISTED).join(", ");
  return items.length > MAX_LISTED ? `${shown} (+${items.length - MAX_LISTED} more)` : shown;
}

function worktreePathOf(mainRoot, branch) {
  const listing = runGit(mainRoot, ["worktree", "list", "--porcelain"]);
  let path = null;
  for (const line of listing.split("\n")) {
    if (line.startsWith("worktree ")) path = line.slice("worktree ".length);
    if (line === `branch refs/heads/${branch}`) return path;
  }
  return null;
}

export function planMerge({ mainRoot, branch, base }) {
  const problems = [];
  const notes = [];
  const baseOk = tryGit(mainRoot, ["rev-parse", "--verify", "--quiet", `refs/heads/${base}`]);
  const branchOk = tryGit(mainRoot, ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`]);
  if (!baseOk.ok) problems.push(`base branch ${base} does not exist`);
  if (!branchOk.ok) problems.push(`branch ${branch} does not exist`);
  if (problems.length > 0) return { ok: false, problems, notes, changed: [] };

  const current = runGit(mainRoot, ["branch", "--show-current"]).trim();
  if (current !== base)
    problems.push(`main checkout is on "${current || "detached HEAD"}", not ${base}`);
  const mainStatus = runGit(mainRoot, ["status", "--porcelain", "--untracked-files=no"]).trim();
  if (mainStatus !== "") problems.push("main checkout has uncommitted tracked changes");

  const worktree = worktreePathOf(mainRoot, branch);
  if (worktree === null) {
    notes.push(`no worktree holds ${branch}`);
  } else if (runGit(worktree, ["status", "--porcelain"]).trim() !== "") {
    problems.push(`worktree ${worktree} has uncommitted changes`);
  }

  const ahead = Number(runGit(mainRoot, ["rev-list", "--count", `${base}..${branch}`]).trim());
  if (ahead === 0) problems.push(`${branch} has no commits that ${base} lacks`);
  else notes.push(`${ahead} commit(s) to merge`);

  const mergeBase = runGit(mainRoot, ["merge-base", base, branch]).trim();
  const changed = runGit(mainRoot, ["diff", "--name-only", `${mergeBase}..${branch}`])
    .split("\n")
    .filter(Boolean);
  if (changed.length > 0) {
    const untracked = runGit(mainRoot, [
      "ls-files",
      "--others",
      "--exclude-standard",
      "-z",
      "--",
      ...changed,
    ])
      .split("\0")
      .filter(Boolean);
    if (untracked.length > 0) {
      problems.push(
        `untracked files in the main checkout would be overwritten: ${summarise(untracked)}`,
      );
    }
  }

  const tree = tryGit(mainRoot, ["merge-tree", "--write-tree", "--name-only", base, branch]);
  if (!tree.ok) {
    const conflicted = tree.out.split("\n").slice(1).filter(Boolean);
    problems.push(
      conflicted.length > 0
        ? `merge would conflict in: ${summarise(conflicted)}`
        : `merge-tree failed: ${(tree.err ?? "").trim().split("\n")[0]}`,
    );
  }
  return { ok: problems.length === 0, problems, notes, changed };
}

export function executeMerge({ mainRoot, branch, base }) {
  const plan = planMerge({ mainRoot, branch, base });
  if (!plan.ok) return { merged: false, plan };
  runGit(mainRoot, ["merge", "--no-ff", "--no-edit", branch]);
  const tip = runGit(mainRoot, ["rev-parse", "--short", "HEAD"]).trim();
  return { merged: true, plan, tip };
}
