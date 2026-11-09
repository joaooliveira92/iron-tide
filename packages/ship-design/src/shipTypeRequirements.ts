import {
  isClassifiedShipType,
  isProtectedCruiser,
  type ClassFacts,
  type ClassificationRules,
  type ClassRuleField,
} from "./classificationRules.js";
import type { ShipTypeId } from "./shipTypes.js";
import { UM_PER_INCH, UM_PER_KNOT } from "./units.js";

export type RequirementBound = "atLeast" | "above" | "atMost" | "below";
export type RequirementUnit = "t" | "kn" | "in" | "count" | "merchantHull";

export interface ShipTypeRequirement {
  readonly field: ClassRuleField;
  readonly bound: RequirementBound;
  readonly value: number;
  readonly unit: RequirementUnit;
  readonly limit: number;
}

export type ShipTypeRequirements =
  | { readonly status: "CLASSIFIED"; readonly rows: readonly ShipTypeRequirement[] }
  | { readonly status: "UNCLASSIFIED" };

export interface ShipTypeRequirementCheck extends ShipTypeRequirement {
  readonly current: number;
  readonly met: boolean;
}

type FactKey = keyof ClassFacts;

interface Spec {
  readonly field: ClassRuleField;
  readonly fact: FactKey;
  readonly bound: RequirementBound;
  readonly limit: number;
}

const FIELD_UNIT: Readonly<Record<ClassRuleField, RequirementUnit>> = {
  displacement: "t",
  speed: "kn",
  belt: "in",
  qualifyingArmour: "in",
  mainGun: "in",
  turrets: "count",
  torpedoes: "count",
  aircraft: "count",
  hull: "merchantHull",
};

const PER_UNIT: Readonly<Record<RequirementUnit, number>> = {
  t: 1000,
  kn: UM_PER_KNOT,
  in: UM_PER_INCH,
  count: 1,
  merchantHull: 1,
};

const display = (raw: number, unit: RequirementUnit): number =>
  Math.round((raw * 100) / PER_UNIT[unit]) / 100;

const spec = (
  field: ClassRuleField,
  fact: FactKey,
  bound: RequirementBound,
  limit: number,
): Spec => ({ field, fact, bound, limit });

const specsFor = (id: string, r: ClassificationRules): readonly Spec[] | null => {
  switch (id) {
    case "DD":
      return [
        spec("displacement", "displacementKg", "below", r.ddMaxDisplacementKg),
        spec("speed", "speedUms", "above", r.ddMinSpeedUms),
        spec("torpedoes", "torpedoTubes", "atLeast", 1),
        spec("qualifyingArmour", "anyQualifyingArmourUm", "below", r.qualifyingArmourUm),
        spec("mainGun", "maxGunUm", "atMost", r.ddMaxGunUm),
        spec("aircraft", "aircraftCapacity", "atMost", 0),
      ];
    case "CL":
      return [
        spec("displacement", "displacementKg", "atLeast", r.clMinDisplacementKg),
        spec("displacement", "displacementKg", "below", r.clMaxDisplacementKg),
        spec("speed", "speedUms", "above", r.clMinSpeedUms),
        spec("mainGun", "maxMainGunUm", "atMost", r.clMaxGunUm),
        spec("belt", "beltUm", "atMost", r.clBeltMaxUm),
        spec("aircraft", "aircraftCapacity", "below", r.aircraftLimit),
      ];
    case "CA":
      return [
        spec("displacement", "displacementKg", "above", r.caMinDisplacementKg),
        spec("speed", "speedUms", "above", r.caMinSpeedUms),
        spec("belt", "beltUm", "above", r.caBeltMinUm),
        spec("belt", "beltUm", "atMost", r.caBeltMaxUm),
        spec("mainGun", "maxMainGunUm", "above", r.clMaxGunUm),
        spec("mainGun", "maxMainGunUm", "atMost", r.caGunMaxUm),
        spec("aircraft", "aircraftCapacity", "below", r.aircraftLimit),
      ];
    case "B":
      return [
        spec("displacement", "displacementKg", "atLeast", r.bMinDisplacementKg),
        spec("belt", "beltUm", "atLeast", r.bBeltMinUm),
        spec("mainGun", "maxMainGunUm", "above", r.clMaxGunUm),
        spec("speed", "speedUms", "below", r.bMaxSpeedUms),
        spec("turrets", "mainTurretCount", "atLeast", 1),
        spec("turrets", "mainTurretCount", "atMost", r.bMaxTurrets),
        spec("aircraft", "aircraftCapacity", "below", r.aircraftLimit),
      ];
    case "BB":
      return [
        spec("displacement", "displacementKg", "above", r.bbMinDisplacementKg),
        spec("turrets", "mainTurretCount", "atLeast", r.bbMinTurrets),
        spec("belt", "beltUm", "above", r.bbBeltMinUm),
        spec("mainGun", "maxMainGunUm", "above", r.bbGunMinUm),
        spec("aircraft", "aircraftCapacity", "below", r.aircraftLimit),
      ];
    case "KE":
      return [
        spec("displacement", "displacementKg", "below", r.keMaxDisplacementKg),
        spec("belt", "beltUm", "atMost", r.keBeltMaxUm),
        spec("mainGun", "maxGunUm", "atMost", r.keGunMaxUm),
        spec("torpedoes", "torpedoTubes", "atMost", 0),
        spec("aircraft", "aircraftCapacity", "atMost", 0),
      ];
    case "AMC":
      return [
        spec("hull", "merchantHull", "atLeast", 1),
        spec("displacement", "displacementKg", "above", r.amcMinDisplacementKg),
        spec("qualifyingArmour", "anyQualifyingArmourUm", "below", r.qualifyingArmourUm),
        spec("mainGun", "maxGunUm", "atMost", r.amcGunMaxUm),
        spec("aircraft", "aircraftCapacity", "below", r.aircraftLimit),
      ];
    default:
      return null;
  }
};

const rowOf = (s: Spec): ShipTypeRequirement => {
  const unit = FIELD_UNIT[s.field];
  return {
    field: s.field,
    bound: s.bound,
    value: display(s.limit, unit),
    unit,
    limit: s.limit,
  };
};

const holds = (bound: RequirementBound, current: number, limit: number): boolean => {
  switch (bound) {
    case "atLeast":
      return current >= limit;
    case "above":
      return current > limit;
    case "atMost":
      return current <= limit;
    case "below":
      return current < limit;
  }
};

export function shipTypeRequirements(id: ShipTypeId, r: ClassificationRules): ShipTypeRequirements {
  const specs = isClassifiedShipType(id) ? specsFor(id, r) : null;
  return specs === null
    ? { status: "UNCLASSIFIED" }
    : { status: "CLASSIFIED", rows: specs.map(rowOf) };
}

export function checkShipTypeRequirements(
  id: ShipTypeId,
  r: ClassificationRules,
  facts: ClassFacts,
): readonly ShipTypeRequirementCheck[] {
  const specs = isClassifiedShipType(id) ? specsFor(id, r) : null;
  if (specs === null) return [];
  return specs.map((s) => {
    const raw = Number(facts[s.fact]);
    const exempt = id === "CL" && s.field === "mainGun" && isProtectedCruiser(facts, r);
    return {
      ...rowOf(s),
      current: display(raw, FIELD_UNIT[s.field]),
      met: exempt || holds(s.bound, raw, s.limit),
    };
  });
}
