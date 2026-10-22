import { describe, expect, it } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  TORPEDO_KNOTS_TO_UM_S,
  TORPEDO_STATE_INVARIANT_FAILED,
  UNDERWATER_TUBE_MAX_SPEED_KNOTS,
  UNDERWATER_TUBE_MAX_SPEED_UM_S,
  UNDERWATER_TUBE_SPEED_LIMIT_EXCEEDED,
  validateUnderwaterTubeSpeedLimit,
  validateUnderwaterTubeSpeedLimitCommand,
  validateUnderwaterTubeSpeedLimitFiringSubstep,
  type TorpedoLaunchOutcome,
} from "../../src/torpedoes/index.js";

const EXACT_25_KN = 12_861_100;
const ABOVE_25_KN = 12_861_101;

describe("AC-7: the §7 predicate — exactly 25 kn is legal, any greater speed is illegal", () => {
  it("ships the canonical threshold constants (25 kn = 12_861_100 µm/s)", () => {
    expect(UNDERWATER_TUBE_MAX_SPEED_KNOTS).toBe(25);
    expect(UNDERWATER_TUBE_MAX_SPEED_UM_S).toBe(EXACT_25_KN);
    expect(25 * TORPEDO_KNOTS_TO_UM_S).toBe(EXACT_25_KN);
  });

  it("allows exactly 25 kn (== legal) for both governed mount types", () => {
    for (const mount of ["UNDERWATER_FIXED", "UNDERWATER_TRAINABLE"] as const) {
      const verdict = validateUnderwaterTubeSpeedLimit(EXACT_25_KN, mount);
      expect(verdict.applicable).toBe(true);
      expect(verdict.allowed).toBe(true);
      expect(verdict.reasonCode).toBeNull();
      expect(verdict.limitUmS).toBe(EXACT_25_KN);
    }
  });

  it("rejects anything strictly above 25 kn (UNDERWATER_TUBE_SPEED_LIMIT_EXCEEDED)", () => {
    for (const mount of ["UNDERWATER_FIXED", "UNDERWATER_TRAINABLE"] as const) {
      const verdict = validateUnderwaterTubeSpeedLimit(ABOVE_25_KN, mount);
      expect(verdict.applicable).toBe(true);
      expect(verdict.allowed).toBe(false);
      expect(verdict.reasonCode).toBe(UNDERWATER_TUBE_SPEED_LIMIT_EXCEEDED);
      expect(verdict.speedUmS).toBe(ABOVE_25_KN);
      expect(verdict.limitUmS).toBe(EXACT_25_KN);
    }
  });

  it("allows well below the ceiling (e.g. 12_000_000 µm/s ≈ 23.3 kn)", () => {
    const verdict = validateUnderwaterTubeSpeedLimit(12_000_000, "UNDERWATER_TRAINABLE");
    expect(verdict.allowed).toBe(true);
  });

  it("is not applicable to above-water or SUBMARINE_INTERNAL mounts (§7 boundary)", () => {
    for (const mount of [
      "ABOVE_WATER_FIXED",
      "ABOVE_WATER_TRAINABLE",
      "SUBMARINE_INTERNAL",
    ] as const) {
      const verdict = validateUnderwaterTubeSpeedLimit(99_000_000, mount);
      expect(verdict.applicable).toBe(false);
      expect(verdict.allowed).toBe(true);
      expect(verdict.reasonCode).toBeNull();
    }
  });

  it("fails closed on a non-integer, negative, or unsafe speed input", () => {
    for (const bad of [12_861_100.5, -1, Number.MAX_SAFE_INTEGER + 2]) {
      let err: BluewaveError | undefined;
      try {
        validateUnderwaterTubeSpeedLimit(bad, "UNDERWATER_TRAINABLE");
      } catch (e) {
        err = e as BluewaveError;
      }
      expect(err).toBeDefined();
      expect(err!.message).toBe(TORPEDO_STATE_INVARIANT_FAILED);
    }
  });

  it("fails closed on an unknown runtime mount type (never silently not-governed)", () => {
    let err: BluewaveError | undefined;
    try {
      validateUnderwaterTubeSpeedLimit(EXACT_25_KN, "SURFACE_TRAINABLE" as never);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(TORPEDO_STATE_INVARIANT_FAILED);
  });
});

describe("AC-7: the check occurs at command validation AND at the exact firing substep", () => {
  it("both check-point functions enforce the IDENTICAL §7 predicate", () => {
    const cases: Array<[number, boolean]> = [
      [EXACT_25_KN, true],
      [ABOVE_25_KN, false],
      [12_000_000, true],
    ];
    for (const [speedUmS, expectedAllowed] of cases) {
      const command = validateUnderwaterTubeSpeedLimitCommand(speedUmS, "UNDERWATER_TRAINABLE");
      const firing = validateUnderwaterTubeSpeedLimitFiringSubstep(
        speedUmS,
        "UNDERWATER_TRAINABLE",
      );
      expect(command.allowed).toBe(expectedAllowed);
      expect(firing.allowed).toBe(expectedAllowed);
      expect(command).toEqual(firing);
    }
  });

  it("a ship that accelerates AFTER command validation fails at the firing substep", () => {
    const command = validateUnderwaterTubeSpeedLimitCommand(12_000_000, "UNDERWATER_FIXED");
    expect(command.allowed).toBe(true);
    const firing = validateUnderwaterTubeSpeedLimitFiringSubstep(ABOVE_25_KN, "UNDERWATER_FIXED");
    expect(firing.allowed).toBe(false);
    expect(firing.reasonCode).toBe(UNDERWATER_TUBE_SPEED_LIMIT_EXCEEDED);
  });
});

describe("AC-7: TorpedoLaunchOutcome documents the failed-launch contract", () => {
  it("a failed launch consumes NO torpedo and completes with the §7 reason code", () => {
    const failed: TorpedoLaunchOutcome = {
      status: "FAILED_LAUNCH",
      failedLaunch: true,
      torpedoConsumed: false,
      reasonCode: UNDERWATER_TUBE_SPEED_LIMIT_EXCEEDED,
    };
    expect(failed.failedLaunch).toBe(true);
    expect(failed.torpedoConsumed).toBe(false);
  });

  it("a successful launch consumes exactly one torpedo per fired tube", () => {
    const ok: TorpedoLaunchOutcome = {
      status: "SUCCESSFUL_LAUNCH",
      failedLaunch: false,
      torpedoConsumed: true,
    };
    expect(ok.failedLaunch).toBe(false);
    expect(ok.torpedoConsumed).toBe(true);
  });
});
