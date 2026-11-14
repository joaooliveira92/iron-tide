import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { readChainInput } from "./replay-approvals-chain-git.js";
import {
  approvalsCommand,
  checkApprovalChain,
  formatChainFailures,
  type ApprovalsIo,
  type CorpusState,
} from "./replay-corpus/index.js";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..");
const REPLAYS = "golden/replays";
const APPROVALS = "golden/replay-approvals.json";
const SUFFIX = ".replay.json";

const git = (...args: string[]): string =>
  execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

function baseOf(argv: readonly string[], gateBase: string): string {
  const index = argv.indexOf("--base");
  return (index >= 0 ? argv[index + 1] : undefined) ?? gateBase;
}

function readBase(ref: string): CorpusState {
  const commit = git("merge-base", ref, "HEAD").trim();
  const listing = git("ls-tree", "--name-only", commit, `${REPLAYS}/`).split("\n");
  const replays = new Map<string, string>();
  for (const path of listing.filter((p) => p.endsWith(SUFFIX))) {
    replays.set(path.slice(REPLAYS.length + 1), git("show", `${commit}:${path}`));
  }
  let approvals: string | undefined;
  try {
    approvals = git("show", `${commit}:${APPROVALS}`);
  } catch {
    approvals = undefined;
  }
  return approvals === undefined ? { replays } : { replays, approvals };
}

function readHead(): CorpusState {
  const dir = resolve(ROOT, REPLAYS);
  const replays = new Map<string, string>();
  if (existsSync(dir)) {
    for (const name of readdirSync(dir).filter((n) => n.endsWith(SUFFIX))) {
      replays.set(name, readFileSync(resolve(dir, name), "utf8"));
    }
  }
  const file = resolve(ROOT, APPROVALS);
  return existsSync(file) ? { replays, approvals: readFileSync(file, "utf8") } : { replays };
}

function optionOf(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  const value = index >= 0 ? argv[index + 1] : undefined;
  return value === undefined || value.startsWith("--") ? undefined : value;
}

function checkChain(argv: readonly string[]): number {
  const main = optionOf(argv, "--main") ?? process.env["REPLAY_APPROVALS_BASE"];
  const head = optionOf(argv, "--head");
  if (main === undefined || head === undefined) {
    process.stdout.write(
      "usage: replay-approvals check-chain --main <ref> --head <ref> [--tree <ref>] [--repo <dir>]\n",
    );
    return 2;
  }
  const tree = optionOf(argv, "--tree") ?? "HEAD";
  const input = readChainInput(optionOf(argv, "--repo") ?? ROOT, { main, head, tree });
  process.stdout.write(
    `approval chain: ${main} to ${head} (${String(input.steps.length - 1)} first-parent hops, tree ${tree})\n`,
  );
  const outcome = checkApprovalChain(input);
  if (outcome.ok) {
    process.stdout.write("replay approvals: every promotion hop is fully approved\n");
    return 0;
  }
  process.stdout.write(formatChainFailures(outcome.failures));
  return 1;
}

const argv = process.argv.slice(2);
const gateBase = process.env["REPLAY_APPROVALS_BASE"] ?? "origin/dev";
const base = baseOf(argv, gateBase);
const io: ApprovalsIo = {
  base,
  gateBase,
  readBase: () => readBase(base),
  readHead,
  writeApprovals: (text) => writeFileSync(resolve(ROOT, APPROVALS), text, "utf8"),
  print: (line) => process.stdout.write(line),
};

try {
  process.exitCode =
    argv[0] === "check-chain" ? checkChain(argv) : approvalsCommand(argv, process.env, io);
} catch (error) {
  process.stderr.write(
    `replay-approvals: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 2;
}
