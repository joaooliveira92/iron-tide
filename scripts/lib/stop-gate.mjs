const PROTECTED_BRANCHES = new Set(["dev", "main"]);

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
