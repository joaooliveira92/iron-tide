import type {
  CommanderRef,
  DivisionFormation,
  DivisionRole,
  PermanentDivision,
} from "@bluewave/campaign";
import { BluewaveError, type SafeInt } from "@bluewave/contracts";
import { DIVISION_FORMATION_INELIGIBLE, DIVISION_ROLE_INELIGIBLE } from "./reasonCodes.js";
import type { TacticalShipUnit } from "./unit.js";

export type { DivisionFormation, DivisionRole, PermanentDivision } from "@bluewave/campaign";
export { DIVISION_FORMATIONS, DIVISION_ROLES } from "@bluewave/campaign";

import type { CanonicalShipType } from "./shipType.js";

export const DIVISION_EFFECTS_VERSION = "division_effects_v1" as const;
export const DIVISION_ROLE_ELIGIBILITY_VERSION = "division_role_eligibility_v1" as const;

export const EFFECT_CLAMP_MIN = 7_500;
export const EFFECT_CLAMP_MAX = 12_500;
export const VACANT_COMMANDER_MULTIPLIER_BP = 9_000;

// DESIGN-26 §15 DD scout threshold.
export const DD_SCOUT_DISPLACEMENT_KG_MIN = 1_500_000;
export const DD_SCOUT_SPEED_UMS_MIN = 15_433_320; // 30 knots
export const DD_SCOUT_READINESS_MIN = 60;

// DESIGN-26 §19 tactical division.
export interface TacticalDivision {
  tacticalDivisionId: string;
  battleId: string;
  sideId: string;
  role: DivisionRole;
  formation: DivisionFormation;
  orderedTacticalUnitIds: string[];
  tacticalFlagshipId: string;
  tacticalCommanderId: CommanderRef;
  sourcePermanentDivisionIds: string[];
  projectionAdjustmentRecords: string[];
  campaignAssetProvenanceIds: string[];
  temporaryAssetProvenanceIds: string[];
  initialExperience: SafeInt;
  initialCohesion: SafeInt;
  rulesetVersion: string;
  recordHash: string;
}

// DESIGN-26 §16 division_effects_v1 formulas. All inputs explicit basis points.
export interface DivisionEffectsInput {
  experience: number;
  cohesion: number;
}
export function divisionEffectsV1(input: DivisionEffectsInput): {
  signaling: number;
  contactRetention: number;
  fireDistribution: number;
  formationCohesion: number;
  spotting: number;
  effectiveCrewPerformance: number;
} {
  const signaling = clampBp(8_000 + input.experience * 20);
  const contactRetention = clampBp(8_000 + input.experience * 15 + input.cohesion * 5);
  const fireDistribution = clampBp(8_000 + input.experience * 10 + input.cohesion * 10);
  const formationCohesion = clampBp(7_500 + input.cohesion * 25);
  const spotting = clampBp(9_000 + input.experience * 5 + input.cohesion * 5);
  const effectiveCrewPerformance = clampBp(9_000 + input.experience * 5 + input.cohesion * 5);
  return {
    signaling,
    contactRetention,
    fireDistribution,
    formationCohesion,
    spotting,
    effectiveCrewPerformance,
  };
}

function clampBp(v: number): number {
  if (v < EFFECT_CLAMP_MIN) return EFFECT_CLAMP_MIN;
  if (v > EFFECT_CLAMP_MAX) return EFFECT_CLAMP_MAX;
  return v;
}

// DESIGN-26 §17 formation legality.
export interface FormationLegalityContext {
  role: DivisionRole;
  shipCount: number;
  allDestroyers: boolean;
  searchCapable: boolean;
}
export function formationLegality(
  formation: DivisionFormation,
  ctx: FormationLegalityContext,
): boolean {
  switch (formation) {
    case "LINE_AHEAD":
      return true;
    case "LINE_ABREAST":
      return ctx.shipCount <= 5;
    case "SEARCH_LINE":
      return (ctx.role === "SCOUT" || ctx.role === "PATROL") && ctx.searchCapable;
    case "SCREEN":
      return ctx.role === "SCREEN";
    default:
      return false;
  }
}

