#!/usr/bin/env node
// Generate a draft changelog section from Conventional Commits.
//
// The curated `CHANGELOG.md` stays the player-facing source of truth; this
// produces the raw, per-type draft that seeds a release section, so the commit
// history and the changelog cannot drift apart unnoticed.
//
//   node scripts/changelog.mjs --version v1.2.0 --from v1.1.0
//   node scripts/changelog.mjs --version v1.2.0 --from v1.1.0 --out CHANGELOG.draft.md
//
// Prints the raw per-type draft to stdout by default. The curated `CHANGELOG.md`
// is human-authored and is not overwritten: `--out` writes the draft beside it
// for a maintainer to reconcile at release time.

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

/** Conventional-commit type -> changelog section. Types not listed are omitted. */
export const SECTION_BY_TYPE = {
  feat: "Added",
  fix: "Fixed",
  perf: "Changed",
  refactor: "Changed",
  revert: "Fixed",
};

const SECTION_ORDER = ["Added", "Changed", "Fixed"];

/** @param {string} subject @returns {{ type: string, scope?: string, description: string } | null} */
export function parseSubject(subject) {
  const match = /^([a-z]+)(?:\(([a-z0-9._/-]+)\))?!?:\s*(.+)$/u.exec(subject.trim());
  if (!match) return null;
  return { type: match[1], scope: match[2], description: match[3] };
}

/**
 * @param {{ hash: string, subject: string }[]} commits
 * @param {string} version - e.g. "v1.2.0"
 * @returns {string} markdown draft
 */
export function renderChangelog(commits, version) {
  const sections = new Map();
  for (const { subject } of commits) {
    const parsed = parseSubject(subject);
    if (parsed === null) continue;
    const section = SECTION_BY_TYPE[parsed.type];
    if (section === undefined) continue;
    const line =
      parsed.scope === undefined
        ? `- ${parsed.description}`
        : `- **${parsed.scope}:** ${parsed.description}`;
    const lines = sections.get(section) ?? [];
    lines.push(line);
    sections.set(section, lines);
  }
  const out = [`## ${version}`, ""];
  for (const section of SECTION_ORDER) {
    const lines = sections.get(section);
    if (lines === undefined || lines.length === 0) continue;
    out.push(`### ${section}`, "", ...lines, "");
  }
  if (out.length === 2) out.push("_No user-facing changes._", "");
  return out.join("\n");
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" });
}

function readCommits(from, to) {
  const range = from ? `${from}..${to}` : to;
  return git(["log", "--no-merges", "--format=%H%x00%s", range])
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [hash, subject] = line.split("\0");
      return { hash, subject: subject ?? "" };
    });
}

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index !== -1 ? argv[index + 1] : undefined;
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  const argv = process.argv.slice(2);
  const version = argValue(argv, "--version") ?? "Unreleased";
  const from = argValue(argv, "--from");
  const to = argValue(argv, "--to") ?? "HEAD";
  const out = argValue(argv, "--out");
  const draft = `${renderChangelog(readCommits(from, to), version)}\n`;
  if (out !== undefined) {
    writeFileSync(resolve(out), draft);
    process.stdout.write(`changelog: wrote the ${version} draft to ${out}\n`);
  } else {
    process.stdout.write(draft);
  }
}
