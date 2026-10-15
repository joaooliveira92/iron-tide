// DESIGN-39 §1 authoritative GunneryState: one per operational battery. The numeric
// surface is integer fixed-point (DESIGN-07): acquisition/fire-control basis points,
// range in integer micrometres, reload progress in integer tactical milliseconds,
// exact integer ammunition counts. Non-integers are rejected at the construction
// boundary with GUNNERY_STATE_INVARIANT_FAILED. Pure/deterministic: no ambient
// I/O/clock/random. A reversible-to-invariant guard never mutates its input.
import { BluewaveError } from "@bluewave/contracts";
import { createEnvelope } from "@bluewave/deterministic";
import {
  ACQUISITION_PROGRESS_MAX_BP,
  ACQUISITION_PROGRESS_MIN_BP,
  AMMUNITION_TYPES,
  type AmmunitionType,
  FIRE_CONTROL_SOLUTION_MAX_BP,
  FIRE_CONTROL_SOLUTION_MIN_BP,
  FIRE_MODES,
  type FireMode,
  gunneryPolicyId,
} from "./constants.js";
import { GUNNERY_STATE_INVARIANT_FAILED } from "./reasonCodes.js";

export const NO_TARGET = "NONE" as const;

export interface GunneryState {
  batteryId: string;
  ownerShipId: string;
  gunDefinitionId: string;
  mountDefinitionId: string;
  /**
   * The first-class armament identity of the installation this battery projects (ADR-0093 Step 4).
   * Present for compiled designs carrying a `CompiledArmamentMount` snapshot; absent for legacy designs
   * (the documented compatibility path). `gunDefinitionId`/`mountDefinitionId` mirror the gun model and
   * mount ids when present, and stay synthetic only when no first-class identity is available.
   */
  gunFamilyId?: string;
  ammunitionPatternId?: string;
  targetContactId: string; // contact id or NO_TARGET
  acquisitionProgressBp: number; // integer basis points [0,10_000]
  rangeEstimateUm: number; // integer micrometres >= 0
  rangeUncertaintyUm: number; // integer micrometres >= 0
  fireControlSolutionQualityBp: number; // integer basis points [0,10_000]
  ammunition: Record<AmmunitionType, number>; // exact integer counts >= 0
  fireMode: FireMode;
  reloadProgressMs: number; // integer tactical milliseconds >= 0
  straddleState: string | null; // reserved this slice
  damageState: string | null; // reserved this slice
  aaEligibilityState: string | null; // reserved this slice
  lastSalvoMinute: number; // integer, -1 when no salvo yet
  lastSalvoSubstep: number; // integer >= 0
  rulesetVersion: string;
  formulaVersion: string;
  stateHash: string; // authoritative hash (deterministic)
}

function invariant(s: GunneryState, field: string, value: unknown, reason: string): never {
  const message = GUNNERY_STATE_INVARIANT_FAILED;
  throw new BluewaveError(message, {
    code: GUNNERY_STATE_INVARIANT_FAILED,
    field,
    reason,
    value,
  });
}

