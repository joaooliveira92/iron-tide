import type { ConstructionProject } from "@bluewave/campaign";

/**
 * Consistency problems of a project's per-package progress (ADR-0077), as readable messages; empty when the project has no
 * packages (the single-figure model) or they are all consistent. Pure.
 *
 * A project with packages must satisfy: unique package ids; every dependency names a package; each package's done work is
 * within 0..total; the totals add up to the project's `totalWork`; and the done work adds up to its `completedWork`.
 */
export function constructionPackageProblems(project: ConstructionProject): string[] {
  const packages = project["packages"];
  if (packages === undefined) return [];
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const p of packages) {
    if (ids.has(p["id"])) problems.push(`package ${p["id"]} is listed twice`);
    ids.add(p["id"]);
  }
  let total = 0;
  let done = 0;
  for (const p of packages) {
    for (const dep of p["dependsOn"])
      if (!ids.has(dep)) problems.push(`package ${p["id"]} depends on unknown package ${dep}`);
    const t = p["totalWork"] as number;
    const d = p["doneWork"] as number;
    if (d < 0) problems.push(`package ${p["id"]} has negative work done (${d})`);
    if (d > t) problems.push(`package ${p["id"]} has more work done (${d}) than total (${t})`);
    total += t;
    done += d;
  }
  if (total !== (project["totalWork"] as number))
    problems.push(
      `package totals (${total}) differ from the project's totalWork (${String(project["totalWork"])})`,
    );
  if (done !== (project["completedWork"] as number))
    problems.push(
      `package work done (${done}) differs from the project's completedWork (${String(project["completedWork"])})`,
    );
  return problems;
}
