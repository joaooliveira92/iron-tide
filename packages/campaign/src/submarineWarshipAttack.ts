import { SafeInt } from "@bluewave/contracts";
import type { SubmarinePolicy } from "./submarinePolicy.js";

const BP_DENOMINATOR = SafeInt(10_000);

export interface WarshipAttackRules {
  readonly attackBp: number;
  readonly policyMultiplierBp: Readonly<Record<SubmarinePolicy, number>>;
  readonly screenReductionBp: number;
  readonly sunkBp: number;
  readonly maxDamageBp: number;
  readonly heavyHullTypes: readonly string[];
  readonly screenHullTypes: readonly string[];
}

export function warshipScreenRatioBp(freeScreenShips: number, heavyShips: number): number {
  if (heavyShips <= 0 || freeScreenShips <= 0) return 0;
  return Math.min(
    10_000,
    SafeInt.div(
      SafeInt.mul(SafeInt(freeScreenShips), BP_DENOMINATOR),
      SafeInt(heavyShips),
      "floor",
    ),
  );
}

export function warshipAttackChanceBp(
  rules: WarshipAttackRules,
  policy: SubmarinePolicy,
  screenRatioBp: number,
): number {
  const policyBp = SafeInt.div(
    SafeInt.mul(SafeInt(rules.attackBp), SafeInt(rules.policyMultiplierBp[policy])),
    BP_DENOMINATOR,
    "floor",
  );
  const reductionBp = SafeInt.div(
    SafeInt.mul(SafeInt(rules.screenReductionBp), SafeInt(Math.min(10_000, screenRatioBp))),
    BP_DENOMINATOR,
    "floor",
  );
  const screenedBp = SafeInt.div(
    SafeInt.mul(policyBp, SafeInt.sub(BP_DENOMINATOR, reductionBp)),
    BP_DENOMINATOR,
    "floor",
  );
  return Math.min(10_000, screenedBp);
}
