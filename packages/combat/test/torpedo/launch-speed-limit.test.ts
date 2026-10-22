import { describe, expect, it } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  ABOVE_WATER_FIXED_MAX_LAUNCH_SPEED_KNOTS,
  ABOVE_WATER_TRAINABLE_MAX_LAUNCH_SPEED_KNOTS,
  resolvedAboveWaterMaxLaunchSpeedKnots,
  TORPEDO_KNOTS_TO_UM_S,
  TORPEDO_LAUNCH_SPEED_LIMIT_MISSING,
  TORPEDO_STATE_INVARIANT_FAILED,
  UNDERWATER_TUBE_SPEED_LIMIT_EXCEEDED,
  validateAboveWaterLaunchSpeedLimit,
  type TorpedoLauncherDefinition,
} from "@bluewave/combat/torpedoes";

const FIXED_30_KN = 15_433_320;
const TRAINABLE_35_KN = 18_005_540;
const NARROW_28_KN = 14_404_432;

function aboveWaterDefinition(
  overrides: Partial<TorpedoLauncherDefinition> = {},
): TorpedoLauncherDefinition {
  return {
    launcherFamilyId: "533mm_above_water_trainable",
    mountType: "ABOVE_WATER_TRAINABLE",
    tubeCount: 2,
    boreDiameterMm: 533,
    handlingMassLimitKg: 1_600,
    supportedPropulsionTypes: ["WET_HEATER", "ELECTRIC"],
    fireControlSupportedGuidance: ["gyro"],
    underwaterLaunchCapability: false,
    requiredReloadTimeMs: 120_000,
    aboveWaterMaxLaunchSpeedKnots: null,
    ...overrides,
  };
}

describe("AC-8: §8 defaults — 30 kn fixed, 35 kn trainable", () => {
  it("ships the exact integer defaults and conversion", () => {
    expect(ABOVE_WATER_FIXED_MAX_LAUNCH_SPEED_KNOTS).toBe(30);
    expect(ABOVE_WATER_TRAINABLE_MAX_LAUNCH_SPEED_KNOTS).toBe(35);
    expect(30 * TORPEDO_KNOTS_TO_UM_S).toBe(FIXED_30_KN);
    expect(35 * TORPEDO_KNOTS_TO_UM_S).toBe(TRAINABLE_35_KN);
  });

  it("resolves the shipped default when the definition declares no narrower value", () => {
    expect(
      resolvedAboveWaterMaxLaunchSpeedKnots(
        aboveWaterDefinition({ mountType: "ABOVE_WATER_FIXED" }),
      ),
    ).toBe(30);
    expect(resolvedAboveWaterMaxLaunchSpeedKnots(aboveWaterDefinition())).toBe(35);
  });

  it("exactly 35 kn is legal on a trainable mount; 35 kn + 1 µm/s is illegal", () => {
    const legal = validateAboveWaterLaunchSpeedLimit(TRAINABLE_35_KN, 35);
    expect(legal.allowed).toBe(true);
    expect(legal.reasonCode).toBeNull();
    expect(legal.limitUmS).toBe(TRAINABLE_35_KN);
    const illegal = validateAboveWaterLaunchSpeedLimit(TRAINABLE_35_KN + 1, 35);
    expect(illegal.allowed).toBe(false);
    expect(illegal.reasonCode).toBe(UNDERWATER_TUBE_SPEED_LIMIT_EXCEEDED);
    expect(illegal.speedUmS).toBe(TRAINABLE_35_KN + 1);
    expect(illegal.limitUmS).toBe(TRAINABLE_35_KN);
  });

  it("exactly 30 kn is legal on a fixed mount; 30 kn + 1 µm/s is illegal", () => {
    expect(validateAboveWaterLaunchSpeedLimit(FIXED_30_KN, 30).allowed).toBe(true);
    expect(validateAboveWaterLaunchSpeedLimit(FIXED_30_KN + 1, 30).allowed).toBe(false);
  });
});

