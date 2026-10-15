import { describe, it, expect } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  assertFixedPointGunnery,
  computeGunneryStateHash,
  withGunneryStateHash,
  NO_TARGET,
  type GunneryState,
} from "../../src/gunnery/index.js";
import { AMMUNITION_TYPES } from "../../src/gunnery/index.js";

function ammo(overrides: Partial<Record<string, number>> = {}): Record<string, number> {
  return {
    ARMOR_PIERCING: 120,
    COMMON: 80,
    HIGH_EXPLOSIVE: 40,
    ...overrides,
  };
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

describe("AC-1 GunneryState invariant", () => {
  it("accepts a fully-integer GunneryState", () => {
    expect(() => assertFixedPointGunnery(base())).not.toThrow();
  });

  it("rejects a non-integer acquisitionProgressBp", () => {
    const s = base({ acquisitionProgressBp: 8_000.5 });
    let err: BluewaveError | undefined;
    try {
      assertFixedPointGunnery(s);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe("GUNNERY_STATE_INVARIANT_FAILED");
    expect(err!.context.field).toBe("acquisitionProgressBp");
  });

  it("rejects a non-integer range estimate", () => {
    const s = base({ rangeEstimateUm: 1.5 });
    let err: BluewaveError | undefined;
    try {
      assertFixedPointGunnery(s);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe("GUNNERY_STATE_INVARIANT_FAILED");
    expect(err!.context.field).toBe("rangeEstimateUm");
  });

  it("rejects a non-integer fire-control solution quality", () => {
    const s = base({ fireControlSolutionQualityBp: 7_500.25 });
    let err: BluewaveError | undefined;
    try {
      assertFixedPointGunnery(s);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.context.field).toBe("fireControlSolutionQualityBp");
  });

  it("rejects a negative reload progress", () => {
    const s = base({ reloadProgressMs: -1 });
    let err: BluewaveError | undefined;
    try {
      assertFixedPointGunnery(s);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.context.field).toBe("reloadProgressMs");
  });

  it("rejects a non-integer ammunition count", () => {
    const s = base({ ammunition: ammo({ COMMON: 80.5 }) as Record<string, any> }) as GunneryState;
    let err: BluewaveError | undefined;
    try {
      assertFixedPointGunnery(s);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe("GUNNERY_STATE_INVARIANT_FAILED");
    expect(err!.context.field).toBe("ammunition[COMMON]");
  });

  it("rejects a negative ammunition count", () => {
    const s = base({
      ammunition: ammo({ HIGH_EXPLOSIVE: -5 }) as Record<string, any>,
    }) as GunneryState;
    let err: BluewaveError | undefined;
    try {
      assertFixedPointGunnery(s);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe("GUNNERY_STATE_INVARIANT_FAILED");
  });

  it("rejects an ammunition object with a missing or extra key", () => {
    const missing = base();
    delete (missing as { ammunition: Record<string, number> }).ammunition.ARMOR_PIERCING;
    let err: BluewaveError | undefined;
    try {
      assertFixedPointGunnery(missing);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.context.code).toBe("GUNNERY_STATE_INVARIANT_FAILED");

    const extra = base({ ammunition: { ...ammo(), EXTRA: 1 } } as any as {
      ammunition: Record<string, number>;
    });
    expect(() => assertFixedPointGunnery(extra as unknown as GunneryState)).toThrow(
      "GUNNERY_STATE_INVARIANT_FAILED",
    );
  });

  it("rejects acquisition at the upper boundary +1 (10_001)", () => {
    expect(() => assertFixedPointGunnery(base({ acquisitionProgressBp: 10_001 }))).toThrow(
      BluewaveError,
    );
  });

  it("accepts boundary acquisition values 0 and 10_000", () => {
    expect(() => assertFixedPointGunnery(base({ acquisitionProgressBp: 0 }))).not.toThrow();
    expect(() => assertFixedPointGunnery(base({ acquisitionProgressBp: 10_000 }))).not.toThrow();
  });

  it("rejects lastSalvoMinute below -1", () => {
    expect(() => assertFixedPointGunnery(base({ lastSalvoMinute: -2 }))).toThrow(BluewaveError);
  });

  it("accepts lastSalvoMinute == -1 (no salvo yet)", () => {
    expect(() => assertFixedPointGunnery(base({ lastSalvoMinute: -1 }))).not.toThrow();
  });

  it("is reversible-to-invariant (does not mutate input on failure)", () => {
    const s = base({ reloadProgressMs: -50 });
    const before = JSON.stringify(s);
    try {
      assertFixedPointGunnery(s);
    } catch {
      // expected
    }
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe("AC-1 authoritative state hash (deterministic)", () => {
  it("computes a stable hash for identical states built independently", () => {
    const s1 = base();
    const s2 = base();
    expect(computeGunneryStateHash(s1)).toBe(computeGunneryStateHash(s2));
  });

  it("produces a 64-char sha256 hex digest", () => {
    expect(computeGunneryStateHash(base())).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes when any authoritative field changes", () => {
    const a = computeGunneryStateHash(base());
    const b = computeGunneryStateHash(base({ reloadProgressMs: 12_001 }));
    expect(a).not.toBe(b);
    const c = computeGunneryStateHash(base({ targetContactId: NO_TARGET }));
    expect(a).not.toBe(c);
    const d = computeGunneryStateHash(base({ ammunition: ammo({ COMMON: 81 }) }));
    expect(a).not.toBe(d);
  });

  it("withGunneryStateHash fills the authoritative stateHash and stays invariant", () => {
    const full = withGunneryStateHash(base());
    expect(full.stateHash).toBe(computeGunneryStateHash(full));
    expect(() => assertFixedPointGunnery(full)).not.toThrow();
  });

  it("hash ignores an arbitrary/stale provided stateHash (depends only on fields)", () => {
    const withFilled = withGunneryStateHash(base());
    const tampered = { ...withFilled, stateHash: "deadbeef" };
    expect(computeGunneryStateHash(tampered)).toBe(withFilled.stateHash);
  });
});

describe("AC-1 GunneryState numeric surface ships the canonical ammo type set", () => {
  it("ammunition types are the base canonical seed set", () => {
    expect([...AMMUNITION_TYPES]).toEqual(["ARMOR_PIERCING", "COMMON", "HIGH_EXPLOSIVE"]);
  });
});
