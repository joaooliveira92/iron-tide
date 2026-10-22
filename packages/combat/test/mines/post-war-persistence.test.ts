import { describe, expect, it } from "vite-plus/test";
import { SafeInt, BluewaveError } from "@bluewave/contracts";
import {
  applyDecayedMonth,
  applyPeaceSettlementTerms,
  applySweptPressure,
  assessPostWarDisposition,
  assertPostWarPersistence,
  clearRecord,
  MINE_FORMULA_VERSION,
  MINE_RULESET_VERSION,
  MINE_WARFARE_INVARIANT_FAILED,
  type AreaMinePressureRecord,
  verifyAreaMinePressureRecordHash,
  withAreaMinePressureRecordHash,
} from "../../src/mines/index.js";

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

describe("AC-16: §22 war termination does NOT auto-remove pressure", () => {
  it("assessPostWarDisposition returns the UNCHANGED active records, PERSISTS_ACTIVE", () => {
    const r = validRecord();
    const before = r.pressure;
    const result = assessPostWarDisposition([r], true);
    expect(result.warTerminated).toBe(true);
    expect(result.records).toHaveLength(1);
    expect(result.records[0].disposition).toBe("PERSISTS_ACTIVE");
    expect(result.records[0].record.pressure).toBe(before);
    expect(result.records[0].record.pressure).toBe(SafeInt(400_000));
  });

  it("target-belligerent sets are PRESERVED historically after war termination", () => {
    const r = validRecord();
    const result = assessPostWarDisposition([r], true);
    expect([...result.records[0].preservedTargetBelligerents]).toEqual(["u002"]);
    expect([...result.records[0].record.targetBelligerents]).toEqual(["u002"]);
  });

  it("records remain active hazards — pressure unchanged and in-band", () => {
    const r = validRecord();
    const result = assertPostWarPersistence([r], true);
    expect(result.records[0].record.pressure).toBe(SafeInt(400_000));
  });

  it("decay continues monthly after the war", () => {
    const r = validRecord();
    const after = applyDecayedMonth(r, true, SafeInt(60));
    expect(after.pressure).toBe(SafeInt(390_000));
    expect(after.lastDecayedMonth).toBe(SafeInt(60));
  });

  it("clearance remains available after the war (§22)", () => {
    const r = validRecord();
    const swept = applySweptPressure(r, r.pressure, SafeInt(60));
    expect(swept.pressure).toBe(SafeInt(0));
    const cleared = clearRecord(swept, "SWEEPING", SafeInt(60));
    expect(cleared.cleared).toBe(true);
    expect(cleared.emittedCode).toBe("MINEFIELD_CLEARED");
  });

  it("new laying requires a separate legal policy — the result flags it", () => {
    const result = assessPostWarDisposition([validRecord()], true);
    expect(result.newLayingRequiresSeparatePolicy).toBe(true);
    const inWar = assessPostWarDisposition([validRecord()], false);
    expect(inWar.newLayingRequiresSeparatePolicy).toBe(false);
  });

  it("warTerminated=false reports an in-war no-op (records persist even pre-war-end)", () => {
    const r = validRecord();
    const result = assessPostWarDisposition([r], false);
    expect(result.warTerminated).toBe(false);
    expect(result.records[0].record.pressure).toBe(SafeInt(400_000));
  });

  it("assertPostWarPersistence is the §22 hard-invariant validator (never removes pressure)", () => {
    const r = validRecord();
    const result = assertPostWarPersistence([r], true);
    expect(result.records[0].record.pressure).toBe(SafeInt(400_000));
  });
});

describe("AC-16: §22 peace settlement alters state ONLY through typed terms", () => {
  it("ADJUST_TARGET_SET rewrites the (ordered) target set; pressure unchanged", () => {
    const r = validRecord();
    const [result] = applyPeaceSettlementTerms(r, [
      { kind: "ADJUST_TARGET_SET", targetBelligerents: ["u003", "u001"] },
    ]);
    expect(result.termKind).toBe("ADJUST_TARGET_SET");
    expect([...result.targetBelligerents]).toEqual(["u003", "u001"]);
    expect(result.record.pressure).toBe(r.pressure);
    expect(verifyAreaMinePressureRecordHash(result.record)).toBe(true);
  });

  it("DISCLOSE_SAFE_LANES marks lanes disclosed; pressure unchanged", () => {
    const r = validRecord();
    const [result] = applyPeaceSettlementTerms(r, [{ kind: "DISCLOSE_SAFE_LANES" }]);
    expect(result.safeLanesDisclosed).toBe(true);
    expect(result.record.pressure).toBe(r.pressure);
  });

  it("ASSIGN_CLEARANCE_OBLIGATION records the obligation on the participant", () => {
    const r = validRecord();
    const [result] = applyPeaceSettlementTerms(r, [
      { kind: "ASSIGN_CLEARANCE_OBLIGATION", participantId: "u002" },
    ]);
    expect(result.clearanceObligationAssigned).toBe(true);
    expect(result.clearanceObligationParticipantId).toBe("u002");
    expect(result.record.pressure).toBe(r.pressure);
  });

  it("an EMPTY term list is allowed (no settlement changes) and returns []", () => {
    expect(applyPeaceSettlementTerms(validRecord(), [])).toEqual([]);
  });

  it("an UNKNOWN/absent term throws fail-closed (never a silent no-op)", () => {
    const r = validRecord();
    let err: BluewaveError | undefined;
    try {
      applyPeaceSettlementTerms(r, [{ kind: "FABRICATED_TERM" as never }]);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(MINE_WARFARE_INVARIANT_FAILED);
  });

  it("a settlement never deletes/zeroes pressure (hard invariant across all terms)", () => {
    const r = validRecord();
    const results = applyPeaceSettlementTerms(r, [
      { kind: "ADJUST_TARGET_SET", targetBelligerents: ["u009"] },
      { kind: "DISCLOSE_SAFE_LANES" },
      { kind: "ASSIGN_CLEARANCE_OBLIGATION", participantId: "u002" },
    ]);
    for (const res of results) {
      expect(res.record.pressure).toBe(r.pressure);
      expect(res.record.pressure).toBe(SafeInt(400_000));
    }
  });
});
