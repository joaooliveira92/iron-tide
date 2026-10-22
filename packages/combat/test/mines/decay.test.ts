import { describe, expect, it } from "vite-plus/test";
import { SafeInt, BluewaveError } from "@bluewave/contracts";
import {
  applyDecayedMonth,
  computeDecayedPressure,
  INVALID_MINE_PRESSURE_STATE,
  MINE_DECAY_POLICY_MISSING,
  MINE_FORMULA_VERSION,
  MINE_RULESET_VERSION,
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

function recordWith(
  mineTypeId: AreaMinePressureRecord["mineTypeId"],
  pressure: number,
  freshnessBp: number = 10_000,
): AreaMinePressureRecord {
  return validRecord({
    mineTypeId,
    pressure: SafeInt(pressure),
    freshnessBp: SafeInt(freshnessBp),
  });
}

describe("AC-15: §21 exact monthly retention multipliers per mine type", () => {
  it("CONTACT retains at 9_750 basis points", () => {
    const d = computeDecayedPressure(recordWith("CONTACT", 400_000), true);
    expect(d.retentionMultiplierBp).toBe(9_750);
    expect(d.pressureAfterDecay).toBe(SafeInt(390_000));
    expect(d.decayedPressure).toBe(SafeInt(10_000));
  });

  it("MAGNETIC retains at 9_500", () => {
    const d = computeDecayedPressure(recordWith("MAGNETIC", 400_000), true);
    expect(d.retentionMultiplierBp).toBe(9_500);
    expect(d.pressureAfterDecay).toBe(SafeInt(380_000));
    expect(d.decayedPressure).toBe(SafeInt(20_000));
  });

  it("ACOUSTIC retains at 9_250", () => {
    const d = computeDecayedPressure(recordWith("ACOUSTIC", 400_000), true);
    expect(d.retentionMultiplierBp).toBe(9_250);
    expect(d.pressureAfterDecay).toBe(SafeInt(370_000));
    expect(d.decayedPressure).toBe(SafeInt(30_000));
  });

  it("SUBMARINE_LAID retains at 9_500", () => {
    const d = computeDecayedPressure(recordWith("SUBMARINE_LAID", 400_000), true);
    expect(d.retentionMultiplierBp).toBe(9_500);
    expect(d.pressureAfterDecay).toBe(SafeInt(380_000));
  });

  it("CONTROLLED_DEFENSIVE retains at 9_900 with operational control infrastructure", () => {
    const d = computeDecayedPressure(recordWith("CONTROLLED_DEFENSIVE", 400_000), true);
    expect(d.retentionMultiplierBp).toBe(9_900);
    expect(d.pressureAfterDecay).toBe(SafeInt(396_000));
  });

  it("CONTROLLED_DEFENSIVE retains at 9_000 WITHOUT operational control infrastructure", () => {
    const d = computeDecayedPressure(recordWith("CONTROLLED_DEFENSIVE", 400_000), false);
    expect(d.retentionMultiplierBp).toBe(9_000);
    expect(d.pressureAfterDecay).toBe(SafeInt(360_000));
  });

  it("SCENARIO_SPECIAL without decay metadata throws MINE_DECAY_POLICY_MISSING", () => {
    let err: BluewaveError | undefined;
    try {
      computeDecayedPressure(recordWith("SCENARIO_SPECIAL", 400_000), true);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(MINE_DECAY_POLICY_MISSING);
  });
});

describe("AC-15: exact pressureAfterDecay / decayedPressure formulas (one FLOOR)", () => {
  it("a non-divisible product floors exactly (acoustic 9_250 on 100_000)", () => {
    const d = computeDecayedPressure(recordWith("ACOUSTIC", 100_000), true);
    expect(d.pressureAfterDecay).toBe(SafeInt(92_500));
    expect(d.decayedPressure).toBe(SafeInt(7_500));
  });

  it("floors down when the product leaves a fractional basis point", () => {
    const d = computeDecayedPressure(recordWith("CONTACT", 100_001), true);
    expect(d.pressureAfterDecay).toBe(SafeInt(97_500));
    expect(d.decayedPressure).toBe(SafeInt(2_501));
  });

  it("decayedPressure + pressureAfterDecay always equals the original pressure", () => {
    for (const p of [1, 999, 12_345, 400_000, 987_654]) {
      const d = computeDecayedPressure(recordWith("MAGNETIC", p), true);
      expect(Number(d.decayedPressure) + Number(d.pressureAfterDecay)).toBe(p);
    }
  });
});

describe("AC-15: freshness retention uses the same multiplier unless narrower", () => {
  it("a type with freshnessRetentionBp null uses the pressure-retention multiplier", () => {
    const d = computeDecayedPressure(recordWith("CONTACT", 400_000, 10_000), true);
    expect(d.freshnessRetentionMultiplierBp).toBe(9_750);
  });

  it("a narrower explicit freshnessRetentionBp is honored when present", () => {
    const d = computeDecayedPressure(recordWith("MAGNETIC", 400_000, 10_000), true);
    expect(d.freshnessRetentionMultiplierBp).toBe(d.retentionMultiplierBp);
  });

  it("applyDecayedMonth applies the same multiplier to freshness when no narrower value", () => {
    const after = applyDecayedMonth(recordWith("CONTACT", 400_000, 10_000), true, SafeInt(44));
    expect(after.freshnessBp).toBe(SafeInt(9_750));
  });
});

describe("AC-15: applyDecayedMonth — pressure, freshness, month, hash", () => {
  it("updates pressure to pressureAfterDecay and sets lastDecayedMonth", () => {
    const after = applyDecayedMonth(recordWith("CONTACT", 400_000, 5_000), true, SafeInt(44));
    expect(after.pressure).toBe(SafeInt(390_000));
    expect(after.lastDecayedMonth).toBe(SafeInt(44));
  });

  it("recomputes the record hash deterministically", () => {
    const before = validRecord();
    const after = applyDecayedMonth(before, true, SafeInt(44));
    expect(after.recordHash).not.toBe(before.recordHash);
    expect(after.recordHash).toMatch(/^[0-9a-f]{64}$/);
    const again = applyDecayedMonth(before, true, SafeInt(44));
    expect(again.recordHash).toBe(after.recordHash);
  });

  it("scenario-special decay in applyDecayedMonth also throws MINE_DECAY_POLICY_MISSING", () => {
    let err: BluewaveError | undefined;
    try {
      applyDecayedMonth(recordWith("SCENARIO_SPECIAL", 400_000), true, SafeInt(44));
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(MINE_DECAY_POLICY_MISSING);
  });

  it("a decay that drives pressure to 0 keeps a transitional zero-pressure hash, no delete", () => {
    const after = applyDecayedMonth(recordWith("CONTACT", 1), true, SafeInt(44));
    expect(after.pressure).toBe(SafeInt(0));
    expect(after.lastDecayedMonth).toBe(SafeInt(44));
    expect(after.recordHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("decay of an already-absent (pressure-0) record is a graceful no-op", () => {
    const zero = applyDecayedMonth(recordWith("CONTACT", 1), true, SafeInt(44));
    const again = applyDecayedMonth(zero, true, SafeInt(45));
    expect(again.pressure).toBe(SafeInt(0));
    expect(again.recordHash).toBe(zero.recordHash);
  });

  it("computeDecayedPressure rejects a pressure-0 record (absence is not a decay target)", () => {
    const zero = {
      ...recordWith("CONTACT", 1),
      pressure: SafeInt(0),
    } as unknown as AreaMinePressureRecord;
    let err: BluewaveError | undefined;
    try {
      computeDecayedPressure(zero, true);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(INVALID_MINE_PRESSURE_STATE);
  });
});
