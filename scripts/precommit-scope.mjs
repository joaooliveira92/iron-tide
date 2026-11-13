#!/usr/bin/env node
// Decide which gates the `pre-commit` hook runs for the staged set.
//
// Prints `docs` when every staged path is Markdown (or nothing is staged), so the
// hook skips the code gates; prints `code` otherwise, after checking that the
// running Node satisfies `engines.node`. A mismatch fails here with one actionable
// line instead of deep inside a test. Full `pnpm preflight` still runs in
// `pre-push` and CI.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DOC_EXTENSIONS = [".md", ".mdx"];

/**
 * @param {readonly string[]} paths - staged repository paths.
 * @returns {"docs" | "code"} `docs` when every path is Markdown or the set is empty.
 */
export function classifyScope(paths) {
  return paths.every((path) => DOC_EXTENSIONS.some((extension) => path.endsWith(extension)))
    ? "docs"
    : "code";
}

/**
 * @param {string} actual - running Node version, e.g. `22.23.4`.
 * @param {string} required - `engines.node` range; only `>=N` lower bounds are read.
 * @returns {string | null} a one-line error, or null when the version satisfies the range.
 */
export function nodeVersionError(actual, required) {
  const minimum = /^>=\s*(\d+)/u.exec(required);
  if (minimum === null) return null;
  const major = Number(actual.split(".")[0]);
  if (major >= Number(minimum[1])) return null;
  return `pre-commit: Node ${actual} does not satisfy engines.node ${required}; switch Node (e.g. \`nvm use\`) and retry.`;
}

function stagedPaths(cwd) {
  const out = execFileSync(
    "git",
    ["-C", cwd, "diff", "--cached", "--name-only", "--no-renames", "-z", "--"],
    { encoding: "utf8" },
  );
  return out.split("\0").filter((path) => path !== "");
}

function enginesNode() {
  const packageJson = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
  return JSON.parse(readFileSync(packageJson, "utf8")).engines?.node ?? "";
}

if (process.argv[1] && import.meta.filename === resolve(process.argv[1])) {
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  const scope = classifyScope(stagedPaths(root));
  if (scope === "code") {
    const error = nodeVersionError(process.versions.node, enginesNode());
    if (error !== null) {
      process.stderr.write(`${error}\n`);
      process.exit(1);
    }
  }
  process.stdout.write(`${scope}\n`);
}
