import { describe, expect, it } from "vite-plus/test";
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import {
  computeAddedPressure,
  INVALID_MINE_PRESSURE_STATE,
  MINE_FULL_FRESHNESS_BP,
  MINE_FORMULA_VERSION,
  MINE_PRESSURE_MAX,
  MINE_RULESET_VERSION,
  reinforcePressureRecord,
  type AreaMinePressureRecord,
  withAreaMinePressureRecordHash,
} from "@bluewave/combat/mines";

function validRecord(overrides: Partial<AreaMinePressureRecord> = {}): AreaMinePressureRecord {
  const base = {
    minePressureId: "mp_white_sea_south.us_2",
    areaId: "white_sea_south",
    layingParticipantId: "USSR",
    targetBelligerents: ["u002"],
    mineTypeId: "CONTACT" as const,
    pressure: SafeInt(400_000),
    freshnessBp: SafeInt(5_000),
    sourceComposition: [{ layingSourceId: "port_soroka", contributingValue: 400_000, count: 1 }],
    mineCountOrAbstractedEquivalent: SafeInt(2_000),
    detectionConfidenceRecords: [],
    creationMonth: SafeInt(31),
    lastReinforcedMonth: SafeInt(31),
    lastDecayedMonth: SafeInt(35),
    lastSweptMonth: SafeInt(38),
    legalOwnerOfSourceFacilities: "USSR",
    militaryControllerOfSourceFacilities: "USSR",
    rulesetVersion: MINE_RULESET_VERSION,
    formulaVersion: MINE_FORMULA_VERSION,
  };
  return withAreaMinePressureRecordHash({ ...base, ...overrides });
}

function recordWith(pressure: number, freshnessBp: number): AreaMinePressureRecord {
  return validRecord({ pressure: SafeInt(pressure), freshnessBp: SafeInt(freshnessBp) });
}

