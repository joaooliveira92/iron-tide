#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const REPLAYS = "golden/replays";
const APPROVALS = "golden/replay-approvals";
const REPLAY_SUFFIX = ".replay.json";
const OPTION_KEYS = {
  "--base": "base",
  "--cause": "cause",
  "--migration": "migration",
  "--class": "changeClass",
};

export function parseArguments(argv) {
  const parsed = {};
  for (const [index, token] of argv.entries()) {
    const key = OPTION_KEYS[token];
    const value = argv[index + 1];
    if (key !== undefined && value !== undefined && !value.startsWith("--")) parsed[key] = value;
  }
  return { base: "origin/dev", ...parsed };
}

const lines = (text) => text.split("\n").filter((line) => line !== "");

function carriedMetadata(root, paths) {
  const found = new Map();
  for (const path of paths) {
    try {
      const { entries } = JSON.parse(readFileSync(join(root, path), "utf8"));
      for (const entry of entries) {
        const { changeClass, cause, migrationAssessment } = entry;
        if ([changeClass, cause, migrationAssessment].every((v) => typeof v === "string")) {
          found.set(JSON.stringify([cause, migrationAssessment, changeClass]), {
            cause,
            migration: migrationAssessment,
            changeClass,
          });
        }
      }
    } catch {
      continue;
    }
  }
  return [...found.values()];
}

function merging(git) {
  try {
    git("rev-parse", "-q", "--verify", "MERGE_HEAD");
    return true;
  } catch {
    return false;
  }
}

export function replayRebase({ root, base, git, exec, options, print }) {
  const baseFiles = new Set(
    lines(git("ls-tree", "-r", "--name-only", base, "--", REPLAYS, APPROVALS)),
  );
  const unmerged = lines(git("diff", "--name-only", "--diff-filter=U", "--", "golden"));
  const approvalDir = join(root, APPROVALS);
  const branchApprovals = (existsSync(approvalDir) ? readdirSync(approvalDir) : [])
    .filter((name) => name.endsWith(".json"))
    .map((name) => `${APPROVALS}/${name}`)
    .filter((path) => !baseFiles.has(path) && !unmerged.includes(path));
  const carried = carriedMetadata(root, branchApprovals);

  for (const path of unmerged) {
    if (baseFiles.has(path)) git("checkout", base, "--", path);
    else rmSync(join(root, path), { force: true });
  }
  for (const path of branchApprovals) rmSync(join(root, path), { force: true });

  const replayDir = join(root, REPLAYS);
  const present = (existsSync(replayDir) ? readdirSync(replayDir) : []).filter((name) =>
    name.endsWith(REPLAY_SUFFIX),
  );
  const toRecord = new Set(
    unmerged
      .filter((path) => path.startsWith(`${REPLAYS}/`) && path.endsWith(REPLAY_SUFFIX))
      .map((path) => path.slice(REPLAYS.length + 1, -REPLAY_SUFFIX.length)),
  );
  const differsFromBase = new Set(lines(git("diff", "--name-only", base, "--", REPLAYS)));
  const newOnBase = merging(git)
    ? new Set(
        lines(
          git(
            "diff",
            "--name-only",
            "--diff-filter=A",
            git("merge-base", base, "HEAD").trim(),
            base,
            "--",
            REPLAYS,
          ),
        ),
      )
    : new Set();
  for (const name of present) {
    const path = `${REPLAYS}/${name}`;
    if (!baseFiles.has(path) || differsFromBase.has(path) || newOnBase.has(path)) {
      toRecord.add(name.slice(0, -REPLAY_SUFFIX.length));
    }
  }
  for (const id of [...toRecord].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
    const status = exec("pnpm", ["replay:record", id]);
    if (status !== 0) {
      print(`replay:record ${id} failed (${String(status)}); fix the scenario and rerun\n`);
      return status;
    }
  }
  print(`re-recorded ${String(toRecord.size)} replay(s) against ${base}\n`);

  const given =
    options.cause !== undefined &&
    options.migration !== undefined &&
    options.changeClass !== undefined
      ? [{ cause: options.cause, migration: options.migration, changeClass: options.changeClass }]
      : carried;
  if (given.length > 1) {
    print("the branch approvals carry different causes; pass --cause, --migration and --class\n");
    return 2;
  }
  if (given.length === 1) {
    const [{ cause, migration, changeClass }] = given;
    const status = exec("pnpm", [
      "replay:approve",
      "--base",
      base,
      "--cause",
      cause,
      "--migration",
      migration,
      "--class",
      changeClass,
    ]);
    if (status !== 0) return status;
  } else {
    print(
      "no approval metadata to carry; if checkpoints moved, run pnpm replay:approve --cause <why> --migration <assessment> --class <class>\n",
    );
  }
  git("add", "-A", "--", REPLAYS, APPROVALS);
  const built = exec("pnpm", ["--filter", "@bluewave/cross-process-test", "build"]);
  if (built !== 0) return built;
  return exec("pnpm", ["check:replay-approvals"]);
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  const root = resolve(import.meta.dirname, "..");
  const options = parseArguments(process.argv.slice(2));
  const status = replayRebase({
    root,
    base: options.base,
    git: (...args) =>
      execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 }),
    exec: (command, args) => spawnSync(command, args, { cwd: root, stdio: "inherit" }).status ?? 1,
    options,
    print: (text) => process.stdout.write(text),
  });
  process.exit(status);
}
