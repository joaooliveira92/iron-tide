import { BluewaveError } from "@bluewave/contracts";
import { ARMOR_QUALITY_FAMILIES } from "./armorModel.js";

export const BATTLE_AUTO_RESOLUTION_FAILED = "BATTLE_AUTO_RESOLUTION_FAILED" as const;

export const SHELL_MUZZLE_VELOCITY_MS = 762 as const;
export const SHELL_IMPACT_ANGLE_DEG = 0 as const;
export const ARMOR_QUALITY_FAMILY = "HARVEY" as const;

export const HIT_STRUCTURAL_DAMAGE_BASE = 2_000 as const;

export const HIT_DAMAGE_OUTCOME_BP = {
  NO_EFFECT: 0,
  DUD: 0,
  SPLINTER_EFFECT: 2_500,
  PARTIAL_PENETRATION: 5_000,
  FULL_PENETRATION: 10_000,
  PASS_THROUGH: 4_000,
  CRITICAL_PENETRATION: 20_000,
} as const;

export const FLOAT_LOSS_RATIO_BP = 5_000 as const;

export const PARTIAL_BREACH_FLOAT_LOSS_RATIO_BP = 1_500 as const;

export const PARTIAL_BREACH_MIN_RATIO_BP = 6_500 as const;

export function assertShippedArmorQualityFamily(family: string): void {
  if (!(ARMOR_QUALITY_FAMILIES as readonly string[]).includes(family)) {
    throw new BluewaveError(BATTLE_AUTO_RESOLUTION_FAILED, {
      code: BATTLE_AUTO_RESOLUTION_FAILED,
      family,
      reason: "armor quality family must be a shipped armor_v1 family",
    });
  }
}

export const AUTO_ZONES = ["BELT", "DECK", "SUPERSTRUCTURE", "MAGAZINE"] as const;
export type AutoResolutionZoneId = (typeof AUTO_ZONES)[number];

export const ZONE_THICKNESS_BP: Record<AutoResolutionZoneId, number> = {
  BELT: 10_000,
  DECK: 5_000,
  SUPERSTRUCTURE: 2_500,
  MAGAZINE: 8_000,
} as const;

export const ZONE_HIT_WEIGHT_BP: Record<AutoResolutionZoneId, number> = {
  BELT: 4_000,
  DECK: 3_000,
  SUPERSTRUCTURE: 2_700,
  MAGAZINE: 300,
} as const;

export const ZONE_CRITICAL: Record<AutoResolutionZoneId, boolean> = {
  BELT: false,
  DECK: false,
  SUPERSTRUCTURE: false,
  MAGAZINE: true,
} as const;

export interface AutoResolutionZone {
  id: string;
  zoneType: string;
  thicknessUm: number;
  critical: boolean;
}

export function autoZonesForBelt(beltArmorUm: number): readonly AutoResolutionZone[] {
  return AUTO_ZONES.map((id) => ({
    id,
    zoneType: id as AutoResolutionZoneId,
    thicknessUm: Math.floor((beltArmorUm * ZONE_THICKNESS_BP[id]) / 10_000),
    critical: ZONE_CRITICAL[id],
  }));
}

export const AUTO_RESOLUTION_COMPARTMENTS = [
  "COMP-BELT-1",
  "COMP-DECK-1",
  "COMP-MAGAZINE-1",
] as const;
export const AUTO_RESOLUTION_COMPONENTS = [
  "TURRET-1",
  "ENGINE-1",
  "RUDDER-1",
  "FIRE_DIRECTOR-1",
  "CONNING-1",
  "AA-1",
] as const;

export const STRUCTURE_UNIT = 100_000 as const;
export const FLOAT_UNIT = 400_000 as const;
export const STABILITY_INITIAL_BP = 8_000 as const;
