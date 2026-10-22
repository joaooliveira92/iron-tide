import { describe, it, expect } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  assertFixedPointDamage,
  computeDamageStateHash,
  withDamageStateHash,
  type ShipDamageState,
} from "../../src/damage/index.js";

function baseFireRecord() {
  return { locationId: "COMP-1", intensityBp: 3_000, cause: "hit" };
}

function baseFloodingRecord() {
  return { compartmentId: "COMP-2", rateKgMin: 500, cause: "penetration" };
}

function base(overrides: Partial<ShipDamageState> = {}): ShipDamageState {
  return {
    shipId: "SHIP-ALPHA",
    compartments: ["COMP-1", "COMP-2", "COMP-3"],
    components: ["TURRET-1", "TURRET-2", "ENGINE-1"],
    structuralIntegrity: 100_000,
    flotationReserve: 50_000,
    stabilityScore: 8_000,
    fireRecords: [baseFireRecord()],
    floodingRecords: [baseFloodingRecord()],
    progressiveFloodingTotal: 2_000,
    performanceModifiers: { speedBp: 10_000, maneuverBp: 10_000 },
    terminalStatus: "NORMAL",
    rulesetVersion: "damage_ruleset_v1",
    formulaVersion: "damage_formula_v1",
    stateHash: "",
    ...overrides,
  };
}

