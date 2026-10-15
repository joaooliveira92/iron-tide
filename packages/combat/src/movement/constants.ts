// Versioned authoritative movement-kinematics constants (DESIGN-38 §20 +
// DESIGN-07 fixed-point). Grounded in docs/research/b2-m2-movement-spotting.md
// and recorded in the B-2 ADR. All values shipped as *_v1 with a validate guard.
import { BluewaveError } from "@bluewave/contracts";

export const movementKinematicsPolicyId = "movement_kinematics_v1" as const;

// 1 knot = 1852 m / 3600 s = 0.514444... m/s = 514444 µm/s (rounded integer).
export const KNOTS_TO_UM_S = 514_444 as const;
// speeds in MovementState are basis-point knots (knots * 1000).
export const SPEED_BP_SCALE = 1_000 as const;
// fixed-point scale for direction unit vectors.
export const DIRECTION_FIXED = 10_000 as const;
// substep = 1 tactical second; a minute = 60 substeps.
export const SUBSTEP_SECONDS = 1 as const;
export const SUBSTEPS_PER_MINUTE = 60 as const;
// radians/degree constant used for heading interpolation (deterministic).
export const DEG_TO_RAD = 0.017_453_292_519_943_295 as const;
// bounded thrust (ahead) / brake (astern) acceleration, in basis-point knots per
// second, within research balance bounds (dreadnought-class throttle response).
export const PROPULSION_ACCEL_KNOT_BP_PER_S = 40 as const;
export const PROPULSION_DECEL_KNOT_BP_PER_S = 60 as const;
// default design turning rate, milli-degrees/s (1.0 °/s at full helm for
// battleship-class hulls; research: ~0.5-1.5 °/s).
export const DESIGN_TURNING_RATE_MDEG_S = 1_000 as const;
// safety minimum turning capability reused by turn-away predicates (mdg/s).
export const TURNING_SAFETY_MINIMUM_MDEG_S = 300 as const;

// Formation-station distances are in micrometres.
export const LINE_AHEAD_COLUMN_INTERVAL_UM = 400_000_000 as const; // ~400 m
export const LINE_AHEAD_DIVISION_GAP_UM = 500_000_000 as const; // ~2-4 cables
export const LINE_ABREAST_ABREAST_INTERVAL_UM = 400_000_000 as const;
export const STATION_TOLERANCE_UM = 50_000_000 as const; // ~50 m station drift
export const STATION_BEARING_TOLERANCE_MDEG = 3_000 as const; // ~3 ° bearing error

export interface MovementKinematicsContract {
  policyId: string;
  knotsToUmS: number;
  speedBpScale: number;
  directionFixed: number;
  substepSeconds: number;
  substepsPerMinute: number;
  degToRad: number;
  propulsionAccelKnotBpPerS: number;
  propulsionDecelKnotBpPerS: number;
  designTurningRateMdegS: number;
  turningSafetyMinimumMdegS: number;
}
export const SHIPPED_MOVEMENT_KINEMATICS_CONTRACT: MovementKinematicsContract = {
  policyId: movementKinematicsPolicyId,
  knotsToUmS: KNOTS_TO_UM_S,
  speedBpScale: SPEED_BP_SCALE,
  directionFixed: DIRECTION_FIXED,
  substepSeconds: SUBSTEP_SECONDS,
  substepsPerMinute: SUBSTEPS_PER_MINUTE,
  degToRad: DEG_TO_RAD,
  propulsionAccelKnotBpPerS: PROPULSION_ACCEL_KNOT_BP_PER_S,
  propulsionDecelKnotBpPerS: PROPULSION_DECEL_KNOT_BP_PER_S,
  designTurningRateMdegS: DESIGN_TURNING_RATE_MDEG_S,
  turningSafetyMinimumMdegS: TURNING_SAFETY_MINIMUM_MDEG_S,
};
export function validateMovementKinematicsContract(
  c: Partial<MovementKinematicsContract> | null | undefined,
): asserts c is MovementKinematicsContract {
  if (!c || c.policyId !== movementKinematicsPolicyId) {
    throw new BluewaveError("TACTICAL_STATE_INVARIANT_FAILED", {
      code: "TACTICAL_STATE_INVARIANT_FAILED",
      contract: c,
      reason: "movement_kinematics_v1 expectant policy id",
    });
  }
  if (c.knotsToUmS !== KNOTS_TO_UM_S || c.speedBpScale !== SPEED_BP_SCALE) {
    throw new BluewaveError("TACTICAL_STATE_INVARIANT_FAILED", {
      code: "TACTICAL_STATE_INVARIANT_FAILED",
      contract: c,
      reason: "movement_kinematics_v1 speed scale",
    });
  }
  if (c.directionFixed !== DIRECTION_FIXED || c.substepsPerMinute !== SUBSTEPS_PER_MINUTE) {
    throw new BluewaveError("TACTICAL_STATE_INVARIANT_FAILED", {
      code: "TACTICAL_STATE_INVARIANT_FAILED",
      contract: c,
      reason: "movement_kinematics_v1 scale/integration",
    });
  }
  const ac = c.propulsionAccelKnotBpPerS;
  const dc = c.propulsionDecelKnotBpPerS;
  const tr = c.designTurningRateMdegS;
  if (ac === undefined || dc === undefined || tr === undefined || ac <= 0 || dc <= 0 || tr <= 0) {
    throw new BluewaveError("TACTICAL_STATE_INVARIANT_FAILED", {
      code: "TACTICAL_STATE_INVARIANT_FAILED",
      contract: c,
      reason: "movement_kinematics_v1 non-positive dynamics",
    });
  }
}

export interface FormationStationContract {
  lineAheadColumnIntervalUm: number;
  lineAheadDivisionGapUm: number;
  lineAbreastIntervalUm: number;
  stationToleranceUm: number;
  stationBearingToleranceMdeg: number;
}
export const SHIPPED_FORMATION_STATION_CONTRACT: FormationStationContract = {
  lineAheadColumnIntervalUm: LINE_AHEAD_COLUMN_INTERVAL_UM,
  lineAheadDivisionGapUm: LINE_AHEAD_DIVISION_GAP_UM,
  lineAbreastIntervalUm: LINE_ABREAST_ABREAST_INTERVAL_UM,
  stationToleranceUm: STATION_TOLERANCE_UM,
  stationBearingToleranceMdeg: STATION_BEARING_TOLERANCE_MDEG,
};
export function validateFormationStationContract(
  c: Partial<FormationStationContract> | null | undefined,
): asserts c is FormationStationContract {
  if (
    !c ||
    c.lineAheadColumnIntervalUm !== LINE_AHEAD_COLUMN_INTERVAL_UM ||
    c.lineAheadDivisionGapUm !== LINE_AHEAD_DIVISION_GAP_UM ||
    c.lineAbreastIntervalUm !== LINE_ABREAST_ABREAST_INTERVAL_UM ||
    c.stationToleranceUm !== STATION_TOLERANCE_UM ||
    c.stationBearingToleranceMdeg !== STATION_BEARING_TOLERANCE_MDEG
  ) {
    throw new BluewaveError("TACTICAL_STATE_INVARIANT_FAILED", {
      code: "TACTICAL_STATE_INVARIANT_FAILED",
      contract: c,
      reason: "formation_station_v1 mismatch",
    });
  }
}
