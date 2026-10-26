import { ExplanationBuilder, type ExplanationTree } from "@bluewave/events";

export const CONSTRUCTION_FORMULA_VERSION = "construction_v1";

const SOURCE = { kind: "code", ref: "packages/campaign-engine/src/construction.ts" } as const;
const UNIT_WORK = "nc";

export function explainConstructionSchedule(
  totalCostUnits: number,
  completedWork: number,
  monthlyInstalmentUnits: number,
  remainingMonths: number,
): ExplanationTree {
  const remainingWork = Math.max(0, totalCostUnits - completedWork);
  return new ExplanationBuilder("construction_schedule", CONSTRUCTION_FORMULA_VERSION)
    .withInput("totalCostUnits", totalCostUnits)
    .withInput("completedWork", completedWork)
    .withIntermediate("remainingWork", remainingWork)
    .withInput("monthlyInstalmentUnits", monthlyInstalmentUnits)
    .withResult(remainingMonths)
    .withUnit("months")
    .withOperation("divide")
    .withSource(SOURCE)
    .addChild(
      new ExplanationBuilder("construction_schedule.remainingWork", CONSTRUCTION_FORMULA_VERSION)
        .withInput("amount", remainingWork)
        .withResult(remainingWork)
        .withUnit(UNIT_WORK)
        .withSource(SOURCE)
        .build(),
    )
    .addChild(
      new ExplanationBuilder("construction_schedule.instalment", CONSTRUCTION_FORMULA_VERSION)
        .withInput("amount", monthlyInstalmentUnits)
        .withResult(monthlyInstalmentUnits)
        .withUnit(UNIT_WORK)
        .withSource(SOURCE)
        .build(),
    )
    .build();
}