export function assertFormationLegality(
  formation: DivisionFormation,
  ctx: FormationLegalityContext,
  context?: Record<string, unknown>,
): void {
  if (!formationLegality(formation, ctx)) {
    throw new BluewaveError(DIVISION_FORMATION_INELIGIBLE, {
      code: DIVISION_FORMATION_INELIGIBLE,
      formation,
      ...ctx,
      ...context,
    });
  }
}

// DESIGN-26 §14 role eligibility.
export function roleEligibility(role: DivisionRole, shipType: CanonicalShipType): boolean {
  switch (role) {
    case "CORE":
      return ["BB", "B", "BC", "CA", "CV", "CVL"].includes(shipType);
    case "SUPPORT":
      return ["CA", "CL", "DD", "KE", "AV"].includes(shipType);
    case "SCOUT":
      return ["CA", "CL", "DD"].includes(shipType);
    case "SCREEN":
      return ["DD", "CL", "KE"].includes(shipType);
    case "PATROL":
      return ["CL", "DD", "KE", "AMC", "AV"].includes(shipType);
    case "INDEPENDENT":
      return true;
    default:
      return false;
  }
}

export function assertRoleEligibility(
  role: DivisionRole,
  shipType: CanonicalShipType,
  context?: Record<string, unknown>,
): void {
  if (!roleEligibility(role, shipType)) {
    throw new BluewaveError(DIVISION_ROLE_INELIGIBLE, {
      code: DIVISION_ROLE_INELIGIBLE,
      role,
      shipType,
      ...context,
    });
  }
}

// DESIGN-26 §15 destroyer scout threshold.
export interface DdScoutContext {
  displacementKg: number;
  designedSpeedUms: number;
  readiness: number;
  searchCapable: boolean;
}
export function isDdScoutEligible(ctx: DdScoutContext): boolean {
  return (
    ctx.displacementKg > DD_SCOUT_DISPLACEMENT_KG_MIN &&
    ctx.designedSpeedUms >= DD_SCOUT_SPEED_UMS_MIN &&
    ctx.readiness >= DD_SCOUT_READINESS_MIN &&
    ctx.searchCapable
  );
}

export type { PermanentDivision as CampaignPermanentDivision };

// DESIGN-26 §20-22: project a permanent division onto battle-local tactical
// divisions. This is a pure projection that never mutates campaign membership.
export interface ProjectionResult {
  tacticalDivisions: TacticalDivision[];
  adjustments: { divisionId: string; reason: string; shipId: string }[];
}
export function projectPermanentDivision(
  division: PermanentDivision,
  units: TacticalShipUnit[],
  battleId: string,
  sideId: string,
  rulesetVersion: string,
): ProjectionResult {
  const byId = new Map(units.map((u) => [u.assetId, u]));
  const present: TacticalShipUnit[] = [];
  const adjustments: ProjectionResult["adjustments"] = [];

  for (const shipId of division.shipOrder) {
    const unit = byId.get(shipId);
    if (!unit) {
      adjustments.push({ divisionId: division.divisionId, reason: "SHIP_OUT_OF_AREA", shipId });
      continue;
    }
    if (!roleEligibility(division.divisionRole, unit.shipType)) {
      adjustments.push({
        divisionId: division.divisionId,
        reason: "MISSION_ROLE_INCOMPATIBLE",
        shipId,
      });
      continue;
    }
    present.push(unit);
  }

  const tactical: TacticalDivision[] = [];
  if (present.length > 0) {
    const flagship = present[0]!.assetId;
    const unitIds = present.map((u) => u.assetId);
    tactical.push({
      tacticalDivisionId: `${battleId}:${division.divisionId}`,
      battleId,
      sideId,
      role: division.divisionRole,
      formation: division.preferredFormation,
      orderedTacticalUnitIds: unitIds,
      tacticalFlagshipId: flagship,
      tacticalCommanderId: division.commanderOfficerId,
      sourcePermanentDivisionIds: [division.divisionId],
      projectionAdjustmentRecords: adjustments.map((a) => a.reason),
      campaignAssetProvenanceIds: present.map((u) => u.provenance.battleAssetId),
      temporaryAssetProvenanceIds: [],
      initialExperience: division.experience,
      initialCohesion: division.cohesion,
      rulesetVersion,
      recordHash: "",
    });
  }

  return { tacticalDivisions: tactical, adjustments };
}
