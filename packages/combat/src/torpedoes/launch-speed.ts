//packages/combat/src/torpedoes/launch-speed.ts
// DESIGN-40 §7 (underwater-tube speed limit) + §8 (above-water launcher limits)
// as pure, fail-closed launch-speed legality functions. Speed inputs are integer
// micrometres-per-second (µm/s) — the engine's fixed-point speed model surface
// (movement kinematics speedBpKnotsToUmS; 1 kn = 514_444 µm/s).
//
// §7: UNDERWATER_FIXED / UNDERWATER_TRAINABLE launchers MUST NOT fire when the
// launching ship's authoritative through-water speed is strictly greater than
// exactly 25 knots = 12_861_100 µm/s. `== 25 kn` is legal; `> 25 kn` is illegal.
// The check occurs at command validation AND again at the exact firing substep:
// both pure functions ship here with IDENTICAL predicates — INC-7's engine stage
// calls both, and a ship that accelerates above the threshold after issuance
// fails with UNDERWATER_TUBE_SPEED_LIMIT_EXCEEDED, consumes no torpedo, and the
// command completes with a failed-launch outcome (TorpedoLaunchOutcome).
// NOTE (recorded discrepancy): decision ticket 03 said "torpedo consumed" for the
// post-issuance-acceleration case; DESIGN-40 §7 (normative) and spec AC-7 / the
// INC-2 ticket both say "consume no torpedo" — DESIGN-40 governs.
// SUBMARINE_INTERNAL tubes use model-specific limits (C-3) and are NOT governed
// by this surface-ship threshold.
//
// §8: every above-water launcher family MUST declare an exact maximum launch
// speed — shipped default fixed 30 kn / trainable 35 kn, a definition MAY
// declare a narrower value (resolvedAboveWaterMaxLaunchSpeedKnots, launcher.ts).
// DESIGN-40 §8 ("The shipped default is …" + "MAY supply a narrower explicit
// value"): DEFAULTS APPLY WHEN UNSPECIFIED — an above-water definition with a
// null declared value is NOT missing metadata (the resolver yields the shipped
// default), and a null value is therefore never silently unlimited.
// TORPEDO_LAUNCH_SPEED_LIMIT_MISSING is the fail-closed outcome when the §8
// gate is invoked with an UNRESOLVABLE resolved value (mangled/absent metadata
// surface — e.g. the resolver returning null for a non-above-water definition
// fed to the gate); the gate never falls back to a silent default.
// (INC-2 hardening record — reviewer item 3.)
// Pure/deterministic: no ambient I/O/clock/random.
import { BluewaveError } from "@bluewave/contracts";
import {
  TORPEDO_KNOTS_TO_UM_S,
  TORPEDO_MOUNT_TYPES,
  type TorpedoMountType,
  UNDERWATER_TUBE_MAX_SPEED_UM_S,
} from "./constants.js";
import {
  TORPEDO_LAUNCH_SPEED_LIMIT_MISSING,
  TORPEDO_STATE_INVARIANT_FAILED,
  UNDERWATER_TUBE_SPEED_LIMIT_EXCEEDED,
} from "./reasonCodes.js";

function invariant(field: string, value: unknown, reason: string): never {
  throw new BluewaveError(TORPEDO_STATE_INVARIANT_FAILED, {
    code: TORPEDO_STATE_INVARIANT_FAILED,
    field,
    reason,
    value,
  });
}

// Fail-closed speed input check shared by every §7/§8 gate: speed must be a
// non-negative safe integer µm/s (ENGINEERING-CONTRACT arithmetic).
function assertSpeedInput(speedUmS: number, field: string): void {
  if (!Number.isInteger(speedUmS) || !Number.isSafeInteger(speedUmS) || speedUmS < 0)
    invariant(field, speedUmS, "speed must be a non-negative safe integer micrometres-per-second");
}

// AC-7: structured §7 verdict. `applicable` is false for mounts §7 does not
// govern (above-water — §8; SUBMARINE_INTERNAL — C-3 model-specific limits).
export interface SpeedLimitVerdict {
  applicable: boolean;
  allowed: boolean;
  reasonCode: "UNDERWATER_TUBE_SPEED_LIMIT_EXCEEDED" | "TORPEDO_LAUNCH_SPEED_LIMIT_MISSING" | null;
  speedUmS: number; // the exact input speed
  limitUmS: number | null; // the exact integer µm/s limit when applicable
}

// The §7 core predicate (identical for both check points):
// currentSpeedMicrometresPerSecond <= 12_861_100 for UNDERWATER_FIXED /
// UNDERWATER_TRAINABLE. 25 kn exactly is legal; any greater speed is illegal.
function evaluateUnderwaterTubeSpeedLimit(
  speedUmS: number,
  mountType: TorpedoMountType,
): SpeedLimitVerdict {
  assertSpeedInput(speedUmS, "currentSpeedMicrometresPerSecond");
  // Fail closed on a runtime mount-type violation: an unknown mount type must
  // never be silently treated as "not governed" (that would permit the launch).
  if (!(TORPEDO_MOUNT_TYPES as readonly string[]).includes(mountType))
    invariant("mountType", mountType, "mountType must be one of the five DESIGN-40 §2 values");
  const governed = mountType === "UNDERWATER_FIXED" || mountType === "UNDERWATER_TRAINABLE";
  if (!governed) {
    return { applicable: false, allowed: true, reasonCode: null, speedUmS, limitUmS: null };
  }
  if (speedUmS > UNDERWATER_TUBE_MAX_SPEED_UM_S) {
    return {
      applicable: true,
      allowed: false,
      reasonCode: UNDERWATER_TUBE_SPEED_LIMIT_EXCEEDED,
      speedUmS,
      limitUmS: UNDERWATER_TUBE_MAX_SPEED_UM_S,
    };
  }
  return {
    applicable: true,
    allowed: true,
    reasonCode: null,
    speedUmS,
    limitUmS: UNDERWATER_TUBE_MAX_SPEED_UM_S,
  };
}

