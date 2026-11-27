import type { SubmarinePolicy } from "@bluewave/campaign";

export interface WarshipAttackRules {
  readonly attackBp: number;
  readonly policyMultiplierBp: Readonly<Record<SubmarinePolicy, number>>;
  readonly screenReductionBp: number;
  readonly sunkBp: number;
  readonly maxDamageBp: number;
  readonly heavyHullTypes: readonly string[];
  readonly screenHullTypes: readonly string[];
}

export type WarshipDamage =
  | { readonly kind: "SUNK" }
  | { readonly kind: "DAMAGED"; readonly damageBp: number; readonly hitPointsAfter: number };

const BP = 10_000;

const isBp = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= BP;

const isHullList = (value: unknown): value is readonly string[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((entry) => typeof entry === "string" && entry.length > 0);

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

function isWarshipAttackRules(value: unknown): value is WarshipAttackRules {
  if (!isRecord(value)) return false;
  const multipliers = value["policyMultiplierBp"];
  return (
    isBp(value["attackBp"]) &&
    isBp(value["screenReductionBp"]) &&
    isBp(value["sunkBp"]) &&
    isBp(value["maxDamageBp"]) &&
    isHullList(value["heavyHullTypes"]) &&
    isHullList(value["screenHullTypes"]) &&
    isRecord(multipliers) &&
    Number.isSafeInteger(multipliers["FLEET_SUPPORT"]) &&
    Number.isSafeInteger(multipliers["PRIZE_RULES"]) &&
    Number.isSafeInteger(multipliers["UNRESTRICTED"])
  );
}

export function warshipAttackRulesOf(threat: object | undefined): WarshipAttackRules | undefined {
  if (threat === undefined || !("warshipAttack" in threat)) return undefined;
  const block = threat.warshipAttack;
  return isWarshipAttackRules(block) ? block : undefined;
}

export function warshipScreenRatioBp(freeDestroyers: number, heavies: number): number {
  if (heavies <= 0) return BP;
  return Math.min(BP, Math.floor((freeDestroyers * BP) / heavies));
}

export function warshipAttackChanceBp(
  rules: WarshipAttackRules,
  policy: SubmarinePolicy,
  screenRatioBp: number,
): number {
  const weighted = Math.floor((rules.attackBp * rules.policyMultiplierBp[policy]) / BP);
  const reduction = Math.floor((rules.screenReductionBp * screenRatioBp) / BP);
  return Math.min(BP, Math.floor((weighted * (BP - reduction)) / BP));
}

export function warshipDamage(
  rules: Pick<WarshipAttackRules, "sunkBp" | "maxDamageBp">,
  draw: number,
  hitPoints: number,
  maxHitPoints: number,
): WarshipDamage {
  if (draw < rules.sunkBp) return { kind: "SUNK" };
  const damageBp = Math.floor(((draw - rules.sunkBp) * rules.maxDamageBp) / (BP - rules.sunkBp));
  const hitPointsAfter = Math.max(0, hitPoints - Math.floor((maxHitPoints * damageBp) / BP));
  return { kind: "DAMAGED", damageBp, hitPointsAfter };
}
