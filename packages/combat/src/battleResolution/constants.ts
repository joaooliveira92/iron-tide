// B-6 INC-2: versioned authoritative battle-auto-resolution base constants
// (DESIGN-38 §33/§37, DESIGN-37 §32) shipped as a `battle_auto_resolution_v1`
// policy + `SHIPPED_BATTLE_AUTO_RESOLUTION_V1` + `validateBattleAutoResolutionContract`,
// mirroring packages/combat/src/weather/constants.ts and gunnery/constants.ts.
// Fail-closed on mismatch. Every authored constant is a versioned-ruleset
// decision recorded in ADR-0026 (B-6 INC-2); nothing below is runtime-inferred.
import { BluewaveError } from "@bluewave/contracts";
import { BATTLE_AUTO_RESOLUTION_FAILED } from "./reasonCodes.js";
import { DEFAULT_MAX_BATTLE_MINUTES } from "../battleEnd.js";
import { KNOTS_TO_UM_S, SPEED_BP_SCALE } from "../movement/constants.js";
import { ARMOR_QUALITY_FAMILIES } from "../damage/armorModel.js";

export const battleAutoResolutionPolicyId = "battle_auto_resolution_v1" as const;

// Ruleset + formula versions pinned by the battle_auto_resolution_v1 contract.
export const BATTLE_AUTO_RESOLUTION_RULESET_VERSION = "battle_auto_resolution_ruleset_v1" as const;
export const BATTLE_AUTO_RESOLUTION_FORMULA_VERSION = "battle_auto_resolution_formula_v1" as const;

// DESIGN-38 §32: shipped default maximum battle duration (battle minutes).
export const AUTO_RESOLUTION_MAX_MINUTES = DEFAULT_MAX_BATTLE_MINUTES;

// Canonical projection defaults (ADR-0026). Realism-independent constants the
// auto-resolver uses to project committed campaign assets into the tactical
// layer; all BALANCE TARGETs recorded in ADR-0026, never ambient.

// Canonical default area bounding box (integer micrometres, 20 km x 10 km).
// Used when no area geometry is available at the combat layer; attackers spawn
// along the west edge, defenders along the east edge (spawn.ts).
export const DEFAULT_AREA_BBOX = {
  minX: 0,
  minY: 0,
  maxX: 20_000_000_000,
  maxY: 10_000_000_000,
} as const;

// Canonical battle date/time anchors derived from the campaign month id
// (DESIGN-42 stream domain) — battleDate "YYYY-MM-15" at 06:00 local.
export const AUTO_RESOLUTION_BATTLE_DATE_DAY = 15 as const;
export const AUTO_RESOLUTION_BATTLE_START_TIME = "06:00" as const;
export const AUTO_RESOLUTION_BATTLE_START_MINUTES = 360 as const; // 06:00 -> minutes since midnight

// S-1/ADR-0223: the crew skill the auto-resolution torpedo model uses when no
// per-ship crew quality is threaded in (neutral-competent crew; a named
// balance_adjustment, ADR-0213). Kept here so no numeric gameplay constant is
// embedded directly in torpedoProjection.ts.
export const AUTO_TORPEDO_CREW_QUALITY_BP = 7_000;

// Main-battery gunnery surface (B-3 engine consumes these per battery):
// one canonical base reload = one tactical minute, and one canonical base
// accuracy (basis points). BALANCE TARGET anchors recorded in ADR-0026.
export const GUNNERY_BASE_RELOAD_MS = 60_000 as const;
export const GUNNERY_ACCURACY_BASE_BP = 4_000 as const;