// AC-7 check point 1: command validation (the engine stage runs this when the
// launch command is issued).
export function validateUnderwaterTubeSpeedLimitCommand(
  speedUmS: number,
  mountType: TorpedoMountType,
): SpeedLimitVerdict {
  return evaluateUnderwaterTubeSpeedLimit(speedUmS, mountType);
}

// AC-7 check point 2: the exact firing substep (the engine stage runs this
// again at the moment of fire — a ship that accelerated past issuance fails
// here even though the command check passed).
export function validateUnderwaterTubeSpeedLimitFiringSubstep(
  speedUmS: number,
  mountType: TorpedoMountType,
): SpeedLimitVerdict {
  return evaluateUnderwaterTubeSpeedLimit(speedUmS, mountType);
}

// The §7 predicate exposed under the ticket's primary name (identical behavior
// to the two check-point functions above).
export function validateUnderwaterTubeSpeedLimit(
  speedUmS: number,
  mountType: TorpedoMountType,
): SpeedLimitVerdict {
  return evaluateUnderwaterTubeSpeedLimit(speedUmS, mountType);
}

// AC-8: the §8 above-water launch-speed gate. `resolvedMaxLaunchSpeedKnots` is
// the caller-resolved exact maximum (resolvedAboveWaterMaxLaunchSpeedKnots on
// the TorpedoLauncherDefinition — shipped default fixed 30 / trainable 35, or a
// declared narrower value; an above-water definition with a null declared value
// resolves to the shipped default per §8 — defaults apply when unspecified).
// A null resolved value reaching this gate is an UNRESOLVABLE metadata surface
// -> TORPEDO_LAUNCH_SPEED_LIMIT_MISSING (fail-closed, never silently unlimited);
// the code path is unit-proved directly. Speed comparison is exact integer
// µm/s: maxUmS = knots * 514_444.
export function validateAboveWaterLaunchSpeedLimit(
  speedUmS: number,
  resolvedMaxLaunchSpeedKnots: number | null,
): SpeedLimitVerdict {
  assertSpeedInput(speedUmS, "currentSpeedMicrometresPerSecond");
  if (resolvedMaxLaunchSpeedKnots === null) {
    return {
      applicable: true,
      allowed: false,
      reasonCode: TORPEDO_LAUNCH_SPEED_LIMIT_MISSING,
      speedUmS,
      limitUmS: null,
    };
  }
  if (!Number.isInteger(resolvedMaxLaunchSpeedKnots) || resolvedMaxLaunchSpeedKnots <= 0)
    invariant(
      "resolvedMaxLaunchSpeedKnots",
      resolvedMaxLaunchSpeedKnots,
      "resolved §8 maximum launch speed must be a positive integer knots",
    );
  const limitUmS = resolvedMaxLaunchSpeedKnots * TORPEDO_KNOTS_TO_UM_S;
  if (!Number.isSafeInteger(limitUmS))
    invariant(
      "resolvedMaxLaunchSpeedKnots",
      resolvedMaxLaunchSpeedKnots,
      "resolved §8 maximum launch speed conversion produced an unsafe integer",
    );
  if (speedUmS > limitUmS) {
    return {
      applicable: true,
      allowed: false,
      // DESIGN-40 §29 ships exactly one launch-speed-limit-exceeded code, named
      // for the §7 underwater case; the §8 above-water exceeded case reuses it
      // as the closest shipped §29 code (recorded best-fit — a dedicated
      // above-water code would require a §29 amendment; flagged for the INC-8
      // ADR-0029 review).
      reasonCode: UNDERWATER_TUBE_SPEED_LIMIT_EXCEEDED,
      speedUmS,
      limitUmS,
    };
  }
  return { applicable: true, allowed: true, reasonCode: null, speedUmS, limitUmS };
}

// AC-7: the authoritative launch outcome vocabulary. The ENGINE stage (INC-7)
// constructs this when the firing-substep speed check fails AFTER command
// acceptance: the command completes with a FAILED_LAUNCH outcome, no torpedo is
// consumed (DESIGN-40 §7), and the exact §7 reason code is recorded. The type
// ships now so the engine contract is fixed; INC-4 widens the failed-launch
// reason-code union with §12 mechanical-failure outcomes.
export type TorpedoLaunchOutcome =
  | { status: "SUCCESSFUL_LAUNCH"; failedLaunch: false; torpedoConsumed: true }
  | {
      status: "FAILED_LAUNCH";
      failedLaunch: true;
      torpedoConsumed: false;
      reasonCode: "UNDERWATER_TUBE_SPEED_LIMIT_EXCEEDED";
    };
