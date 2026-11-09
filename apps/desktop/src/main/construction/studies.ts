import type { ConstructionStudyEntry } from "../../shared/construction-contract.js";

export interface StudySourceNation {
  readonly designStudies?:
    | readonly {
        readonly designStudyId: string;
        readonly status: string;
        readonly finalStudyWork: number;
        readonly workDone: number;
        readonly finalStudyCost: number;
        readonly costPaid: number;
        readonly design: { readonly designVersionId: string; readonly className: string };
      }[]
    | undefined;
}

function monthAfter(month: string, months: number): string {
  const [year, calendarMonth] = month.split("-").map(Number) as [number, number];
  const index = year * 12 + (calendarMonth - 1) + months;
  return `${String(Math.floor(index / 12))}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export function openStudies(
  nation: StudySourceNation | undefined,
  month: string,
): ConstructionStudyEntry[] {
  return (nation?.designStudies ?? [])
    .filter((study) => study.status === "IN_PROGRESS")
    .map((study) => {
      const monthsRemaining = study.finalStudyWork - study.workDone;
      return {
        designStudyId: study.designStudyId,
        designVersionId: study.design.designVersionId,
        className: study.design.className,
        monthsRemaining,
        costRemaining: Number(study.finalStudyCost) - Number(study.costPaid),
        readyMonth: monthAfter(month, monthsRemaining),
      };
    });
}
