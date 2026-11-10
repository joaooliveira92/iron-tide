import { closeSync, openSync, readSync } from "node:fs";

const PROTECTED_BRANCHES = new Set(["dev", "main"]);
const TRANSCRIPT_HEAD_BYTES = 65_536;
const FIRST_TIMESTAMP = /"timestamp":"(\d{4}-\d{2}-\d{2}T[0-9:.]+Z)"/u;

export function sessionStartIso(transcriptPath) {
  if (typeof transcriptPath !== "string" || transcriptPath === "") return null;
  let fd;
  try {
    fd = openSync(transcriptPath, "r");
    const buffer = Buffer.alloc(TRANSCRIPT_HEAD_BYTES);
    const bytes = readSync(fd, buffer, 0, TRANSCRIPT_HEAD_BYTES, 0);
    const match = FIRST_TIMESTAMP.exec(buffer.toString("utf8", 0, bytes));
    return match === null ? null : match[1];
  } catch {
    return null;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

export function evaluateStop({ hookActive, branch, dirtyPaths, unpushedCommits }) {
  if (hookActive) return { action: "allow" };
  const problems = [];
  if (dirtyPaths > 0) problems.push(`${dirtyPaths} uncommitted path(s)`);
  if (unpushedCommits > 0) {
    problems.push(`${unpushedCommits} unpushed commit(s) on ${branch || "a detached HEAD"}`);
  }
  if (problems.length === 0) return { action: "allow" };
  const where = PROTECTED_BRANCHES.has(branch)
    ? ` Do not commit on ${branch}: branch off it first.`
    : "";
  return {
    action: "block",
    message: `stop-gate: ${problems.join(" and ")}. Commit and push, then open or update the draft PR, or end the turn with a BLOCKED report naming the reason.${where}`,
  };
}

export function parseStatusCount(porcelain) {
  return porcelain.split("\n").filter((line) => line.trim() !== "").length;
}