describe("AC-5: addedPressure = min(1_000_000 - currentPressure, effectiveLayingValue)", () => {
  it("adds the full effective value while headroom remains", () => {
    expect(computeAddedPressure(SafeInt(400_000), SafeInt(100_000))).toBe(SafeInt(100_000));
  });

  it("clamps to the remaining headroom when the effective value exceeds it", () => {
    expect(computeAddedPressure(SafeInt(995_000), SafeInt(100_000))).toBe(SafeInt(5_000));
  });

  it("saturation at 1_000_000 yields 0 — further addition is blocked until decay/sweep", () => {
    expect(computeAddedPressure(SafeInt(MINE_PRESSURE_MAX), SafeInt(100_000))).toBe(SafeInt(0));
  });

  it("a zero (or negative-validated) effective value adds nothing", () => {
    expect(computeAddedPressure(SafeInt(400_000), SafeInt(0))).toBe(SafeInt(0));
  });

  it("rejects negative inputs with INVALID_MINE_PRESSURE_STATE", () => {
    for (const [current, effective] of [
      [SafeInt(-1), SafeInt(5_000)],
      [SafeInt(400_000), SafeInt(-5)],
    ]) {
      let err: BluewaveError | undefined;
      try {
        computeAddedPressure(current, effective);
      } catch (e) {
        err = e as BluewaveError;
      }
      expect(err).toBeDefined();
      expect(err!.message).toBe(INVALID_MINE_PRESSURE_STATE);
    }
  });

  it("rejects a zero current pressure (the §1 absence value), never reinforcing an absent record", () => {
    let err: BluewaveError | undefined;
    try {
      computeAddedPressure(SafeInt(0), SafeInt(5_000));
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(INVALID_MINE_PRESSURE_STATE);
  });
});

describe("AC-5: reinforcePressureRecord — weighted-integer freshness law (§5)", () => {
  it("mixed reinforcement lands at the exact weighted freshness 6_000", () => {
    const before = recordWith(400_000, 5_000);
    const after = reinforcePressureRecord(before, SafeInt(100_000), "port_soroka", SafeInt(40), [
      "u002",
    ]);
    expect(after.freshnessBp).toBe(SafeInt(6_000));
    expect(after.freshnessBp).toBeLessThan(MINE_FULL_FRESHNESS_BP);
  });

  it("a small reinforcement keeps the old member >= its previous freshness (no reset)", () => {
    const before = recordWith(100_000, 2_000);
    const after = reinforcePressureRecord(before, SafeInt(10_000), "port_soroka", SafeInt(41), [
      "u002",
    ]);
    expect(after.freshnessBp).toBe(SafeInt(2_727));
    expect(after.freshnessBp).toBeGreaterThanOrEqual(before.freshnessBp);
    expect(after.freshnessBp).toBeLessThanOrEqual(SafeInt(MINE_FULL_FRESHNESS_BP));
  });

  it("saturation reinforcement (added 0) is a no-pressure-op and preserves freshness", () => {
    const before = recordWith(MINE_PRESSURE_MAX, 3_000);
    const after = reinforcePressureRecord(before, SafeInt(100_000), "port_soroka", SafeInt(45), [
      "u002",
    ]);
    expect(after.pressure).toBe(SafeInt(MINE_PRESSURE_MAX));
    expect(after.freshnessBp).toBe(SafeInt(3_000));
  });

  it("an already-full-freshness record stays full-fresh", () => {
    const before = recordWith(400_000, MINE_FULL_FRESHNESS_BP);
    const after = reinforcePressureRecord(before, SafeInt(100_000), "port_soroka", SafeInt(40), [
      "u002",
    ]);
    expect(after.freshnessBp).toBe(SafeInt(MINE_FULL_FRESHNESS_BP));
  });

  it("rejects a zero laying value (no laying, §4) instead of recording a spurious zero contribution", () => {
    let err: BluewaveError | undefined;
    try {
      reinforcePressureRecord(validRecord(), SafeInt(0), "port_soroka", SafeInt(40), ["u002"]);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(INVALID_MINE_PRESSURE_STATE);
  });
});

describe("AC-5: reinforcePressureRecord — pressure, composition, months, hash", () => {
  it("adds pressure and recomputes the record hash deterministically", () => {
    const before = validRecord();
    const after = reinforcePressureRecord(before, SafeInt(100_000), "port_soroka", SafeInt(40), [
      "u002",
    ]);
    expect(after.pressure).toBe(SafeInt(500_000));
    expect(after.recordHash).not.toBe(before.recordHash);
    expect(after.recordHash).toMatch(/^[0-9a-f]{64}$/);
    const again = reinforcePressureRecord(before, SafeInt(100_000), "port_soroka", SafeInt(40), [
      "u002",
    ]);
    expect(again.recordHash).toBe(after.recordHash);
  });

  it("merges a repeated source into the existing composition entry", () => {
    const before = validRecord();
    const first = reinforcePressureRecord(before, SafeInt(100_000), "port_soroka", SafeInt(40), [
      "u002",
    ]);
    const second = reinforcePressureRecord(first, SafeInt(50_000), "port_soroka", SafeInt(42), [
      "u002",
    ]);
    expect(second.sourceComposition).toHaveLength(1);
    expect(second.sourceComposition[0]).toEqual({
      layingSourceId: "port_soroka",
      contributingValue: 550_000,
      count: 3,
    });
  });

  it("appends a new ordered composition entry for a fresh source", () => {
    const before = validRecord();
    const after = reinforcePressureRecord(before, SafeInt(50_000), "minelayer_k3", SafeInt(41), [
      "u002",
    ]);
    expect(after.sourceComposition).toHaveLength(2);
    expect(after.sourceComposition[1]).toEqual({
      layingSourceId: "minelayer_k3",
      contributingValue: 50_000,
      count: 1,
    });
  });

  it("updates lastReinforcedMonth; preserves lastDecayedMonth / lastSweptMonth / creationMonth", () => {
    const before = validRecord({
      creationMonth: SafeInt(30),
      lastReinforcedMonth: SafeInt(31),
      lastDecayedMonth: SafeInt(35),
      lastSweptMonth: SafeInt(38),
    });
    const after = reinforcePressureRecord(before, SafeInt(10_000), "port_soroka", SafeInt(44), [
      "u002",
    ]);
    expect(after.creationMonth).toBe(SafeInt(30));
    expect(after.lastReinforcedMonth).toBe(SafeInt(44));
    expect(after.lastDecayedMonth).toBe(SafeInt(35));
    expect(after.lastSweptMonth).toBe(SafeInt(38));
  });

  it("updates the ordered target belligerents to the reinforced set", () => {
    const after = reinforcePressureRecord(validRecord(), SafeInt(10_000), "port", SafeInt(40), [
      "u002",
      "u005",
    ]);
    expect([...after.targetBelligerents]).toEqual(["u002", "u005"]);
  });

  it("post-increase pressure can never exceed 1_000_000 (saturation carve-out already proven above)", () => {
    const before = recordWith(999_000, 5_000);
    const after = reinforcePressureRecord(before, SafeInt(100_000), "port", SafeInt(40), ["u002"]);
    expect(after.pressure).toBe(SafeInt(1_000_000));
    expect(after.pressure).toBeLessThanOrEqual(SafeInt(MINE_PRESSURE_MAX));
  });

  it("a tampered record below the §1 pressure band fails the post-condition guard", () => {
    const forged: AreaMinePressureRecord = {
      ...validRecord(),
      pressure: SafeInt(-1_000),
    };
    let err: BluewaveError | undefined;
    try {
      reinforcePressureRecord(forged, SafeInt(10_000), "port", SafeInt(40), ["u002"]);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(INVALID_MINE_PRESSURE_STATE);
  });

  it("rejects an empty target-belligerent set with INVALID_MINE_PRESSURE_STATE", () => {
    let err: BluewaveError | undefined;
    try {
      reinforcePressureRecord(validRecord(), SafeInt(10_000), "port", SafeInt(40), []);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(INVALID_MINE_PRESSURE_STATE);
  });
});
