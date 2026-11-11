import type { ConstructionProject } from "@bluewave/campaign";
import { transitionConstructionProject } from "@bluewave/campaign";

const monthOrdinal = (month: string): number => {
  const [year, number] = month.split("-");
  return Number(year) * 12 + Number(number) - 1;
};

export function withConstructionDelay(
  project: ConstructionProject,
  months: number,
  reasonCode: string,
  month: string,
): ConstructionProject {
  return {
    ...transitionConstructionProject(project, "DELAYED"),
    delayReasonCode: reasonCode,
    delays: [...(project.delays ?? []), { month, reasonCode, months }],
  };
}

export function constructionDelayHeld(project: ConstructionProject, month: string): boolean {
  const latest = project.delays?.[project.delays.length - 1];
  if (latest === undefined || project.delayReasonCode !== latest.reasonCode) return false;
  return monthOrdinal(month) < monthOrdinal(latest.month) + latest.months - 1;
}
