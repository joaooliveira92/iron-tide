import type { Ship } from "@bluewave/campaign";
import {
  SHIP_WORKING_UP_BATTLE_INELIGIBLE,
  SHIP_LAID_UP_BATTLE_INELIGIBLE,
  SHIP_ALREADY_RESERVED_FOR_BATTLE,
  FUEL_BATTLE_INELIGIBLE,
  BATTLE_RANGE_INELIGIBLE,
} from "./reasonCodes.js";

/** The readiness value below which a ship cannot take part in a battle (S-1 FUEL floor). */
export const BATTLE_READINESS_FLOOR = 60;

/**
 * The kind of engagement a ship is being gathered for. An ordinary battle
 * excludes reserve and mothballed ships; a surprise attack does not (manual
 * p.69: laid-up ships "might be included as defending ships in a surprise
 * attack ... to make them vulnerable").
 */
export const ORDINARY_ENGAGEMENT = "ORDINARY" as const;
export const SURPRISE_ATTACK_ENGAGEMENT = "SURPRISE_ATTACK" as const;
export type BattleEngagementKind = typeof ORDINARY_ENGAGEMENT | typeof SURPRISE_ATTACK_ENGAGEMENT;

export interface EligibleAsset {
  assetId: string;
  shipId: string;
  sideId: string;
  nationId: string;
  locationAreaId: string;
  divisionId?: string;
  divisionPosition?: number;
  effectiveStrength: number;
  readiness: number;
  shipType: string;
}

export interface ExclusionRecord {
  assetId: string;
  reason: string;
}

export interface GatherEligibleAssetsInput {
  ships: Ship[];
  sideId: string;
  nationId: string;
  areaId: string;
  reservedAssetIds: ReadonlySet<string>;
  resolveStrength: (ship: Ship) => number;
  resolveShipType: (ship: Ship) => string;
  resolveReadiness: (ship: Ship) => number;
  divisionIdFor?: (shipId: string) => string | undefined;
  divisionPositionFor?: (shipId: string) => number | undefined;
  /** Defaults to an ordinary battle; a surprise attack includes laid-up ships (manual p.69). */
  engagementKind?: BattleEngagementKind;
}

// DESIGN-37 §11: a persistent asset is eligible only when it passes the explicit
// predicates. DESIGN-37 §12: ordering side → nation → division-before-unattached
// → divisionId → position → assetId, and consumes no randomness.
export function gatherEligibleAssets(input: GatherEligibleAssetsInput): {
  eligible: EligibleAsset[];
  exclusions: ExclusionRecord[];
} {
  const eligible: EligibleAsset[] = [];
  const exclusions: ExclusionRecord[] = [];
  const engagementKind = input.engagementKind ?? ORDINARY_ENGAGEMENT;

  for (const ship of input.ships) {
    // S-1: working up is the real readiness state (not isUnderConstruction).
    if (ship.isUnderConstruction || ship.readiness === "WORKING_UP") {
      exclusions.push({ assetId: ship.id, reason: SHIP_WORKING_UP_BATTLE_INELIGIBLE });
      continue;
    }
    // S-1: reserve and mothballed ships sit out ordinary battles; a surprise
    // attack still catches them (manual p.69).
    if (
      engagementKind !== SURPRISE_ATTACK_ENGAGEMENT &&
      (ship.readiness === "RESERVE" || ship.readiness === "MOTHBALLED")
    ) {
      exclusions.push({ assetId: ship.id, reason: SHIP_LAID_UP_BATTLE_INELIGIBLE });
      continue;
    }
    if (ship.inBattleId || input.reservedAssetIds.has(ship.id)) {
      exclusions.push({ assetId: ship.id, reason: SHIP_ALREADY_RESERVED_FOR_BATTLE });
      continue;
    }
    if (ship.locationAreaId !== input.areaId) {
      exclusions.push({ assetId: ship.id, reason: BATTLE_RANGE_INELIGIBLE });
      continue;
    }
    if (input.resolveReadiness(ship) < BATTLE_READINESS_FLOOR) {
      exclusions.push({ assetId: ship.id, reason: FUEL_BATTLE_INELIGIBLE });
      continue;
    }

    eligible.push({
      assetId: ship.id,
      shipId: ship.id,
      sideId: input.sideId,
      nationId: input.nationId,
      locationAreaId: ship.locationAreaId,
      divisionId: input.divisionIdFor?.(ship.id),
      divisionPosition: input.divisionPositionFor?.(ship.id),
      effectiveStrength: input.resolveStrength(ship),
      readiness: input.resolveReadiness(ship),
      shipType: input.resolveShipType(ship),
    });
  }

  eligible.sort((a, b) => {
    if (a.sideId !== b.sideId) return a.sideId.localeCompare(b.sideId);
    if (a.nationId !== b.nationId) return a.nationId.localeCompare(b.nationId);
    const aDiv = a.divisionId !== undefined ? 0 : 1;
    const bDiv = b.divisionId !== undefined ? 0 : 1;
    if (aDiv !== bDiv) return aDiv - bDiv;
    if ((a.divisionId ?? "") !== (b.divisionId ?? ""))
      return (a.divisionId ?? "").localeCompare(b.divisionId ?? "");
    if ((a.divisionPosition ?? 0) !== (b.divisionPosition ?? 0))
      return (a.divisionPosition ?? 0) - (b.divisionPosition ?? 0);
    return a.assetId.localeCompare(b.assetId);
  });

  return { eligible, exclusions };
}