// ADR-0072: speed advantage as range control + engagement geometry (ticket 11).
//
// The auto-resolver's pursuit steers every ship straight at the nearest enemy at
// full designed speed, so speed conferred no tactical advantage (ADR-0053 sweep:
// a 14 kn fleet beat an equal 30 kn fleet 30/30). ADR-0072 adds the missing
// decision: the side with the greater maximum designed speed over its committed
// force is the RANGE CONTROLLER. Its design change is a standoff doctrine: the
// controller steers by `engagementHeading` (CLOSE/OPEN/HOLD, `rangeBetweenUm`-
// measured against `BATTLE_ENGAGEMENT_RANGE_UM` +/- `BATTLE_ENGAGEMENT_BAND_UM`,
// integer micrometres) and dictates the engagement band, instead of both sides
// charging.
//
// The contesting side is DENIED the range initiative: it still charges straight
// under ADR-0046 pursuit and never manœuvres of its own. That denial is priced
// by an explicitly versioned BALANCE TARGET (like the ADR-0053 lethality
// constants), NOT an emergent consequence of manoeuvring the contesting side
// performs: its DESIGN-39 §3 `ownManeuver` accuracy factor is multiplied to
// 4_100 bp (a 59% own-manoeuvre factor), calibrated so a 30 kn fleet beats an
// equal-gun 14 kn fleet (acceptance >= 50%; sweep observed 73%).
//
// Geometry is applied ONLY to the range-controlling side: equal maximum speeds
// (including an absent/empty side) leave the battle exactly as ADR-0046 pursuit
// left it, so equal-speed matchups (and the P-1 torpedo doctrine, whose
// lead/intercept courses assume the ADR-0046 closing geometry) are byte-identical.
// Versioned with the battle auto-resolution contract; a re-fit is a new ADR,
// never an in-place edit.
export const BATTLE_ENGAGEMENT_RANGE_UM = 2_000_000_000 as const;
export const BATTLE_ENGAGEMENT_BAND_UM = 1_000_000_000 as const;
export const RANGE_CONTEST_OWN_MANEUVER_BP = 4_100 as const;

// ADR-0073 (P-1 ticket 12): withdrawal / disengagement. A side whose fleet
// strength fraction (mean per-ship ADR-0026 hp fraction, terminal = 0) is
// strictly below this threshold breaks off at the end of the minute
// (`withdrawal_complete`; both sides below -> `mutual_disengagement`).
export const WITHDRAWAL_STRENGTH_THRESHOLD_BP = 2_000 as const;

/** Conversion: designed speed µm/s -> movement speed units (knots × SPEED_BP_SCALE,
 *  the scale `speedBpKnotsToUmS` reads). Integer, floor:
 *  floor(ums * SPEED_BP_SCALE / KNOTS_TO_UM_S).
 *  P-1 / ADR-0046: the B-6 form returned whole knots, which movement read as
 *  thousandths of a knot — auto-resolved ships effectively never moved. */
export function designedSpeedBpKnots(designedSpeedUms: number): number {
  return Math.floor((designedSpeedUms * SPEED_BP_SCALE) / KNOTS_TO_UM_S);
}

// Canonical shell/armor constants for impact synthesis (B-4 armor seam,
// ADR-0021: `penetration = caliber * velocity / 1000`, linear first
// approximation). All BALANCE TARGETs recorded in ADR-0026.
export const SHELL_MUZZLE_VELOCITY_MS = 762 as const;
export const SHELL_IMPACT_ANGLE_DEG = 0 as const; // normal impact (flat sea, no obliquity)
export const ARMOR_QUALITY_FAMILY = "HARVEY" as const; // canonical family for auto-resolution

/** Single full-penetration hit's base structural damage (integer score units). */
export const HIT_STRUCTURAL_DAMAGE_BASE = 2_000 as const;

/** Penetration outcome -> structural damage fraction (basis points). */
export const HIT_DAMAGE_OUTCOME_BP = {
  NO_EFFECT: 0,
  DUD: 0,
  SPLINTER_EFFECT: 2_500,
  PARTIAL_PENETRATION: 5_000,
  FULL_PENETRATION: 10_000,
  PASS_THROUGH: 4_000,
  CRITICAL_PENETRATION: 20_000,
} as const;

/** Hull-breach flotation damage = floor(structural * FLOAT_LOSS_RATIO_BP / 10_000). */
export const FLOAT_LOSS_RATIO_BP = 5_000 as const;

// ADR-0098 (post-ADR-0094 lethality rebalance): bounded partial-penetration
// consequence. After the caliber unit correction the dominant belt hit at
// production scale resolves PARTIAL_PENETRATION (e.g. a 343 mm gun's 261 366 µm
// capability against a 304 950 µm HARVEY belt), which previously had NO
// progressive consequence at all: no breach, no flooding, no fire. Flotation
// therefore drained almost only through the 3% magazine share, so ships rarely
// sank and battles ground to the 360-minute cap. A partial penetration of a
// waterline zone now opens a BOUNDED breach: it contributes a smaller share of
// the full-penetration flotation loss and a lower flooding-source chance
// (`FLOODING_CHANCE_BP` in immediateFireFlooding.ts), never the full-penetration
// value, so the outcome ordering stays monotone (partial < full). BALANCE_TARGET.
export const PARTIAL_BREACH_FLOAT_LOSS_RATIO_BP = 1_500 as const;

