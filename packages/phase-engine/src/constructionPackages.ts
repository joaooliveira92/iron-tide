import type { ConstructionProject } from "@bluewave/campaign";

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
