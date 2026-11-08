import type { ConstructionPackage, MonthlyAbsorbableDetail } from "@bluewave/campaign";
import { CONSTRUCTION_LINE_IDS } from "@bluewave/campaign";
import { ExplanationBuilder, type ExplanationSource, type ExplanationTree } from "@bluewave/events";

export const CONSTRUCTION_FORMULA_VERSION = "construction_v2";

const SOURCE = { kind: "code", ref: "packages/campaign-engine/src/construction.ts" } as const;
const INSTALMENT_SOURCE = {
  kind: "code",
  ref: "packages/campaign/src/constructionDraw.ts",
} as const;
const UNIT_WORK = "nc";

function workChild(formulaId: string, amount: number, source: ExplanationSource): ExplanationTree {
  return new ExplanationBuilder(formulaId, CONSTRUCTION_FORMULA_VERSION)
    .withInput("amount", amount)
    .withResult(amount)
    .withUnit(UNIT_WORK)
    .withSource(source)
    .build();
}

export interface ConstructionScheduleTrace {
  readonly workByMonth: readonly number[];
  readonly acceleration?: {
    readonly workMultiplierBp: number;
    readonly timeBp: number;
    readonly monthsAccelerated: number;
  };
}

function monthlyWorkChild(remainingWork: number, workByMonth: readonly number[]): ExplanationTree {
  const builder = new ExplanationBuilder(
    "construction_schedule.monthly",
    CONSTRUCTION_FORMULA_VERSION,
  )
    .withIntermediate("monthCount", workByMonth.length)
    .withResult(remainingWork)
    .withUnit(UNIT_WORK)
    .withOperation("add")
    .withSource(INSTALMENT_SOURCE);
  let left = remainingWork;
  workByMonth.forEach((applied, offset) => {
    const work = Math.min(left, applied);
    left -= work;
    builder.addChild(
      new ExplanationBuilder("construction_schedule.month", CONSTRUCTION_FORMULA_VERSION)
        .withInput("monthOffset", offset)
        .withInput("amount", work)
        .withResult(work)
        .withUnit(UNIT_WORK)
        .withSource(INSTALMENT_SOURCE)
        .build(),
    );
  });
  return builder.build();
}

export function explainConstructionSchedule(
  totalCostUnits: number,
  completedWork: number,
  monthlyInstalmentUnits: number,
  remainingMonths: number,
  trace?: ConstructionScheduleTrace,
): ExplanationTree {
  const remainingWork = Math.max(0, totalCostUnits - completedWork);
  const builder = new ExplanationBuilder("construction_schedule", CONSTRUCTION_FORMULA_VERSION)
    .withInput("totalCostUnits", totalCostUnits)
    .withInput("completedWork", completedWork)
    .withIntermediate("remainingWork", remainingWork)
    .withInput("monthlyInstalmentUnits", monthlyInstalmentUnits)
    .withResult(remainingMonths)
    .withUnit("months")
    .withSource(SOURCE);
  if (trace === undefined) builder.withOperation("divide");
  else if (trace.acceleration !== undefined) {
    builder
      .withInput("workMultiplierBp", trace.acceleration.workMultiplierBp)
      .withInput("timeBp", trace.acceleration.timeBp)
      .withInput("monthsAccelerated", trace.acceleration.monthsAccelerated);
  }
  builder
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
    );
  if (trace !== undefined) builder.addChild(monthlyWorkChild(remainingWork, trace.workByMonth));
  return builder.build();
}

export function explainConstructionInstalment(detail: MonthlyAbsorbableDetail): ExplanationTree {
  const builder = new ExplanationBuilder("construction_instalment", CONSTRUCTION_FORMULA_VERSION)
    .withInput("remainingWork", detail.remainingWork)
    .withResult(detail.amount)
    .withUnit(UNIT_WORK)
    .withOperation("add")
    .withSource(INSTALMENT_SOURCE);
  for (const line of CONSTRUCTION_LINE_IDS) {
    const applied = detail.appliedByLine[line] ?? 0;
    if (applied !== 0) {
      builder.addChild(workChild(`construction_instalment.${line}`, applied, INSTALMENT_SOURCE));
    }
  }
  return builder.build();
}

export function explainConstructionCost(
  totalCostUnits: number,
  packages: readonly ConstructionPackage[],
): ExplanationTree | undefined {
  if (packages.length === 0) return undefined;
  const byLine = new Map<string, number>();
  for (const workPackage of packages) {
    byLine.set(
      workPackage.line,
      (byLine.get(workPackage.line) ?? 0) + Number(workPackage.totalWork),
    );
  }
  const builder = new ExplanationBuilder("construction_cost", CONSTRUCTION_FORMULA_VERSION)
    .withIntermediate("packageCount", packages.length)
    .withResult(totalCostUnits)
    .withUnit(UNIT_WORK)
    .withOperation("add")
    .withSource(SOURCE);
  for (const line of CONSTRUCTION_LINE_IDS) {
    const total = byLine.get(line) ?? 0;
    if (total !== 0) builder.addChild(workChild(`construction_cost.${line}`, total, SOURCE));
  }
  return builder.build();
}
