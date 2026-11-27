import { SafeInt } from "@bluewave/contracts";
import type { ShipReadinessState } from "./readiness.js";
import type { BlockadeState } from "./state.js";

const BP_DENOMINATOR = SafeInt(10_000);

export interface AmcSurpriseRules {
  readonly chanceBp: number;
  readonly startRangeM: number;
}

export interface RaiderInterceptionRules {
  readonly amcSurprise?: AmcSurpriseRules;
  readonly maxInterceptors?: number;
  readonly interceptBaseBp: number;
  readonly interceptPatrolBp: number;
  readonly breakoutInterceptBp: number;
  readonly raiderSunkBp: number;
  readonly maxEngagementDamageBp: number;
  readonly scuttleThresholdBp: number;
  readonly scuttleShareBp: number;
  readonly fuelInternBp: number;
  readonly breakdownInternBp: number;
}

export type InternmentCause = "FUEL_EXHAUSTION" | "BREAKDOWN" | "DAMAGE";

export interface ShipInternment {
  readonly sinceMonth: string;
  readonly cause: InternmentCause;
  readonly readinessBefore: ShipReadinessState;
}

export type EngagementOutcome =
  | { readonly kind: "SUNK" }
  | {
      readonly kind: "SURVIVED";
      readonly damageBp: number;
      readonly hitPointsAfter: number;
      readonly heavilyDamaged: boolean;
    };

function scaleBp(value: number, factorBp: number): number {
  return SafeInt.div(SafeInt.mul(SafeInt(value), SafeInt(factorBp)), BP_DENOMINATOR, "floor");
}

export function patrolCoverageBp(quota: number, assigned: number): number {
  if (quota <= 0) return 0;
  return Math.min(
    10_000,
    SafeInt.div(SafeInt.mul(SafeInt(assigned), BP_DENOMINATOR), SafeInt(quota), "floor"),
  );
}

export function interceptionChanceBp(
  rules: RaiderInterceptionRules,
  patrolCoverage: number,
): number {
  return Math.min(
    10_000,
    SafeInt.add(
      SafeInt(rules.interceptBaseBp),
      SafeInt(scaleBp(patrolCoverage, rules.interceptPatrolBp)),
    ),
  );
}

export function breakoutRequired(
  blockades: readonly Pick<BlockadeState, "blockaderId" | "blockadedNationId">[],
  raiderNationId: string,
): boolean {
  return blockades.some((blockade) => blockade.blockadedNationId === raiderNationId);
}

export type DamageOutcome =
  | { readonly kind: "SUNK" }
  | { readonly kind: "DAMAGED"; readonly damageBp: number; readonly hitPointsAfter: number };

export function damageOutcome(
  sunkBp: number,
  maxDamageBp: number,
  draw: number,
  hitPoints: number,
  maxHitPoints: number,
): DamageOutcome {
  if (draw < sunkBp) return { kind: "SUNK" };
  const survivorRange = SafeInt.sub(BP_DENOMINATOR, SafeInt(sunkBp));
  const position = SafeInt.sub(SafeInt(draw), SafeInt(sunkBp));
  const damageBp = SafeInt.div(SafeInt.mul(position, SafeInt(maxDamageBp)), survivorRange, "floor");
  const hitPointsAfter = Math.max(0, hitPoints - scaleBp(maxHitPoints, damageBp));
  return { kind: "DAMAGED", damageBp, hitPointsAfter };
}

export function engagementOutcome(
  rules: RaiderInterceptionRules,
  draw: number,
  hitPoints: number,
  maxHitPoints: number,
): EngagementOutcome {
  const outcome = damageOutcome(
    rules.raiderSunkBp,
    rules.maxEngagementDamageBp,
    draw,
    hitPoints,
    maxHitPoints,
  );
  if (outcome.kind === "SUNK") return outcome;
  return {
    kind: "SURVIVED",
    damageBp: outcome.damageBp,
    hitPointsAfter: outcome.hitPointsAfter,
    heavilyDamaged: isHeavilyDamaged(rules, outcome.hitPointsAfter, maxHitPoints),
  };
}

export function isHeavilyDamaged(
  rules: RaiderInterceptionRules,
  hitPoints: number,
  maxHitPoints: number,
): boolean {
  const strengthBp =
    maxHitPoints <= 0
      ? 0
      : SafeInt.div(
          SafeInt.mul(SafeInt(hitPoints), BP_DENOMINATOR),
          SafeInt(maxHitPoints),
          "floor",
        );
  return strengthBp <= rules.scuttleThresholdBp;
}

export function damageShareBp(lossHitPoints: number, maxHitPoints: number): number {
  if (maxHitPoints <= 0 || lossHitPoints <= 0) return 0;
  return Math.min(
    10_000,
    SafeInt.div(
      SafeInt.mul(SafeInt(lossHitPoints), BP_DENOMINATOR),
      SafeInt(maxHitPoints),
      "floor",
    ),
  );
}

export function heavilyDamagedDisposition(
  rules: RaiderInterceptionRules,
  draw: number,
): "SCUTTLED" | "INTERNED" {
  return draw < rules.scuttleShareBp ? "SCUTTLED" : "INTERNED";
}

export function internmentCause(
  rules: RaiderInterceptionRules,
  draw: number,
): "FUEL_EXHAUSTION" | "BREAKDOWN" | undefined {
  if (draw < rules.fuelInternBp) return "FUEL_EXHAUSTION";
  if (draw < SafeInt.add(SafeInt(rules.fuelInternBp), SafeInt(rules.breakdownInternBp)))
    return "BREAKDOWN";
  return undefined;
}