// AC-1: reject any non-integer / out-of-bound / malformed field in the authoritative
// GunneryState surface with GUNNERY_STATE_INVARIANT_FAILED. Reversible-to-invariant:
// a failure leaves the supplied state untouched (no partial mutation).
export function assertFixedPointGunnery(s: GunneryState): void {
  if (typeof s.batteryId !== "string" || s.batteryId.length === 0)
    invariant(s, "batteryId", s.batteryId, "batteryId must be a non-empty string");
  if (typeof s.ownerShipId !== "string" || s.ownerShipId.length === 0)
    invariant(s, "ownerShipId", s.ownerShipId, "ownerShipId must be a non-empty string");
  if (typeof s.gunDefinitionId !== "string" || s.gunDefinitionId.length === 0)
    invariant(
      s,
      "gunDefinitionId",
      s.gunDefinitionId,
      "gunDefinitionId must be a non-empty string",
    );
  if (typeof s.mountDefinitionId !== "string" || s.mountDefinitionId.length === 0)
    invariant(
      s,
      "mountDefinitionId",
      s.mountDefinitionId,
      "mountDefinitionId must be a non-empty string",
    );
  if (
    s.gunFamilyId !== undefined &&
    (typeof s.gunFamilyId !== "string" || s.gunFamilyId.length === 0)
  )
    invariant(
      s,
      "gunFamilyId",
      s.gunFamilyId,
      "gunFamilyId must be a non-empty string when present",
    );
  if (
    s.ammunitionPatternId !== undefined &&
    (typeof s.ammunitionPatternId !== "string" || s.ammunitionPatternId.length === 0)
  )
    invariant(
      s,
      "ammunitionPatternId",
      s.ammunitionPatternId,
      "ammunitionPatternId must be a non-empty string when present",
    );
  if (typeof s.targetContactId !== "string" || s.targetContactId.length === 0)
    invariant(s, "targetContactId", s.targetContactId, "targetContactId must be a string or NONE");
  if (!(FIRE_MODES as readonly string[]).includes(s.fireMode))
    invariant(s, "fireMode", s.fireMode, "fireMode must be a canonical DESIGN-39 §2 mode");

  if (!Number.isInteger(s.acquisitionProgressBp))
    invariant(s, "acquisitionProgressBp", s.acquisitionProgressBp, "integer basis points");
  if (
    s.acquisitionProgressBp < ACQUISITION_PROGRESS_MIN_BP ||
    s.acquisitionProgressBp > ACQUISITION_PROGRESS_MAX_BP
  )
    invariant(
      s,
      "acquisitionProgressBp",
      s.acquisitionProgressBp,
      "acquisition basis points outside [0,10_000]",
    );

  if (!Number.isInteger(s.rangeEstimateUm))
    invariant(s, "rangeEstimateUm", s.rangeEstimateUm, "integer micrometres");
  if (s.rangeEstimateUm < 0)
    invariant(s, "rangeEstimateUm", s.rangeEstimateUm, "range must be non-negative micrometres");
  if (!Number.isInteger(s.rangeUncertaintyUm))
    invariant(s, "rangeUncertaintyUm", s.rangeUncertaintyUm, "integer micrometres");
  if (s.rangeUncertaintyUm < 0)
    invariant(
      s,
      "rangeUncertaintyUm",
      s.rangeUncertaintyUm,
      "range uncertainty must be non-negative micrometres",
    );

  if (!Number.isInteger(s.fireControlSolutionQualityBp))
    invariant(
      s,
      "fireControlSolutionQualityBp",
      s.fireControlSolutionQualityBp,
      "integer basis points",
    );
  if (
    s.fireControlSolutionQualityBp < FIRE_CONTROL_SOLUTION_MIN_BP ||
    s.fireControlSolutionQualityBp > FIRE_CONTROL_SOLUTION_MAX_BP
  )
    invariant(
      s,
      "fireControlSolutionQualityBp",
      s.fireControlSolutionQualityBp,
      "fire-control solution outside [0,10_000]",
    );

  if (!Number.isInteger(s.reloadProgressMs))
    invariant(s, "reloadProgressMs", s.reloadProgressMs, "integer tactical milliseconds");
  if (s.reloadProgressMs < 0)
    invariant(s, "reloadProgressMs", s.reloadProgressMs, "reload progress must be non-negative ms");

  if (!Number.isInteger(s.lastSalvoMinute))
    invariant(s, "lastSalvoMinute", s.lastSalvoMinute, "integer minute");
  if (s.lastSalvoMinute < -1)
    invariant(s, "lastSalvoMinute", s.lastSalvoMinute, "lastSalvoMinute must be -1 (none) or >= 0");
  if (!Number.isInteger(s.lastSalvoSubstep) || s.lastSalvoSubstep < 0)
    invariant(s, "lastSalvoSubstep", s.lastSalvoSubstep, "integer non-negative substep");

  // ammunition: exact canonical key set + non-negative integer counts per type.
  const keys = Object.keys(s.ammunition ?? {});
  if (
    keys.length !== AMMUNITION_TYPES.length ||
    !AMMUNITION_TYPES.every((t) => Object.prototype.hasOwnProperty.call(s.ammunition, t))
  )
    invariant(
      s,
      "ammunition",
      s.ammunition,
      "ammunition must have exactly the canonical ammo-type key set",
    );
  for (const t of AMMUNITION_TYPES) {
    const count = s.ammunition[t];
    if (!Number.isInteger(count) || (count as number) < 0)
      invariant(
        s,
        `ammunition[${t}]`,
        count,
        "per-type ammunition count must be a non-negative integer",
      );
  }
}

// Authoritative deterministic state hash: canonicalSerialize + sha256 over the
// non-hash surface, domain-separated with the gunnery_v1 compatibility version.
// Any provided stateHash is ignored so the hash depends only on the state fields.
export function computeGunneryStateHash(s: GunneryState): string {
  const surface = {
    batteryId: s.batteryId,
    ownerShipId: s.ownerShipId,
    gunDefinitionId: s.gunDefinitionId,
    mountDefinitionId: s.mountDefinitionId,
    gunFamilyId: s.gunFamilyId,
    ammunitionPatternId: s.ammunitionPatternId,
    targetContactId: s.targetContactId,
    acquisitionProgressBp: s.acquisitionProgressBp,
    rangeEstimateUm: s.rangeEstimateUm,
    rangeUncertaintyUm: s.rangeUncertaintyUm,
    fireControlSolutionQualityBp: s.fireControlSolutionQualityBp,
    ammunition: s.ammunition,
    fireMode: s.fireMode,
    reloadProgressMs: s.reloadProgressMs,
    straddleState: s.straddleState,
    damageState: s.damageState,
    aaEligibilityState: s.aaEligibilityState,
    lastSalvoMinute: s.lastSalvoMinute,
    lastSalvoSubstep: s.lastSalvoSubstep,
    rulesetVersion: s.rulesetVersion,
    formulaVersion: s.formulaVersion,
  };
  return createEnvelope("gunnery-state", gunneryPolicyId, surface).bodyHash;
}

// Build a fully-invariant GunneryState with its authoritative hash computed.
export function withGunneryStateHash(s: Omit<GunneryState, "stateHash">): GunneryState {
  const full = s as GunneryState;
  assertFixedPointGunnery(full);
  return { ...full, stateHash: computeGunneryStateHash(full) };
}
