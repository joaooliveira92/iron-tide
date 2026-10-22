import type { GunneryEventRecord } from "@bluewave/combat/gunnery";
import { neutralAccuracyFactors } from "@bluewave/combat/gunnery";
import { neutralRateFactors } from "@bluewave/combat/gunnery";

export function makeGunneryHitRecord(opts: {
  battleId?: string;
  minute?: number;
  batteryId?: string;
  targetContactId?: string;
}): GunneryEventRecord {
  const battleId = opts.battleId ?? "b1";
  const minute = opts.minute ?? 1;
  const batteryId = opts.batteryId ?? "a1:MAIN";
  const targetContactId = opts.targetContactId ?? `${battleId}:d1`;
  return {
    eventId: `${battleId}:${minute}:2:gunnery_salvo:${batteryId}:${targetContactId}`,
    battleId,
    minute,
    substep: 2,
    batteryId,
    shooterId: batteryId,
    targetContactId,
    commandSource: "CENTRAL",
    fireMode: "NORMAL",
    ammunition: { type: "ARMOR_PIERCING", rounds: 1, before: 10, after: 9 },
    accuracy: {
      factorKeys: [],
      factors: neutralAccuracyFactors(10_000),
      finalAccuracyBp: 10_000,
      rounding: { mode: "floor", numerator: "10000", denominator: "1", rawFlooredBp: 10_000 },
    },
    rate: {
      factorKeys: [],
      factors: neutralRateFactors(),
      effectiveReloadMs: 60_000,
      rounding: {
        mode: "ceil",
        numerator: "60000",
        denominator: "1",
        appliedCount: 0,
        rawCeiledMs: 60_000,
      },
    },
    randomDecisions: [],
    impactInputs: null,
    outcome: "HIT",
    damageEventRefs: [],
    formulaVersion: "gunnery_formula_v1",
    rulesetVersion: "gunnery_ruleset_v1",
    eventHash: "fixture-event-hash",
  };
}
