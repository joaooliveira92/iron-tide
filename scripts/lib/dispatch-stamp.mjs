import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const STAMP_FILE = "dispatch-stamps.json";
const MINUTE_MS = 60_000;
const ISSUE_PATTERN = /(?:#|\bissue\s+)(\d+)\b/giu;
const GATED_ROLE = "implementation";

export function readStamps(dir) {
  try {
    const parsed = JSON.parse(readFileSync(join(dir, STAMP_FILE), "utf8"));
    return parsed !== null && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function recordStamps(dir, verdicts, nowMs) {
  const stamps = readStamps(dir);
  for (const { number, verdict } of verdicts) stamps[String(number)] = { verdict, at: nowMs };
  mkdirSync(dir, { recursive: true });
  const temp = join(dir, `${STAMP_FILE}.${process.pid}.tmp`);
  writeFileSync(temp, JSON.stringify(stamps));
  renameSync(temp, join(dir, STAMP_FILE));
}

export function issuesNamed(title) {
  const numbers = [];
  for (const match of String(title).matchAll(ISSUE_PATTERN)) {
    const number = Number(match[1]);
    if (!numbers.includes(number)) numbers.push(number);
  }
  return numbers;
}

export function unstamped(dir, issues, nowMs, maxAgeMs) {
  const stamps = readStamps(dir);
  return issues.filter((number) => {
    const stamp = stamps[String(number)];
    const age = typeof stamp?.at === "number" ? nowMs - stamp.at : Number.POSITIVE_INFINITY;
    return !(age >= 0 && age <= maxAgeMs);
  });
}

function hasOverride(text, policy) {
  const index = text.indexOf(policy.dispatchOverrideToken);
  if (index === -1) return false;
  const rest = text.slice(index + policy.dispatchOverrideToken.length).split("\n")[0];
  return rest.trim().length >= policy.overrideMinReasonChars;
}

export function evaluateDelegation({ input, policy, dir, nowMs }) {
  if (input?.role !== GATED_ROLE) return { decision: "allow" };
  const issues = issuesNamed(input.title ?? "");
  if (issues.length === 0) return { decision: "allow" };
  if (hasOverride(`${input.title}\n${input.task ?? ""}`, policy)) return { decision: "allow" };
  const missing = unstamped(dir, issues, nowMs, policy.dispatchStampMaxMinutes * MINUTE_MS);
  if (missing.length === 0) return { decision: "allow" };
  return {
    decision: "block",
    message: `dispatch-check not run for ${missing.map((n) => `#${n}`).join(", ")} in the last ${policy.dispatchStampMaxMinutes} min. Run \`pnpm dispatch:check ${missing.join(" ")}\`, act on STALE, CLAIMED or NEEDS-DECISION, then delegate. To delegate anyway, add \`${policy.dispatchOverrideToken} <reason>\` to the task.`,
  };
}