describe("AC-1: ShipDamageState invariant (assertFixedPointDamage)", () => {
  it("accepts a fully-valid ShipDamageState", () => {
    expect(() => assertFixedPointDamage(base())).not.toThrow();
  });

  it("rejects a missing shipId", () => {
    const s = base({ shipId: "" });
    let err: BluewaveError | undefined;
    try {
      assertFixedPointDamage(s);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe("DAMAGE_STATE_INVARIANT_FAILED");
    expect(err!.context.field).toBe("shipId");
  });

  it("rejects a non-integer structuralIntegrity", () => {
    const s = base({ structuralIntegrity: 100_000.5 });
    let err: BluewaveError | undefined;
    try {
      assertFixedPointDamage(s);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe("DAMAGE_STATE_INVARIANT_FAILED");
    expect(err!.context.field).toBe("structuralIntegrity");
  });

  it("rejects a negative structuralIntegrity", () => {
    const s = base({ structuralIntegrity: -1 });
    let err: BluewaveError | undefined;
    try {
      assertFixedPointDamage(s);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe("DAMAGE_STATE_INVARIANT_FAILED");
  });

  it("rejects a non-integer flotationReserve", () => {
    const s = base({ flotationReserve: 50_000.25 });
    let err: BluewaveError | undefined;
    try {
      assertFixedPointDamage(s);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.context.field).toBe("flotationReserve");
  });

  it("rejects a negative flotationReserve", () => {
    expect(() => assertFixedPointDamage(base({ flotationReserve: -1 }))).toThrow(BluewaveError);
  });

  it("rejects a non-integer stabilityScore", () => {
    expect(() => assertFixedPointDamage(base({ stabilityScore: 8_000.1 }))).toThrow(BluewaveError);
  });

  it("rejects stabilityScore above 10_000", () => {
    expect(() => assertFixedPointDamage(base({ stabilityScore: 10_001 }))).toThrow(BluewaveError);
  });

  it("rejects stabilityScore below 0", () => {
    expect(() => assertFixedPointDamage(base({ stabilityScore: -1 }))).toThrow(BluewaveError);
  });

  it("accepts boundary stabilityScore values 0 and 10_000", () => {
    expect(() => assertFixedPointDamage(base({ stabilityScore: 0 }))).not.toThrow();
    expect(() => assertFixedPointDamage(base({ stabilityScore: 10_000 }))).not.toThrow();
  });

  it("rejects a non-integer progressiveFloodingTotal", () => {
    expect(() => assertFixedPointDamage(base({ progressiveFloodingTotal: 2_000.5 }))).toThrow(
      BluewaveError,
    );
  });

  it("rejects a negative progressiveFloodingTotal", () => {
    expect(() => assertFixedPointDamage(base({ progressiveFloodingTotal: -1 }))).toThrow(
      BluewaveError,
    );
  });

  it("rejects a non-integer fire record intensityBp", () => {
    const s = base({
      fireRecords: [{ locationId: "COMP-1", intensityBp: 3_000.5, cause: "hit" }],
    });
    expect(() => assertFixedPointDamage(s)).toThrow(BluewaveError);
  });

  it("rejects a fire record intensityBp above 10_000", () => {
    const s = base({
      fireRecords: [{ locationId: "COMP-1", intensityBp: 10_001, cause: "hit" }],
    });
    expect(() => assertFixedPointDamage(s)).toThrow(BluewaveError);
  });

  it("rejects a non-integer flooding rateKgMin", () => {
    const s = base({
      floodingRecords: [{ compartmentId: "COMP-2", rateKgMin: 500.5, cause: "penetration" }],
    });
    expect(() => assertFixedPointDamage(s)).toThrow(BluewaveError);
  });

  it("rejects a negative flooding rateKgMin", () => {
    const s = base({
      floodingRecords: [{ compartmentId: "COMP-2", rateKgMin: -1, cause: "penetration" }],
    });
    expect(() => assertFixedPointDamage(s)).toThrow(BluewaveError);
  });

  it("rejects a non-integer performance modifier value", () => {
    const s = base({
      performanceModifiers: { speedBp: 10_000.5 },
    });
    expect(() => assertFixedPointDamage(s)).toThrow(BluewaveError);
  });

  it("rejects an invalid terminalStatus", () => {
    const s = base({ terminalStatus: "UNKNOWN" as "NORMAL" });
    expect(() => assertFixedPointDamage(s)).toThrow(BluewaveError);
  });

  it("accepts all three terminal statuses", () => {
    expect(() => assertFixedPointDamage(base({ terminalStatus: "NORMAL" }))).not.toThrow();
    expect(() => assertFixedPointDamage(base({ terminalStatus: "SINKING" }))).not.toThrow();
    expect(() => assertFixedPointDamage(base({ terminalStatus: "FOUNDERED" }))).not.toThrow();
  });

  it("rejects an empty compartments array entry", () => {
    const s = base({ compartments: ["COMP-1", ""] });
    expect(() => assertFixedPointDamage(s)).toThrow(BluewaveError);
  });

  it("rejects an empty components array entry", () => {
    const s = base({ components: ["TURRET-1", ""] });
    expect(() => assertFixedPointDamage(s)).toThrow(BluewaveError);
  });

  it("rejects an empty rulesetVersion", () => {
    const s = base({ rulesetVersion: "" });
    expect(() => assertFixedPointDamage(s)).toThrow(BluewaveError);
  });

  it("rejects an empty formulaVersion", () => {
    const s = base({ formulaVersion: "" });
    expect(() => assertFixedPointDamage(s)).toThrow(BluewaveError);
  });

  it("is reversible-to-invariant (does not mutate input on failure)", () => {
    const s = base({ structuralIntegrity: -50 });
    const before = JSON.stringify(s);
    try {
      assertFixedPointDamage(s);
    } catch {}
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe("AC-1: authoritative state hash (deterministic)", () => {
  it("computes a stable hash for identical states built independently", () => {
    const s1 = base();
    const s2 = base();
    expect(computeDamageStateHash(s1)).toBe(computeDamageStateHash(s2));
  });

  it("produces a 64-char sha256 hex digest", () => {
    expect(computeDamageStateHash(base())).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes when any authoritative field changes", () => {
    const a = computeDamageStateHash(base());
    const b = computeDamageStateHash(base({ structuralIntegrity: 99_999 }));
    expect(a).not.toBe(b);
    const c = computeDamageStateHash(base({ flotationReserve: 49_999 }));
    expect(a).not.toBe(c);
    const d = computeDamageStateHash(base({ terminalStatus: "SINKING" }));
    expect(a).not.toBe(d);
  });

  it("withDamageStateHash fills the authoritative stateHash and stays invariant", () => {
    const full = withDamageStateHash(base());
    expect(full.stateHash).toBe(computeDamageStateHash(full));
    expect(() => assertFixedPointDamage(full)).not.toThrow();
  });

  it("hash ignores an arbitrary/stale provided stateHash (depends only on fields)", () => {
    const withFilled = withDamageStateHash(base());
    const tampered = { ...withFilled, stateHash: "deadbeef" };
    expect(computeDamageStateHash(tampered)).toBe(withFilled.stateHash);
  });
});
