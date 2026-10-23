#!/usr/bin/env node
// Release ref gate. A production release builds only from a version tag whose
// commit is on main and whose number matches the desktop app version, so a
// manual dispatch from a branch cannot publish installers.
//
// Usage (CI): GITHUB_REF_TYPE, GITHUB_REF_NAME from the runner; run with a full
// checkout so `origin/main` is available.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { readDesktopVersion } from "./verify-version-coherence.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const RELEASE_TAG = /^v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/u;

/**
 * @param {{ refType: string, refName: string, desktopVersion: string, onMaster: boolean }} input
 * @returns {string[]} problems, empty when the ref may be released
 */
export function checkReleaseRef({ refType, refName, desktopVersion, onMaster }) {
  const problems = [];
  if (refType !== "tag") {
    problems.push(`a release must run from a tag, not a ${refType} ("${refName}")`);
  }
  const match = RELEASE_TAG.exec(refName);
  if (match === null) {
    problems.push(`"${refName}" is not a release version tag (expected vMAJOR.MINOR.PATCH)`);
  } else if (match[1] !== desktopVersion) {
    problems.push(
      `tag "${refName}" does not match the desktop app version "${desktopVersion}" in apps/desktop/package.json`,
    );
  }
  if (!onMaster) {
    problems.push("the tagged commit is not reachable from origin/main");
  }
  return problems;
}

function isAncestorOfMaster() {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", "HEAD", "origin/main"], {
      cwd: ROOT,
      stdio: "ignore",
    });
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "status" in error && error.status === 1) return false;
    throw error;
  }
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  const problems = checkReleaseRef({
    refType: process.env.GITHUB_REF_TYPE ?? "",
    refName: process.env.GITHUB_REF_NAME ?? "",
    desktopVersion: readDesktopVersion(
      readFileSync(resolve(ROOT, "apps/desktop/package.json"), "utf8"),
    ),
    onMaster: isAncestorOfMaster(),
  });
  for (const problem of problems) console.error(`verify-release-ref: ${problem}`);
  if (problems.length === 0) console.log("verify-release-ref: ok");
  process.exit(problems.length === 0 ? 0 : 1);
}
