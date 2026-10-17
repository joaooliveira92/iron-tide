import type { CompiledDesignVersion } from "@bluewave/campaign";
import { BluewaveError, UM_PER_INCH } from "@bluewave/contracts";

// DESIGN-22 §1 canonical ship-type registry (14 types, precedence order).
export const CANONICAL_SHIP_TYPES = [
  "CV",
  "CVL",
  "AV",
  "SS",
  "MTB",
  "TR",
  "BB",
  "BC",
  "B",
  "CA",
  "CL",
  "DD",
  "KE",
  "AMC",
] as const;

export type CanonicalShipType = (typeof CANONICAL_SHIP_TYPES)[number];

// ADR B-1-2: classification is derived deterministically from the compiled
// design (versioned ruleset decision), never authored or inferred at runtime.
// v2 (ADR-0228, N-2): aligns the opening-era armoured families to the 1880
// scenario's ADR-0116 classification ruleset v2.
export const SHIP_TYPE_CLASSIFIER_VERSION = "ship_type_classifier_v2" as const;

export const InvalidShipType = "INVALID_SHIP_TYPE" as const;

// DESIGN-22 §2 canonical measurement constants.
const UMS_PER_KNOT = 514_444;

// ADR B-1-2 mapping. `CompiledDesignVersion` carries the compiled mechanical
// fields (displacement, speed, armor, guns) plus an authored `hullType`. Full
// numeric DESIGN-22 classification additionally requires turret count, aircraft
// capacity, and torpedo presence, which the compiled design does not expose.
// The versioned classifier therefore maps the authored hull-type family into the
// canonical registry, and applies the numeric boundaries that ARE available as a
// secondary guard. Changing classification is a versioned ruleset change.

interface HullFamily {
  canonical: CanonicalShipType;
  minDisplacementKg?: number;
  minArmorUm?: number;
  minCaliberUm?: number;
  maxSpeedUms?: number; // slow battle-line caps (B)
}

// N-2 / ADR-0228: the 1880 scenario authors classification ruleset version 2
// (content/production/1880/ship-building/balance.yaml `ship.classification`,
// decoded as DESIGN_22_EARLY), which lowers the DESIGN-22 "B" floor for slow,
// belted, heavy-gun opening-era hulls. The compiled design carries no ruleset
// pointer, so this guard repeats the ruleset-v2 opening band for the four
// opening-era families; the modern pre-dreadnought band is left at v1.
const OPENING_BAND: Omit<HullFamily, "canonical"> = {
  minDisplacementKg: 1_500_000,
  minArmorUm: 4 * UM_PER_INCH,
  minCaliberUm: 6 * UM_PER_INCH,
  maxSpeedUms: 18 * UMS_PER_KNOT,
};

const HULL_FAMILY_MAP: Record<string, HullFamily> = {
  battleship: {
    canonical: "BB",
    minDisplacementKg: 8_000_000,
    minArmorUm: 6 * UM_PER_INCH,
    minCaliberUm: 10 * UM_PER_INCH,
  },
  dreadnought: {
    canonical: "BB",
    minDisplacementKg: 8_000_000,
    minArmorUm: 6 * UM_PER_INCH,
    minCaliberUm: 10 * UM_PER_INCH,
  },
  super_dreadnought: {
    canonical: "BB",
    minDisplacementKg: 8_000_000,
    minArmorUm: 6 * UM_PER_INCH,
    minCaliberUm: 10 * UM_PER_INCH,
  },
  battlecruiser: {
    canonical: "BC",
    minDisplacementKg: 8_000_000,
    minArmorUm: 2 * UM_PER_INCH,
    minCaliberUm: 10 * UM_PER_INCH,
  },
  heavy_cruiser: {
    canonical: "CA",
    minDisplacementKg: 4_000_000,
    minArmorUm: 2 * UM_PER_INCH,
    minCaliberUm: 6 * UM_PER_INCH,
  },
  light_cruiser: { canonical: "CL", minDisplacementKg: 2_000_000, minCaliberUm: 6 * UM_PER_INCH },
  destroyer: { canonical: "DD" },
  // Opening-era families made by the ship designer (ADR-0088). The numeric guards repeat only the minimums the
  // compiled design exposes; the designer's own validator is the authority and has already run.
  pre_dreadnought: {
    canonical: "B",
    minDisplacementKg: 5_000_000,
    minArmorUm: 6 * UM_PER_INCH,
    minCaliberUm: 6 * UM_PER_INCH,
    maxSpeedUms: 20 * UMS_PER_KNOT,
  },
  armoured_cruiser: {
    canonical: "CA",
    minDisplacementKg: 4_000_000,
    minArmorUm: 2 * UM_PER_INCH,
    minCaliberUm: 6 * UM_PER_INCH,
  },
  protected_cruiser: { canonical: "CL", minDisplacementKg: 2_000_000 },
  corvette: { canonical: "KE" },
  armed_merchant_cruiser: { canonical: "AMC", minDisplacementKg: 1_700_000 },
  monitor: { canonical: "B", ...OPENING_BAND },
  coast_defense_ship: { canonical: "B", ...OPENING_BAND },
  central_battery_ship: { canonical: "B", ...OPENING_BAND },
  ironclad_turret_ship: { canonical: "B", ...OPENING_BAND },
};

export function classifyShip(design: CompiledDesignVersion): CanonicalShipType {
  const family = HULL_FAMILY_MAP[design.hullType];
  if (!family) {
    throw new BluewaveError(InvalidShipType, {
      code: InvalidShipType,
      designVersionId: design.designVersionId,
      hullType: design.hullType,
    });
  }

  const displacementKg = design.normalizedDisplacementKg as number;
  const armorUm = design.normalizedArmorUm as number;
  const caliberUm = design.mainGunsCaliber as number;
  const speedUms = design.normalizedSpeedUms as number;

  if (family.minDisplacementKg !== undefined && displacementKg < family.minDisplacementKg) {
    throw new BluewaveError(InvalidShipType, {
      code: InvalidShipType,
      designVersionId: design.designVersionId,
      hullType: design.hullType,
      reason: "displacement below family minimum",
    });
  }
  if (family.minArmorUm !== undefined && armorUm < family.minArmorUm) {
    throw new BluewaveError(InvalidShipType, {
      code: InvalidShipType,
      designVersionId: design.designVersionId,
      hullType: design.hullType,
      reason: "armor below family minimum",
    });
  }
  if (family.minCaliberUm !== undefined && caliberUm < family.minCaliberUm) {
    throw new BluewaveError(InvalidShipType, {
      code: InvalidShipType,
      designVersionId: design.designVersionId,
      hullType: design.hullType,
      reason: "main-gun caliber below family minimum",
    });
  }
  if (family.maxSpeedUms !== undefined && speedUms >= family.maxSpeedUms) {
    throw new BluewaveError(InvalidShipType, {
      code: InvalidShipType,
      designVersionId: design.designVersionId,
      hullType: design.hullType,
      reason: "speed above slow battle-line cap",
    });
  }

  return family.canonical;
}