// A partial penetration only opens its bounded breach when the shell came CLOSE
// to defeating the plate (capability ≥ this fraction of resistance). A glancing
// partial (e.g. a 343 mm gun's 261 366 µm capability against a 457 200 µm
// effective 508 mm belt = 57%) stays a pure structural hit with no breach, so
// the thick-belt non-breach property is preserved and monotone: thicker armor
// (higher resistance) can only make a breach less likely. BALANCE_TARGET.
export const PARTIAL_BREACH_MIN_RATIO_BP = 6_500 as const;

/** Canonical armor-quality family must be a shipped family (fail-closed). */
export function assertShippedArmorQualityFamily(family: string): void {
  if (!(ARMOR_QUALITY_FAMILIES as readonly string[]).includes(family)) {
    throw new BluewaveError(BATTLE_AUTO_RESOLUTION_FAILED, {
      code: BATTLE_AUTO_RESOLUTION_FAILED,
      family,
      reason: "armor quality family must be a shipped armor_v1 family",
    });
  }
}

// Canonical ship layout (deterministic zone set + belt-proportional thickness;
// ADR-0026). Every zone extends the ship's belt armor by the recorded ratio.
export const AUTO_ZONES = ["BELT", "DECK", "SUPERSTRUCTURE", "MAGAZINE"] as const;
export type AutoResolutionZoneId = (typeof AUTO_ZONES)[number];

export const ZONE_THICKNESS_BP: Record<AutoResolutionZoneId, number> = {
  BELT: 10_000,
  DECK: 5_000,
  SUPERSTRUCTURE: 2_500,
  MAGAZINE: 8_000,
} as const;

/** Relative hit-location weight per zone (sums to 10_000). ADR-0053: the magazine
 *  is a small, deep, heavily protected target, so it is struck far less often
 *  than the uniform 25% the original authored draw implied (magazine
 *  detonations were the dominant lethality source). */
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
  thicknessUm: number; // integer µm
  critical: boolean;
}

/** Construct the canonical damage zones for one ship from its belt armor (µm). */
export function autoZonesForBelt(beltArmorUm: number): readonly AutoResolutionZone[] {
  return AUTO_ZONES.map((id) => ({
    id,
    zoneType: id as AutoResolutionZoneId,
    thicknessUm: Math.floor((beltArmorUm * ZONE_THICKNESS_BP[id]) / 10_000),
    critical: ZONE_CRITICAL[id],
  }));
}

// Canonical compartment/component id sets (engineWiring's component-type
// inference operates on the id prefix: TURRET-*, ENGINE-*, RUDDER-*, ...).
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

// ShipDamageState construction + hp mapping (ADR-0026, "damageReport mapping").
// Initial reserves are canonical full-integrity score units (B-4 fixtures use
// the same scale); a ship's battle hp derives from STRUCTURE + FLOAT equally.
export const STRUCTURE_UNIT = 100_000 as const;
export const FLOAT_UNIT = 400_000 as const;
export const STABILITY_INITIAL_BP = 8_000 as const;

// Contract

export interface BattleAutoResolutionContract {
  policyId: string;
  rulesetVersion: string;
  formulaVersion: string;
  defaultMaxBattleMinutes: number;
  baseReloadMs: number;
  accuracyBaseBp: number;
  shellMuzzleVelocityMs: number;
  armorQualityFamily: string;
  structureUnit: number;
  floatUnit: number;
  zones: readonly string[];
  /** ADR-0072 speed advantage: standoff geometry + range-contest fire-control bp. */
  engagementRangeUm: number;
  engagementBandUm: number;
  rangeContestOwnManeuverBp: number;
  /** ADR-0073 withdrawal fleet-strength threshold (bp). */
  withdrawalStrengthThresholdBp: number;
}

