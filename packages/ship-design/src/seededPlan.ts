import { historicalBuildMonths, type ConstructionBalance, type LineId } from "./construction.js";
import { scalePlanToUnits } from "./constructionProgress.js";

export interface SeededPackage {
  readonly id: string;
  readonly kind: "HULL" | "LAUNCH" | "FIT_OUT" | "TRIALS" | "ACCEPTANCE";
  readonly line: LineId;
  readonly totalWork: number;
  readonly doneWork: number;
  readonly dependsOn: readonly string[];
}

export interface SeededConstructionPlan {
  readonly packages: readonly SeededPackage[];
  readonly capacityUnits: Readonly<Record<LineId, number>>;
}

export interface SeededPlanInput {
  readonly displacementKg: number;
  readonly totalUnits: number;
  readonly completedUnits: number;
  readonly balance: ConstructionBalance;
  readonly month: string;
}

const BP = 10_000;
const shareOf = (value: number, bp: number): number => Math.floor((value * bp) / BP);

export function seededConstructionPlan(input: SeededPlanInput): SeededConstructionPlan {
  const { balance } = input;
  if (!Number.isSafeInteger(input.totalUnits) || input.totalUnits <= 0)
    throw new RangeError(`totalUnits must be a positive integer, got ${String(input.totalUnits)}`);
  const completed = Math.min(Math.max(0, Math.floor(input.completedUnits)), input.totalUnits);

  const hull = BP;
  const launch = shareOf(hull, balance.launchHullShareBp);
  const fitOut = shareOf(hull, balance.fitOutHullShareBp);
  const sum = hull + launch + fitOut;
  const trials = shareOf(sum, balance.trialsShareBp);
  const acceptance = shareOf(sum, balance.acceptanceShareBp);
  const weights = [
    { id: "hull", kind: "HULL", line: "slipway", dependsOn: [] as string[], work: hull },
    { id: "launch", kind: "LAUNCH", line: "slipway", dependsOn: ["hull"], work: launch },
    { id: "fit_out", kind: "FIT_OUT", line: "quay", dependsOn: ["launch"], work: fitOut },
    { id: "trials", kind: "TRIALS", line: "trials", dependsOn: ["fit_out"], work: trials },
    {
      id: "acceptance",
      kind: "ACCEPTANCE",
      line: "trials",
      dependsOn: ["trials"],
      work: acceptance,
    },
  ] as const;
  const scaled = scalePlanToUnits(
    {
      packages: weights.map((w) => ({
        id: w.id,
        kind: w.kind,
        line: w.line,
        totalWork: Math.max(1, w.work),
        dependsOn: w.dependsOn,
      })),
      totalWork: weights.reduce((a, w) => a + Math.max(1, w.work), 0),
    },
    input.totalUnits,
  );

  let remaining = completed;
  const packages: SeededPackage[] = scaled.packages.map((p) => {
    const done = Math.min(p.totalWork, remaining);
    remaining -= done;
    return {
      id: p.id,
      kind: p.kind as SeededPackage["kind"],
      line: p.line,
      totalWork: p.totalWork,
      doneWork: done,
      dependsOn: p.dependsOn,
    };
  });

  const months = historicalBuildMonths(input.displacementKg, balance, { month: input.month });
  const perMonth = Math.max(1, Math.ceil(input.totalUnits / months));
  const used = new Set(packages.map((p) => p.line));
  const capacityUnits = {
    slipway: 0,
    armour_plate: 0,
    heavy_gun: 0,
    machinery: 0,
    quay: 0,
    trials: 0,
  } satisfies Record<LineId, number>;
  for (const line of used) capacityUnits[line] = perMonth;
  return { packages, capacityUnits };
}
