import type { CompiledDesignVersion } from "@bluewave/campaign";
import { BluewaveError, HULL_FAMILY_FLOORS, type HullFamilyFloorTable } from "@bluewave/contracts";

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

export const SHIP_TYPE_CLASSIFIER_VERSION = "ship_type_classifier_v2" as const;

export const InvalidShipType = "INVALID_SHIP_TYPE" as const;

export function classifyShip(
  design: CompiledDesignVersion,
  floors: HullFamilyFloorTable = HULL_FAMILY_FLOORS,
): CanonicalShipType {
  const family = floors[design.hullType];
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

  return family.canonical as CanonicalShipType;
}
