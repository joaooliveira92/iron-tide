import { describe, expect, it } from "vite-plus/test";
import { SafeInt, BluewaveError } from "@bluewave/contracts";
import {
  clearRecord,
  clearRecordById,
  isRecordCleared,
  MINEFIELD_CLEARED,
  MINE_FORMULA_VERSION,
  MINE_RULESET_VERSION,
  MINE_WARFARE_INVARIANT_FAILED,
  type AreaMinePressureRecord,
  applySweptPressure,
  withAreaMinePressureRecordHash,
} from "../../src/mines/index.js";

function activeRecord(overrides: Partial<AreaMinePressureRecord> = {}): AreaMinePressureRecord {
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

function clearedTransitionalRecord(): AreaMinePressureRecord {
  const active = activeRecord();
  return applySweptPressure(active, active.pressure, SafeInt(40));
}

describe("AC-19: isRecordCleared — pressure 0 after sweeping or decay", () => {
  it("a pressure-0 record is cleared", () => {
    expect(isRecordCleared(clearedTransitionalRecord())).toBe(true);
  });

  it("an active (positive-pressure) record is NOT cleared", () => {
    expect(isRecordCleared(activeRecord())).toBe(false);
  });
});

describe("AC-19: clearRecord closes the active record, PRESERVES history, emits MINEFIELD_CLEARED", () => {
  it("returns a closure marker preserving source composition + creation + target set", () => {
    const result = clearRecord(clearedTransitionalRecord(), "SWEEPING", SafeInt(40));
    expect(result.cleared).toBe(true);
    expect(result.emittedCode).toBe(MINEFIELD_CLEARED);
    expect(result.removedFromSubsequentRisk).toBe(true);
    expect(result.closure).toBeDefined();
    expect(result.closure!.kind).toBe("CLEARED_MINEFIELD");
    expect(result.closure!.cause).toBe("SWEEPING");
    expect(result.closure!.minePressureId).toBe("mp_white_sea_south.us_2");
    expect(result.closure!.preservedSourceComposition).toEqual([
      { layingSourceId: "port_soroka", contributingValue: 400_000, count: 1 },
    ]);
    expect(result.closure!.preservedCreationMonth).toBe(SafeInt(31));
    expect([...result.closure!.preservedTargetBelligerents]).toEqual(["u002"]);
    expect(result.closure!.closedAtMonth).toBe(SafeInt(40));
  });

  it("supports DECAY as the clearance cause", () => {
    const result = clearRecord(clearedTransitionalRecord(), "DECAY", SafeInt(41));
    expect(result.cause).toBe("DECAY");
    expect(result.emittedCode).toBe(MINEFIELD_CLEARED);
  });

  it("feeds a knowledge update (area, cleared lanes, last observed) to the participant", () => {
    const result = clearRecord(clearedTransitionalRecord(), "SWEEPING", SafeInt(40));
    expect(result.knowledgeUpdate).toEqual({
      areaId: "white_sea_south",
      participantId: "USSR",
      knownClearedLanes: [],
      lastObservedOrSweptMonth: SafeInt(40),
      mineType: "CONTACT",
    });
  });

  it("does NOT fire on a positive-pressure record (fail closed)", () => {
    let err: BluewaveError | undefined;
    try {
      clearRecord(activeRecord(), "SWEEPING", SafeInt(40));
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(MINE_WARFARE_INVARIANT_FAILED);
  });
});

describe("AC-19: clearRecordById clears EXACTLY ONE record, never another's", () => {
  function twoMinefields() {
    const clearedUs = clearedTransitionalRecord();
    const germanActive = activeRecord({
      minePressureId: "mp_baltic.us_4",
      areaId: "baltic",
      layingParticipantId: "Germany",
      targetBelligerents: ["u001"],
      pressure: SafeInt(200_000),
    });
    const clearedGermany = applySweptPressure(germanActive, germanActive.pressure, SafeInt(40));
    return { clearedUs, clearedGermany };
  }

  it("clears only the requested record and leaves the other untouched", () => {
    const { clearedUs, clearedGermany } = twoMinefields();
    const result = clearRecordById(
      [clearedUs, clearedGermany],
      "mp_white_sea_south.us_2",
      "USSR",
      "SWEEPING",
      SafeInt(40),
    );
    expect(result.cleared).toBe(true);
    expect(result.closure).toBeDefined();
    expect(result.closure!.minePressureId).toBe("mp_white_sea_south.us_2");
    expect(result.remaining).toHaveLength(1);
    expect(result.remaining[0]).toBe(clearedGermany);
    expect(result.remaining[0].pressure).toBe(SafeInt(0));
  });

  it("clearing one participant's minefield never clears another's record even when ids differ", () => {
    const { clearedUs, clearedGermany } = twoMinefields();
    const result = clearRecordById(
      [clearedUs, clearedGermany],
      "mp_baltic.us_4",
      "Germany",
      "SWEEPING",
      SafeInt(40),
    );
    expect(result.closure!.minePressureId).toBe("mp_baltic.us_4");
    expect(result.remaining.some((r) => r.minePressureId === "mp_white_sea_south.us_2")).toBe(true);
  });

  it("throws when no record matches the participant+id (no cross-clearance)", () => {
    const { clearedUs, clearedGermany } = twoMinefields();
    let err: BluewaveError | undefined;
    try {
      clearRecordById(
        [clearedUs, clearedGermany],
        "mp_baltic.us_4",
        "USSR",
        "SWEEPING",
        SafeInt(40),
      );
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(MINE_WARFARE_INVARIANT_FAILED);
  });

  it("hashing surface is consistent with INC-4's transitional zero-pressure seam", () => {
    const zero = clearedTransitionalRecord();
    const result = clearRecord(zero, "SWEEPING", SafeInt(40));
    expect(result.cleared).toBe(true);
    expect(zero.recordHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
