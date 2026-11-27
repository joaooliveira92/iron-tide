#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const TARGET = "dev";
const ENTRY = /^\s*-\s*package-ecosystem:\s*(\S.*?)\s*$/u;
const TARGET_LINE = /^\s*target-branch:\s*(.*?)\s*$/u;

function unquote(value) {
  return value.replace(/^(["'])(.*)\1$/u, "$2");
}

/**
 * @param {string} text contents of .github/dependabot.yml
 * @returns {string[]} problems, empty when every ecosystem targets dev
 */
export function checkDependabotTarget(text) {
  const entries = [];
  for (const line of text.split("\n")) {
    const entry = ENTRY.exec(line);
    if (entry) {
      entries.push({ ecosystem: unquote(entry[1]), target: undefined });
      continue;
    }
    const current = entries.at(-1);
    const target = TARGET_LINE.exec(line);
    if (current && target && current.target === undefined) {
      current.target = unquote(target[1]);
    }
  }
  if (entries.length === 0) {
    return ["dependabot.yml declares no package-ecosystem entries"];
  }
  return entries.flatMap(({ ecosystem, target }) =>
    target === TARGET
      ? []
      : [
          `dependabot ecosystem "${ecosystem}" must set target-branch "${TARGET}" (found ${
            target === undefined ? "none" : `"${target}"`
          })`,
        ],
  );
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  const problems = checkDependabotTarget(
    readFileSync(resolve(ROOT, ".github/dependabot.yml"), "utf8"),
  );
  for (const problem of problems) console.error(`verify-dependabot-target: ${problem}`);
  if (problems.length > 0) process.exit(1);
  console.log("verify-dependabot-target: ok");
}
