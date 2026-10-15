#!/usr/bin/env node
// Report the explicit committed and worktree scope of a repository change.
//
// Prints a versioned JSON report of the paths touched between a base ref and a
// head ref (committed, plus staged/unstaged/untracked in the worktree). Intended
// to feed change-based filtering — e.g. `turbo run … --filter='[<base>]'` in CI —
// from one deterministic, machine-readable source rather than ad-hoc `git diff`.
//
// Ported from deepseek-harness `scripts/change-scope.ts`.
//
// Usage: `node scripts/change-scope.mjs --base <ref> [--head <ref>]`
// (--head defaults to HEAD).

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { parseArgs, TextDecoder } from "node:util";

const FORMAT_VERSION = 1;
const MAX_GIT_OUTPUT = 64 * 1024 * 1024;
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });

function executeGitBytes(cwd, args) {
  const result = spawnSync("git", ["-C", cwd, "-c", "core.fsmonitor=false", ...args], {
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", LANG: "C", LC_ALL: "C" },
    maxBuffer: MAX_GIT_OUTPUT,
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    error: result.error,
  };
}

function decodeGitText(output, context, stream) {
  try {
    return UTF8_DECODER.decode(output);
  } catch {
    throw new Error(`${context}: Git ${stream} is not valid UTF-8`);
  }
}

function requireGitBytes(cwd, args, context) {
  const result = executeGitBytes(cwd, args);
  if (result.status !== 0) {
    const detail =
      result.error?.message ??
      (result.stderr.toString("utf8").trim() || `Git exited with status ${String(result.status)}`);
    throw new Error(`${context}: ${detail}`);
  }
  return result.stdout;
}

function requireGit(cwd, args, context) {
  return decodeGitText(requireGitBytes(cwd, args, context), context, "stdout");
}

function parseOptions(args) {
  const { values } = parseArgs({
    args,
    allowPositionals: false,
    options: {
      base: { type: "string" },
      head: { type: "string", default: "HEAD" },
    },
    strict: true,
  });
  if (values.base === undefined) throw new Error("missing required --base <ref>");
  return { base: values.base, head: values.head };
}

function resolveCommit(root, label, ref) {
  const context = `cannot resolve ${label} ref ${JSON.stringify(ref)}`;
  const result = executeGitBytes(root, [
    "-c",
    "core.warnAmbiguousRefs=true",
    "rev-parse",
    "--verify",
    "--end-of-options",
    `${ref}^{commit}`,
  ]);
  const stderr = decodeGitText(result.stderr, context, "stderr");
  if (/\bambiguous\b/iu.test(stderr)) {
    throw new Error(
      `${label} ref ${JSON.stringify(ref)} is ambiguous; use a fully qualified ref or commit ID`,
    );
  }
  if (result.status !== 0) {
    throw new Error(
      `${label} ref ${JSON.stringify(ref)} does not resolve to a commit: ` +
        `${result.error?.message ?? (stderr.trim() || `exit ${String(result.status)}`)}`,
    );
  }
  const commits = decodeGitText(result.stdout, context, "stdout")
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean);
  if (commits.length !== 1) {
    throw new Error(`${label} ref ${JSON.stringify(ref)} did not resolve to exactly one commit`);
  }
  return commits[0];
}

function resolveMergeBase(root, baseSha, headSha) {
  const out = requireGit(
    root,
    ["merge-base", "--all", baseSha, headSha],
    "cannot resolve the merge base",
  );
  const mergeBases = out.trim().split(/\r?\n/u).filter(Boolean);
  if (mergeBases.length !== 1) {
    throw new Error(`base and head do not have a unique merge base; found ${mergeBases.length}`);
  }
  return mergeBases[0];
}

function parsePathSet(output, context) {
  const paths = [];
  let start = 0;
  let record = 0;
  for (let end = 0; end < output.length; end += 1) {
    if (output[end] !== 0) continue;
    if (end > start) {
      record += 1;
      try {
        paths.push(UTF8_DECODER.decode(output.subarray(start, end)));
      } catch {
        throw new Error(`${context}: Git path ${record} is not valid UTF-8`);
      }
    }
    start = end + 1;
  }
  return [...new Set(paths)].sort();
}

function diffPaths(root, args, context) {
  return parsePathSet(
    requireGitBytes(
      root,
      [
        "diff",
        "--no-ext-diff",
        "--no-textconv",
        "--no-renames",
        "--ignore-submodules=none",
        "--name-only",
        "-z",
        ...args,
        "--",
      ],
      context,
    ),
    context,
  );
}

function stripGitLineTerminator(output) {
  const withoutLineFeed = output.endsWith("\n") ? output.slice(0, -1) : output;
  return process.platform === "win32" && withoutLineFeed.endsWith("\r")
    ? withoutLineFeed.slice(0, -1)
    : withoutLineFeed;
}

function collectReport(options, cwd) {
  const root = stripGitLineTerminator(
    requireGit(cwd, ["rev-parse", "--show-toplevel"], "cannot locate a Git worktree"),
  );
  const baseSha = resolveCommit(root, "base", options.base);
  const headSha = resolveCommit(root, "head", options.head);
  const mergeBaseSha = resolveMergeBase(root, baseSha, headSha);
  return {
    formatVersion: FORMAT_VERSION,
    repositoryRoot: root,
    input: { base: options.base, head: options.head },
    resolved: { baseSha, headSha, mergeBaseSha },
    paths: {
      committed: diffPaths(root, [mergeBaseSha, headSha], "cannot inspect committed paths"),
      staged: diffPaths(root, ["--cached"], "cannot inspect staged paths"),
      unstaged: diffPaths(root, [], "cannot inspect unstaged paths"),
      untracked: parsePathSet(
        requireGitBytes(
          root,
          ["ls-files", "--others", "--exclude-standard", "-z", "--"],
          "cannot inspect untracked paths",
        ),
        "cannot inspect untracked paths",
      ),
    },
  };
}

/**
 * Validate arguments and render one complete versioned report.
 * @param {string[]} args - arguments after the script path.
 * @param {string} cwd - directory whose containing Git worktree is inspected.
 * @returns {string} JSON report with a trailing newline.
 */
export function renderChangeScope(args, cwd) {
  return `${JSON.stringify(collectReport(parseOptions(args), cwd), null, 2)}\n`;
}

if (process.argv[1] && import.meta.filename === resolve(process.argv[1])) {
  try {
    process.stdout.write(renderChangeScope(process.argv.slice(2), process.cwd()));
  } catch (error) {
    process.stderr.write(
      `change-scope: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
