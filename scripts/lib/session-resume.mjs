import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const BRIEF_DIR = ".ai/briefs";
const HANDOFF_FILE = /^handoff-.+\.md$/u;
const ISSUE_SUFFIX = /-(\d{3,})(?=-|$)/gu;

function issueNumbers(text) {
  return new Set([...text.matchAll(ISSUE_SUFFIX)].map((match) => match[1]));
}

export function matchBrief(branch, briefNames) {
  if (typeof branch !== "string" || branch === "") return null;
  const branchIssues = issueNumbers(branch);
  for (const name of briefNames) {
    if (!name.endsWith(".md")) continue;
    const slug = name.slice(0, -3);
    const shared = [...issueNumbers(slug)].some((n) => branchIssues.has(n));
    if (branch.includes(slug) || shared) return `${BRIEF_DIR}/${name}`;
  }
  return null;
}

export function latestHandoff(dir, { nowMs = Date.now(), maxAgeMs = Infinity } = {}) {
  let names;
  try {
    names = readdirSync(dir).filter((name) => HANDOFF_FILE.test(name));
  } catch {
    return null;
  }
  let best = null;
  let bestMs = -1;
  for (const name of names) {
    try {
      const ms = statSync(join(dir, name)).mtimeMs;
      if (ms > bestMs && nowMs - ms <= maxAgeMs) {
        best = join(dir, name);
        bestMs = ms;
      }
    } catch {
      continue;
    }
  }
  return best;
}

export function buildResumeContext({ branch, statusLines, brief, handoff, maxChars }) {
  const pointers = [];
  if (brief) pointers.push(`brief: ${brief}`);
  if (handoff) pointers.push(`handoff: ${handoff}`);
  const head = `branch: ${branch || "detached"}`;
  const fixed = [head, ...pointers].join("\n");
  const room = maxChars - fixed.length - "\nstatus: ".length - 1;
  const status = statusLines.length === 0 ? "clean" : statusLines.join("; ");
  const clipped = status.length <= room ? status : `${status.slice(0, Math.max(0, room - 1))}…`;
  return [head, `status: ${clipped}`, ...pointers].join("\n").slice(0, maxChars);
}
