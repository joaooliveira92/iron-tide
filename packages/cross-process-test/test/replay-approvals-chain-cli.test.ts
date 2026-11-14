import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Result } from "effect";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { proposeApprovals, recordReplay, type CorpusState } from "../src/replay-corpus/index.js";

const cli = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "dist",
  "replay-approvals-cli.js",
);
const RECORDED = recordReplay({ id: "approvals-two-months", seed: "approvals-test", months: 2 });
const NAME = "approvals-two-months.replay.json";

function perturbed(letter: string): string {
  const file = JSON.parse(RECORDED);
  file.months[1].snapshotHash = letter.repeat(64);
  return JSON.stringify(file);
}

function approved(prev: CorpusState, replay: string): CorpusState {
  const head: CorpusState = { replays: new Map([[NAME, replay]]), approvals: prev.approvals! };
  const result = proposeApprovals(prev, head, {
    cause: "intended rebalance",
    migrationAssessment: "none",
    changeClass: "EXPECTED_GAMEPLAY_CHANGE",
  });
  if (Result.isFailure(result)) throw new Error(result.failure.message);
  return { replays: head.replays, approvals: result.success };
}

const gitEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
  GIT_AUTHOR_DATE: "2026-01-01T00:00:00Z",
  GIT_COMMITTER_DATE: "2026-01-01T00:00:00Z",
  NODE_OPTIONS: "",
};

describe("replay-approvals check-chain", () => {
  let repo = "";
  const git = (...args: string[]): string =>
    execFileSync(
      "git",
      [
        "-C",
        repo,
        "-c",
        "user.name=t",
        "-c",
        "user.email=t@t",
        "-c",
        "commit.gpgsign=false",
        "-c",
        "core.hooksPath=/dev/null",
        ...args,
      ],
      { encoding: "utf8", env: gitEnv },
    );
  const commit = (state: CorpusState, message: string): void => {
    mkdirSync(join(repo, "golden", "replays"), { recursive: true });
    writeFileSync(join(repo, "golden", "replays", NAME), state.replays.get(NAME)!);
    writeFileSync(join(repo, "golden", "replay-approvals.json"), state.approvals!);
    git("add", "-A");
    git("commit", "-q", "-m", message);
  };
  const run = (...args: string[]) =>
    spawnSync(process.execPath, [cli, "check-chain", "--repo", repo, ...args], {
      encoding: "utf8",
      env: gitEnv,
    });

  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), "replay-chain-"));
    git("init", "-q", "--initial-branch=main");
    const A: CorpusState = {
      replays: new Map([[NAME, RECORDED]]),
      approvals: '{"schema":"replay-approvals/2","entries":[]}\n',
    };
    commit(A, "baseline");
    git("checkout", "-q", "-b", "dev");
    const B = approved(A, perturbed("b"));
    commit(B, "hop one");
    const C = approved(B, perturbed("c"));
    commit(C, "hop two");
    git("checkout", "-q", "-b", "collapsed", "main");
    commit(approved(A, perturbed("b")), "hop one");
    commit(approved(A, perturbed("c")), "collapsed hop two");
  });

  afterAll(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  it("passes a stacked chain that the single-base gate rejects", () => {
    git("checkout", "-q", "dev");
    const outcome = run("--main", "main", "--head", "dev", "--tree", "dev");
    expect(outcome.stdout).toContain("2 first-parent hops");
    expect(outcome.stdout).toContain("every promotion hop is fully approved");
    expect(outcome.status).toBe(0);
  });

  it("reads the tree to compare from --tree, defaulting to HEAD", () => {
    git("checkout", "-q", "main");
    const outcome = run("--main", "main", "--head", "dev");
    expect(outcome.status).toBe(1);
    expect(outcome.stdout).toContain("ChainEndMismatch");
  });

  it("fails a collapsed hop and names the commit", () => {
    const outcome = run("--main", "main", "--head", "collapsed", "--tree", "collapsed");
    const failing = git("rev-parse", "--short=8", "collapsed").trim();
    expect(outcome.status).toBe(1);
    expect(outcome.stdout).toContain(`${failing} RewrittenApproval`);
  });

  it("fails EndpointBinding when main moved a replay since the chain start", () => {
    git("checkout", "-q", "-b", "moved", "main");
    commit(
      approved(
        {
          replays: new Map([[NAME, RECORDED]]),
          approvals: '{"schema":"replay-approvals/2","entries":[]}\n',
        },
        perturbed("e"),
      ),
      "main only",
    );
    const outcome = run("--main", "moved", "--head", "dev", "--tree", "dev");
    expect(outcome.status).toBe(1);
    expect(outcome.stdout).toContain("EndpointBinding");
  });

  it("prints usage and exits 2 without both refs", () => {
    const outcome = run("--head", "dev");
    expect(outcome.status).toBe(2);
    expect(outcome.stdout).toContain("usage: replay-approvals check-chain");
  });
});
