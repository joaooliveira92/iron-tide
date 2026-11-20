import { execFileSync } from "node:child_process";

import { Result } from "effect";

import {
  APPROVALS_DIR,
  APPROVAL_FILE_SUFFIX,
  LEGACY_APPROVALS_FILE,
  mergeApprovalFiles,
  type ChainInput,
  type ChainStep,
  type CorpusState,
} from "./replay-corpus/index.js";

const REPLAYS = "golden/replays";
const SUFFIX = ".replay.json";

export function readApprovalsAt(
  git: (...args: string[]) => string,
  commit: string,
): string | undefined {
  const files = new Map<string, string>();
  try {
    files.set(LEGACY_APPROVALS_FILE, git("show", `${commit}:${LEGACY_APPROVALS_FILE}`));
  } catch {
    files.delete(LEGACY_APPROVALS_FILE);
  }
  const listing = git("ls-tree", "--name-only", commit, `${APPROVALS_DIR}/`).split("\n");
  for (const path of listing.filter((p) => p.endsWith(APPROVAL_FILE_SUFFIX))) {
    files.set(path, git("show", `${commit}:${path}`));
  }
  const merged = mergeApprovalFiles(files);
  if (Result.isFailure(merged)) throw merged.failure;
  return merged.success;
}

export function gateBaseCommit(git: (...args: string[]) => string, ref: string): string {
  const merging = ((): boolean => {
    try {
      git("rev-parse", "-q", "--verify", "MERGE_HEAD");
      return true;
    } catch {
      return false;
    }
  })();
  return git("merge-base", ref, "HEAD", ...(merging ? ["MERGE_HEAD"] : [])).trim();
}

export interface ChainRefs {
  readonly main: string;
  readonly head: string;
  readonly tree: string;
}

export function readChainInput(repo: string, refs: ChainRefs): ChainInput {
  const git = (...args: string[]): string =>
    execFileSync("git", ["-C", repo, ...args], {
      encoding: "utf8",
      maxBuffer: 1 << 28,
      stdio: ["ignore", "pipe", "pipe"],
    });
  const objectId = (commit: string, path: string): string | undefined => {
    try {
      return git("rev-parse", "--verify", "--quiet", `${commit}:${path}`).trim();
    } catch {
      return undefined;
    }
  };
  const cache = new Map<string, CorpusState>();
  const stateAt = (commit: string): CorpusState => {
    const key = [REPLAYS, APPROVALS_DIR, LEGACY_APPROVALS_FILE]
      .map((path) => objectId(commit, path) ?? "none")
      .join("/");
    const known = cache.get(key);
    if (known !== undefined) return known;
    const replays = new Map<string, string>();
    if (objectId(commit, REPLAYS) !== undefined) {
      const names = git("ls-tree", "--name-only", commit, `${REPLAYS}/`).split("\n");
      for (const path of names.filter((p) => p.endsWith(SUFFIX))) {
        replays.set(path.slice(REPLAYS.length + 1), git("show", `${commit}:${path}`));
      }
    }
    const approvals = readApprovalsAt(git, commit);
    const state: CorpusState = approvals === undefined ? { replays } : { replays, approvals };
    cache.set(key, state);
    return state;
  };
  const resolve = (ref: string): string => git("rev-parse", "--verify", `${ref}^{commit}`).trim();
  const label = (commit: string): string => commit.slice(0, 8);

  const mainTip = resolve(refs.main);
  const headCommit = resolve(refs.head);
  const start = git("merge-base", mainTip, headCommit).trim();
  const hops = git("rev-list", "--first-parent", "--reverse", `${start}..${headCommit}`)
    .split("\n")
    .filter((line) => line !== "");
  const steps: ChainStep[] = [start, ...hops].map((commit) => ({
    label: label(commit),
    state: stateAt(commit),
  }));
  return { main: stateAt(mainTip), steps, head: stateAt(resolve(refs.tree)) };
}
