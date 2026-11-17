import { execFileSync } from "node:child_process";

const CLOSING = /\b(?:clos(?:e|es|ed)|fix(?:es|ed)?)\b\s*:?\s*#(\d+)/gi;
const FENCED = /```[\s\S]*?```/g;
const INLINE = /`[^`\n]*`/g;

export function parseIssueReferences(body) {
  if (typeof body !== "string") return [];
  const prose = body.replace(FENCED, " ").replace(INLINE, " ");
  const seen = new Set();
  for (const match of prose.matchAll(CLOSING)) seen.add(Number(match[1]));
  return [...seen].sort((a, b) => a - b);
}

export function isDeliveringBase(baseRef) {
  return baseRef === "dev" || baseRef === "main";
}

const defaultRun = (command, args) =>
  execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

export function closeReferencedIssues({
  refs,
  prNumber,
  baseRef,
  run = defaultRun,
  out = () => {},
}) {
  const summary = { closed: [], alreadyClosed: [], failed: [] };
  for (const issue of refs) {
    let state;
    try {
      state = run("gh", ["issue", "view", String(issue), "--json", "state"]).trim();
    } catch (error) {
      summary.failed.push({ issue, error: String(error?.message ?? error) });
      out(`issue #${issue}: could not read state`);
      continue;
    }
    if (state.includes("CLOSED")) {
      summary.alreadyClosed.push(issue);
      out(`issue #${issue}: already closed`);
      continue;
    }
    try {
      run("gh", [
        "issue",
        "close",
        String(issue),
        "--reason",
        "completed",
        "--comment",
        `Delivered by merged PR #${prNumber} into \`${baseRef}\`.`,
      ]);
      summary.closed.push(issue);
      out(`issue #${issue}: closed`);
    } catch (error) {
      summary.failed.push({ issue, error: String(error?.message ?? error) });
      out(`issue #${issue}: close failed`);
    }
  }
  return summary;
}

export function main(environment = process.env, deps = {}) {
  const { run = defaultRun, out = (line) => console.log(line) } = deps;
  const merged = environment.PR_MERGED === "true";
  const prNumber = Number(environment.PR_NUMBER ?? "");
  const baseRef = environment.PR_BASE_REF ?? "";
  const refs = parseIssueReferences(environment.PR_BODY ?? "");

  if (!merged) {
    out("pull request not merged: nothing to close");
    return 0;
  }
  if (!isDeliveringBase(baseRef)) {
    out(`base ${baseRef || "(unknown)"} is not a delivering branch: nothing to close`);
    return 0;
  }
  if (!Number.isInteger(prNumber) || prNumber <= 0) {
    out("no pull request number: nothing to close");
    return 1;
  }
  if (refs.length === 0) {
    out("no closing references in the pull request body");
    return 0;
  }

  const summary = closeReferencedIssues({ refs, prNumber, baseRef, run, out });
  out(
    `closed ${summary.closed.length}, already closed ${summary.alreadyClosed.length}, failed ${summary.failed.length}`,
  );
  return summary.failed.length === 0 ? 0 : 1;
}

if (process.argv[1] !== undefined && import.meta.filename === process.argv[1]) {
  process.exitCode = main();
}
