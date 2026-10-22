import { describe, it, expect } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  FIRE_MODES,
  FIRE_MODE_DEFINITIONS,
  assertFireModeClosed,
  assertFireModeEligible,
  getFireModeDefinition,
  GUNNERY_ELIGIBILITY_PREDICATE_DEFERRED,
  GUNNERY_FIRE_CONTROL_SOLUTION_INSUFFICIENT,
  SURFACE_FIRE_CONTROL_MINIMUM_BP,
  type FireMode,
  type GunneryState,
} from "@bluewave/combat/gunnery";

const SEVEN = [
  "CEASE_FIRE",
  "RANGING",
  "NORMAL",
  "RAPID",
  "AA_TRACKING",
  "AA_BARRAGE",
  "LOCAL_CONTROL",
] as const;

function ammo(): Record<string, number> {
  return { ARMOR_PIERCING: 120, COMMON: 80, HIGH_EXPLOSIVE: 40 };
}

function base(overrides: Partial<GunneryState> = {}): GunneryState {
  return {
    batteryId: "BAT-1",
    ownerShipId: "SHIP-ALPHA",
    gunDefinitionId: "GUN-305-45",
    mountDefinitionId: "MNT-305-TWIN",
    targetContactId: "battle:asset-omega",
    acquisitionProgressBp: 8_000,
    rangeEstimateUm: 12_000_000_000,
    rangeUncertaintyUm: 150_000_000,
    fireControlSolutionQualityBp: 7_500,
    ammunition: ammo(),
    fireMode: "NORMAL",
    reloadProgressMs: 12_000,
    straddleState: null,
    damageState: null,
    aaEligibilityState: null,
    lastSalvoMinute: 1,
    lastSalvoSubstep: 0,
    rulesetVersion: "gunnery_ruleset_v1",
    formulaVersion: "gunnery_formula_v1",
    stateHash: "",
    ...overrides,
  };
}

describe("AC-2 canonical fire modes as a closed enum", () => {
  it("ships exactly the seven canonical DESIGN-39 §2 modes", () => {
    expect([...FIRE_MODES]).toEqual([...SEVEN]);
  });

  it("has a per-mode record for every canonical mode", () => {
    for (const mode of SEVEN as readonly string[]) {
      const def = FIRE_MODE_DEFINITIONS[mode as FireMode];
      expect(def.mode).toBe(mode);
      expect(typeof def.ammunitionUse).toBe("string");
      expect(typeof def.reloadBehavior).toBe("string");
      expect(typeof def.accuracyBehavior).toBe("string");
      expect(typeof def.targetEligibility).toBe("string");
      expect(typeof def.fireControlRequirements).toBe("string");
      expect(typeof def.cancellationBehavior).toBe("string");
    }
  });

  it("has a mode count matching the closed set (no silent extras)", () => {
    expect(Object.keys(FIRE_MODE_DEFINITIONS).sort()).toEqual([...SEVEN].sort());
  });

  it("assertFireModeClosed rejects a non-canonical mode with INVALID_GUNNERY_STATE", () => {
    let err: BluewaveError | undefined;
    try {
      assertFireModeClosed("MAYBE_FIRE");
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.context.code).toBe("INVALID_GUNNERY_STATE");
  });

  it("getFireModeDefinition returns the record for a mode", () => {
    expect(getFireModeDefinition("RAPID").targetEligibility.length).toBeGreaterThan(0);
  });
});

describe("AC-2 deferred eligibility predicates report rather than fabricate", () => {
  it("RAPID / AA_TRACKING / AA_BARRAGE are marked DEFERRED", () => {
    for (const mode of ["RAPID", "AA_TRACKING", "AA_BARRAGE"] as const) {
      const def = FIRE_MODE_DEFINITIONS[mode];
      expect(def.eligibilityPredicateDeferred).toBe(true);
      expect(def.deferredReason).toBe(GUNNERY_ELIGIBILITY_PREDICATE_DEFERRED);
    }
  });

  it("implemented surface modes are not marked deferred", () => {
    for (const mode of ["CEASE_FIRE", "RANGING", "NORMAL", "LOCAL_CONTROL"] as const) {
      expect(FIRE_MODE_DEFINITIONS[mode].eligibilityPredicateDeferred).toBe(false);
    }
  });

  it("assertFireModeEligible reports the deferred predicate for RAPID mode", () => {
    const s = base({ fireMode: "RAPID" });
    let err: BluewaveError | undefined;
    try {
      assertFireModeEligible("RAPID", s);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.context.code).toBe(GUNNERY_ELIGIBILITY_PREDICATE_DEFERRED);
    expect(err!.context.mode).toBe("RAPID");
  });

  it("assertFireModeEligible reports the deferred predicate for AA_TRACKING", () => {
    expect(() => assertFireModeEligible("AA_TRACKING", base({ fireMode: "AA_TRACKING" }))).toThrow(
      GUNNERY_ELIGIBILITY_PREDICATE_DEFERRED,
    );
  });

  it("assertFireModeEligible reports the deferred predicate for AA_BARRAGE", () => {
    expect(() => assertFireModeEligible("AA_BARRAGE", base({ fireMode: "AA_BARRAGE" }))).toThrow(
      GUNNERY_ELIGIBILITY_PREDICATE_DEFERRED,
    );
  });

  it("the deferred predicate is re-checked even for an otherwise valid state", () => {
    const s = base({ fireMode: "RAPID", fireControlSolutionQualityBp: 10_000 });
    expect(() => assertFireModeEligible("RAPID", s)).toThrow(
      GUNNERY_ELIGIBILITY_PREDICATE_DEFERRED,
    );
  });
});

describe("AC-2 implemented surface-mode firing guard", () => {
  it("NORMAL fires when the fire-control solution is at/above the threshold", () => {
    const s = base({
      fireMode: "NORMAL",
      fireControlSolutionQualityBp: SURFACE_FIRE_CONTROL_MINIMUM_BP,
    });
    expect(() => assertFireModeEligible("NORMAL", s)).not.toThrow();
  });

  it("NORMAL fails with GUNNERY_FIRE_CONTROL_SOLUTION_INSUFFICIENT below threshold", () => {
    const s = base({
      fireMode: "NORMAL",
      fireControlSolutionQualityBp: SURFACE_FIRE_CONTROL_MINIMUM_BP - 1,
    });
    let err: BluewaveError | undefined;
    try {
      assertFireModeEligible("NORMAL", s);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.context.code).toBe(GUNNERY_FIRE_CONTROL_SOLUTION_INSUFFICIENT);
  });

  it("CEASE_FIRE passes trivially (intentional no-fire mode)", () => {
    const s = base({ fireMode: "CEASE_FIRE", fireControlSolutionQualityBp: 0 });
    expect(() => assertFireModeEligible("CEASE_FIRE", s)).not.toThrow();
  });
});
