import type { CompiledDesignVersion, Ship } from "@bluewave/campaign";
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { sha256Hex } from "@bluewave/deterministic";
import { classifyShip, type CanonicalShipType } from "./shipType.js";
import type { CampaignAssetProvenance } from "./provenance.js";

export const TACTICAL_UNIT_PROMOTION_INVALID = "TACTICAL_UNIT_PROMOTION_INVALID" as const;

// DESIGN-37 §1 / DESIGN-38 §8: a campaign Ship promoted to a reachable tactical
// unit. Carries the armor/guns/crew/displacement/speed/HP the tactical layer
// needs, plus canonical ship type and provenance.
export interface TacticalShipUnit {
  assetId: string;
  campaignShipId: string;
  sideId: string;
  divisionId?: string;
  name: string;
  className: string;
  designVersionId: string;
  shipType: CanonicalShipType;
  displacementKg: SafeInt;
  designedSpeedUms: SafeInt;
  armorBeltUm: SafeInt;
  mainGunsCaliberUm: SafeInt;
  mainGunsCount: SafeInt;
  crewComplement: SafeInt;
  hitPoints: SafeInt;
  maxHitPoints: SafeInt;
  sourceStateHash: string;
  provenance: CampaignAssetProvenance;
}

export interface PromoteTacticalUnitOptions {
  sideId: string;
  preBattleStateHash: string;
  projectionReason?: string;
}

export function promoteTacticalUnit(
  ship: Ship,
  design: CompiledDesignVersion,
  options: PromoteTacticalUnitOptions,
): TacticalShipUnit {
  if (ship.isUnderConstruction) {
    throw new BluewaveError(TACTICAL_UNIT_PROMOTION_INVALID, {
      code: TACTICAL_UNIT_PROMOTION_INVALID,
      shipId: ship.id,
      reason: "under-construction ship cannot promote",
    });
  }
  if (!design || ship.designVersionId !== design.designVersionId) {
    throw new BluewaveError(TACTICAL_UNIT_PROMOTION_INVALID, {
      code: TACTICAL_UNIT_PROMOTION_INVALID,
      shipId: ship.id,
      designVersionId: ship.designVersionId,
      resolvedDesignVersionId: design?.designVersionId,
      reason: "missing or invalid design reference",
    });
  }

  const shipType = classifyShip(design);

  const preBattleStateHash = sha256Hex(
    JSON.stringify({
      id: ship.id,
      hitPoints: ship.hitPoints,
      maxHitPoints: ship.maxHitPoints,
      locationAreaId: ship.locationAreaId,
      inBattleId: ship.inBattleId ?? null,
    }),
  );

  const provenance: CampaignAssetProvenance = {
    battleAssetId: ship.id,
    campaignAssetId: ship.id,
    campaignAggregateType: "Ship",
    sourcePermanentDivisionId: null,
    sourceCompiledDesignId: design.designVersionId,
    sourceCompiledDesignHash: design.compiledHash,
    preBattleStateHash,
    projectionReason: options.projectionReason ?? "promoteTacticalUnit",
    persistenceDisposition: "persistent",
    provenanceHash: sha256Hex(
      JSON.stringify({
        battleAssetId: ship.id,
        campaignAssetId: ship.id,
        designVersionId: design.designVersionId,
        preBattleStateHash,
      }),
    ),
  };

  return {
    assetId: ship.id,
    campaignShipId: ship.id,
    sideId: options.sideId,
    name: ship.name,
    className: design.className,
    designVersionId: design.designVersionId,
    shipType,
    displacementKg: design.normalizedDisplacementKg,
    designedSpeedUms: design.normalizedSpeedUms,
    armorBeltUm: design.normalizedArmorUm,
    mainGunsCaliberUm: design.mainGunsCaliber,
    mainGunsCount: design.mainGunsCount,
    crewComplement: design.crewComplement,
    hitPoints: ship.hitPoints,
    maxHitPoints: ship.maxHitPoints,
    sourceStateHash: preBattleStateHash,
    provenance,
  };
}
