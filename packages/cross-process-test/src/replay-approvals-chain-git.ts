import { execFileSync } from "node:child_process";

import type { ChainInput, ChainStep, CorpusState } from "./replay-corpus/index.js";

const REPLAYS = "golden/replays";
const APPROVALS = "golden/replay-approvals.json";
const SUFFIX = ".replay.json";

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
    const key = `${objectId(commit, REPLAYS) ?? "none"}/${objectId(commit, APPROVALS) ?? "none"}`;
    const known = cache.get(key);
    if (known !== undefined) return known;
    const replays = new Map<string, string>();
    if (objectId(commit, REPLAYS) !== undefined) {
      const names = git("ls-tree", "--name-only", commit, `${REPLAYS}/`).split("\n");
      for (const path of names.filter((p) => p.endsWith(SUFFIX))) {
        replays.set(path.slice(REPLAYS.length + 1), git("show", `${commit}:${path}`));
      }
    }
    const approvals =
      objectId(commit, APPROVALS) === undefined ? undefined : git("show", `${commit}:${APPROVALS}`);
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