export const SHIPPED_BATTLE_AUTO_RESOLUTION_V1: BattleAutoResolutionContract = {
  policyId: battleAutoResolutionPolicyId,
  rulesetVersion: BATTLE_AUTO_RESOLUTION_RULESET_VERSION,
  formulaVersion: BATTLE_AUTO_RESOLUTION_FORMULA_VERSION,
  defaultMaxBattleMinutes: AUTO_RESOLUTION_MAX_MINUTES,
  baseReloadMs: GUNNERY_BASE_RELOAD_MS,
  accuracyBaseBp: GUNNERY_ACCURACY_BASE_BP,
  shellMuzzleVelocityMs: SHELL_MUZZLE_VELOCITY_MS,
  armorQualityFamily: ARMOR_QUALITY_FAMILY,
  structureUnit: STRUCTURE_UNIT,
  floatUnit: FLOAT_UNIT,
  zones: AUTO_ZONES,
  engagementRangeUm: BATTLE_ENGAGEMENT_RANGE_UM,
  engagementBandUm: BATTLE_ENGAGEMENT_BAND_UM,
  rangeContestOwnManeuverBp: RANGE_CONTEST_OWN_MANEUVER_BP,
  withdrawalStrengthThresholdBp: WITHDRAWAL_STRENGTH_THRESHOLD_BP,
};

export function throwContractMismatch(contract: unknown, reason: string): never {
  throw new BluewaveError(BATTLE_AUTO_RESOLUTION_FAILED, {
    code: BATTLE_AUTO_RESOLUTION_FAILED,
    contract,
    reason,
  });
}

function arrayEquals(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function validateBattleAutoResolutionContract(
  c: Partial<BattleAutoResolutionContract> | null | undefined,
): asserts c is BattleAutoResolutionContract {
  if (!c) throwContractMismatch(c, "battle_auto_resolution_v1 missing contract");
  if (c.policyId !== battleAutoResolutionPolicyId)
    throwContractMismatch(c, "battle_auto_resolution_v1 expectant policy id");
  if (
    c.rulesetVersion !== BATTLE_AUTO_RESOLUTION_RULESET_VERSION ||
    c.formulaVersion !== BATTLE_AUTO_RESOLUTION_FORMULA_VERSION
  )
    throwContractMismatch(c, "battle_auto_resolution_v1 ruleset/formula versions");
  if (c.defaultMaxBattleMinutes !== AUTO_RESOLUTION_MAX_MINUTES)
    throwContractMismatch(c, "battle_auto_resolution_v1 default max battle minutes");
  if (c.baseReloadMs !== GUNNERY_BASE_RELOAD_MS)
    throwContractMismatch(c, "battle_auto_resolution_v1 base reload ms");
  if (c.accuracyBaseBp !== GUNNERY_ACCURACY_BASE_BP)
    throwContractMismatch(c, "battle_auto_resolution_v1 accuracy base bp");
  if (c.shellMuzzleVelocityMs !== SHELL_MUZZLE_VELOCITY_MS)
    throwContractMismatch(c, "battle_auto_resolution_v1 shell muzzle velocity");
  if (c.armorQualityFamily !== ARMOR_QUALITY_FAMILY)
    throwContractMismatch(c, "battle_auto_resolution_v1 armor quality family");
  if (c.structureUnit !== STRUCTURE_UNIT || c.floatUnit !== FLOAT_UNIT)
    throwContractMismatch(c, "battle_auto_resolution_v1 structural/flotation units");
  if (!c.zones || !arrayEquals(c.zones, AUTO_ZONES))
    throwContractMismatch(c, "battle_auto_resolution_v1 canonical zone set");
  if (c.engagementRangeUm !== BATTLE_ENGAGEMENT_RANGE_UM)
    throwContractMismatch(c, "battle_auto_resolution_v1 engagement range");
  if (c.engagementBandUm !== BATTLE_ENGAGEMENT_BAND_UM)
    throwContractMismatch(c, "battle_auto_resolution_v1 engagement band");
  if (c.rangeContestOwnManeuverBp !== RANGE_CONTEST_OWN_MANEUVER_BP)
    throwContractMismatch(c, "battle_auto_resolution_v1 range-contest own manoeuvre");
  if (c.withdrawalStrengthThresholdBp !== WITHDRAWAL_STRENGTH_THRESHOLD_BP)
    throwContractMismatch(c, "battle_auto_resolution_v1 withdrawal strength threshold");
}
