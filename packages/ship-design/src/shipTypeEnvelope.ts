// The player-facing numeric envelope of a ship type, read from the classification rules.
import type { ClassificationRules } from "./classification.js";
import type { ShipTypeId } from "./shipTypes.js";
import { UM_PER_KNOT } from "./units.js";

/** A closed numeric range for display, in the units named by the field. */
export interface Range {
  readonly min: number | null;
  readonly max: number | null;
  /** Whether each bound is itself legal (`>=` / `<=`) or excluded (`>` / `<`). */
  readonly minInclusive: boolean;
  readonly maxInclusive: boolean;
}

export interface ShipTypeEnvelope {
  readonly displacementKg: Range;
  /** Designed speed, knots. */
  readonly speedKn: Range;
  /** Main belt, inches. */
  readonly beltIn: Range;
  /** Largest main gun, inches. */
  readonly mainGunIn: Range;
}

const range = (
  min: number | null,
  max: number | null,
  minInclusive: boolean,
  maxInclusive: boolean,
): Range => ({ min, max, minInclusive, maxInclusive });
const NONE = range(null, null, true, true);
const inch = (um: number): number => um / 25_400;
const knots = (ums: number): number => ums / UM_PER_KNOT;

/**
 * The boundaries of a type as the player-facing envelope, read from `ClassificationRules` so the roster, the
 * Brief panel and the validator cannot disagree. Only the opening types carry numeric bounds.
 */
export function shipTypeEnvelope(id: ShipTypeId, r: ClassificationRules): ShipTypeEnvelope {
  switch (id) {
    case "B":
      return {
        displacementKg: range(r.bMinDisplacementKg, null, true, true),
        speedKn: range(null, knots(r.bMaxSpeedUms), true, false),
        beltIn: range(inch(r.bBeltMinUm), null, true, true),
        mainGunIn: range(inch(r.clMaxGunUm), null, false, true),
      };
    case "CA":
      return {
        displacementKg: range(r.caMinDisplacementKg, null, false, true),
        speedKn: range(knots(r.caMinSpeedUms), null, false, true),
        beltIn: range(inch(r.caBeltMinUm), inch(r.caBeltMaxUm), false, true),
        mainGunIn: range(inch(r.clMaxGunUm), inch(r.caGunMaxUm), false, true),
      };
    case "CL":
      return {
        displacementKg: range(r.clMinDisplacementKg, r.clMaxDisplacementKg, true, false),
        speedKn: range(knots(r.clMinSpeedUms), null, false, true),
        beltIn: NONE,
        mainGunIn: range(null, inch(r.clMaxGunUm), true, true),
      };
    case "DD":
      return {
        displacementKg: range(0, r.ddMaxDisplacementKg, false, false),
        speedKn: range(knots(r.ddMinSpeedUms), null, false, true),
        beltIn: range(null, inch(r.qualifyingArmourUm), true, false),
        mainGunIn: NONE,
      };
    case "KE":
      return {
        displacementKg: range(0, r.keMaxDisplacementKg, false, false),
        speedKn: NONE,
        beltIn: range(null, inch(r.keBeltMaxUm), true, true),
        mainGunIn: range(null, inch(r.keGunMaxUm), true, true),
      };
    case "AMC":
      return {
        displacementKg: range(r.amcMinDisplacementKg, null, false, true),
        speedKn: NONE,
        beltIn: range(null, inch(r.qualifyingArmourUm), true, false),
        mainGunIn: range(null, inch(r.amcGunMaxUm), true, true),
      };
    case "BB":
      return {
        displacementKg: range(r.bbMinDisplacementKg, null, false, true),
        speedKn: NONE,
        beltIn: range(inch(r.bbBeltMinUm), null, false, true),
        mainGunIn: range(inch(r.bbGunMinUm), null, false, true),
      };
    case "BC":
    case "CV":
    case "CVL":
    case "AV":
    case "SS":
    case "MTB":
    case "TR":
      return { displacementKg: NONE, speedKn: NONE, beltIn: NONE, mainGunIn: NONE };
  }
}