describe("AC-8: a declared narrower limit binds", () => {
  it("28 kn exactly is legal; 28 kn + 1 µm/s is illegal under the declared limit", () => {
    const narrow = aboveWaterDefinition({ aboveWaterMaxLaunchSpeedKnots: 28 });
    expect(resolvedAboveWaterMaxLaunchSpeedKnots(narrow)).toBe(28);
    const legal = validateAboveWaterLaunchSpeedLimit(
      NARROW_28_KN,
      resolvedAboveWaterMaxLaunchSpeedKnots(narrow),
    );
    expect(legal.allowed).toBe(true);
    expect(legal.limitUmS).toBe(NARROW_28_KN);
    const illegal = validateAboveWaterLaunchSpeedLimit(
      NARROW_28_KN + 1,
      resolvedAboveWaterMaxLaunchSpeedKnots(narrow),
    );
    expect(illegal.allowed).toBe(false);
    expect(illegal.reasonCode).toBe(UNDERWATER_TUBE_SPEED_LIMIT_EXCEEDED);
  });
});

describe("AC-8: §8 defaults apply when unspecified (reviewer item 3 reachability)", () => {
  it("null declared on an above-water mount resolves to the shipped default — NOT missing metadata", () => {
    const d = aboveWaterDefinition();
    expect(resolvedAboveWaterMaxLaunchSpeedKnots(d)).toBe(35);
    const verdict = validateAboveWaterLaunchSpeedLimit(
      TRAINABLE_35_KN,
      resolvedAboveWaterMaxLaunchSpeedKnots(d),
    );
    expect(verdict.allowed).toBe(true);
    expect(verdict.reasonCode).toBeNull();
  });

  it("an unresolvable resolved value never becomes a silent unlimited default", () => {
    const underwater = aboveWaterDefinition({
      launcherFamilyId: "533mm_underwater_trainable",
      mountType: "UNDERWATER_TRAINABLE",
      underwaterLaunchCapability: true,
    });
    expect(resolvedAboveWaterMaxLaunchSpeedKnots(underwater)).toBeNull();
    const verdict = validateAboveWaterLaunchSpeedLimit(
      99_000_000,
      resolvedAboveWaterMaxLaunchSpeedKnots(underwater),
    );
    expect(verdict.applicable).toBe(true);
    expect(verdict.allowed).toBe(false);
    expect(verdict.reasonCode).toBe(TORPEDO_LAUNCH_SPEED_LIMIT_MISSING);
    expect(verdict.limitUmS).toBeNull();
  });
});

describe("AC-8: missing §8 metadata fails closed", () => {
  it("a null resolved maximum -> TORPEDO_LAUNCH_SPEED_LIMIT_MISSING (never silently unlimited)", () => {
    const verdict = validateAboveWaterLaunchSpeedLimit(10_000_000, null);
    expect(verdict.applicable).toBe(true);
    expect(verdict.allowed).toBe(false);
    expect(verdict.reasonCode).toBe(TORPEDO_LAUNCH_SPEED_LIMIT_MISSING);
    expect(verdict.limitUmS).toBeNull();
  });

  it("the resolver returns null for a non-above-water mount (the gate is never reached)", () => {
    const underwater = aboveWaterDefinition({
      launcherFamilyId: "533mm_underwater_trainable",
      mountType: "UNDERWATER_TRAINABLE",
      underwaterLaunchCapability: true,
    });
    expect(resolvedAboveWaterMaxLaunchSpeedKnots(underwater)).toBeNull();
  });
});

describe("AC-8: fail-closed input invariants (TORPEDO_STATE_INVARIANT_FAILED)", () => {
  it("rejects a non-integer, negative, or unsafe speed", () => {
    for (const bad of [15_433_320.5, -1, Number.MAX_SAFE_INTEGER + 2]) {
      let err: BluewaveError | undefined;
      try {
        validateAboveWaterLaunchSpeedLimit(bad, 30);
      } catch (e) {
        err = e as BluewaveError;
      }
      expect(err).toBeDefined();
      expect(err!.message).toBe(TORPEDO_STATE_INVARIANT_FAILED);
    }
  });

  it("rejects a non-positive or non-integer resolved maximum", () => {
    for (const bad of [0, -30, 30.5]) {
      let err: BluewaveError | undefined;
      try {
        validateAboveWaterLaunchSpeedLimit(10_000_000, bad);
      } catch (e) {
        err = e as BluewaveError;
      }
      expect(err).toBeDefined();
      expect(err!.message).toBe(TORPEDO_STATE_INVARIANT_FAILED);
    }
  });

  it("rejects a resolved maximum whose conversion overflows the safe-integer boundary", () => {
    let err: BluewaveError | undefined;
    try {
      validateAboveWaterLaunchSpeedLimit(10_000_000, Number.MAX_SAFE_INTEGER);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(TORPEDO_STATE_INVARIANT_FAILED);
  });
});
