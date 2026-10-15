// AC-1 (INC-2): DESIGN-35 §1 AreaMinePressureRecord — the full §1 field set
// round-trips, zero pressure is PRESENCE-OF-NO-RECORD (isActivePressure), the
// record hash is deterministic (same input -> same 64-hex hash, changes when
// any field changes), and an invalid pressure (0, 1_000_001, negative,
// non-integer) fails with INVALID_MINE_PRESSURE_STATE.
import { describe, expect, it } from "vite-plus/test";
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import {
  INVALID_MINE_PRESSURE_STATE,
  MINE_FRESHNESS_MAX_BP,
  MINE_PRESSURE_MIN,
  MINE_PRESSURE_MAX,
  MINE_RULESET_VERSION,
  MINE_FORMULA_VERSION,
  type AreaMinePressureRecord,
  computeAreaPressureRecordHash,
  isActivePressure,
  minePressureRecordContentVersion,
  validateAreaMinePressureRecord,
  verifyAreaMinePressureRecordHash,
  withAreaMinePressureRecordHash,
} from "../../src/mines/index.js";

function validRecord(overrides: Partial<AreaMinePressureRecord> = {}): AreaMinePressureRecord {
  const contact = {
    minePressureId: "mp_white_sea_south.us_2",
    areaId: "white_sea_south",
    layingParticipantId: "USSR",
    targetBelligerents: ["u002"],
    mineTypeId: "CONTACT" as const,
    pressure: SafeInt(25_000),
    freshnessBp: SafeInt(8_000),
    sourceComposition: [{ layingSourceId: "port_soroka", contributingValue: 25_000, count: 1 }],
    mineCountOrAbstractedEquivalent: SafeInt(400),
    detectionConfidenceRecords: [
      { observingParticipantId: "gbr002", confidenceBp: SafeInt(6_000) },
    ],
    creationMonth: SafeInt(31),
    lastReinforcedMonth: null,
    lastDecayedMonth: SafeInt(35),
    lastSweptMonth: null,
    legalOwnerOfSourceFacilities: "USSR",
    militaryControllerOfSourceFacilities: "USSR",
    rulesetVersion: MINE_RULESET_VERSION,
    formulaVersion: MINE_FORMULA_VERSION,
  };
  return withAreaMinePressureRecordHash({ ...contact, ...overrides });
}

function expectInvalid(build: () => AreaMinePressureRecord, field: string): BluewaveError {
  let err: BluewaveError | undefined;
  try {
    const r = build();
    validateAreaMinePressureRecord(r);
  } catch (e) {
    err = e as BluewaveError;
  }
  expect(err).toBeDefined();
  expect(err!.message).toBe(INVALID_MINE_PRESSURE_STATE);
  expect(err!.context.field).toBe(field);
  return err!;
}

describe("AC-1: full §1 field set round-trips", () => {
  it("every §1 field is present and validated after hashing", () => {
    const r = validRecord();
    expect(() => validateAreaMinePressureRecord(r)).not.toThrow();
    expect(r.minePressureId).toBe("mp_white_sea_south.us_2");
    expect(r.areaId).toBe("white_sea_south");
    expect(r.layingParticipantId).toBe("USSR");
    expect([...r.targetBelligerents]).toEqual(["u002"]);
    expect(r.mineTypeId).toBe("CONTACT");
    expect(r.pressure).toBe(SafeInt(25_000));
    expect(r.freshnessBp).toBe(SafeInt(8_000));
    expect(r.sourceComposition[0]).toEqual({
      layingSourceId: "port_soroka",
      contributingValue: 25_000,
      count: 1,
    });
    expect(r.mineCountOrAbstractedEquivalent).toBe(SafeInt(400));
    expect(r.detectionConfidenceRecords[0]!.observingParticipantId).toBe("gbr002");
    expect(r.creationMonth).toBe(SafeInt(31));
    expect(r.lastReinforcedMonth).toBeNull();
    expect(r.lastDecayedMonth).toBe(SafeInt(35));
    expect(r.lastSweptMonth).toBeNull();
    expect(r.legalOwnerOfSourceFacilities).toBe("USSR");
    expect(r.militaryControllerOfSourceFacilities).toBe("USSR");
    expect(r.rulesetVersion).toBe(MINE_RULESET_VERSION);
    expect(r.formulaVersion).toBe(MINE_FORMULA_VERSION);
    expect(r.recordHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("the null markers round-trip as null (lastSweptMonth NONE, ownership NONE)", () => {
    const r = validRecord({ lastSweptMonth: null, legalOwnerOfSourceFacilities: null });
    expect(r.lastSweptMonth).toBeNull();
    expect(r.legalOwnerOfSourceFacilities).toBeNull();
    expect(() => validateAreaMinePressureRecord(r)).not.toThrow();
  });
});

describe("AC-1: zero pressure = absence of an active record", () => {
  it("isActivePressure distinguishes absence (0) from active pressure", () => {
    expect(isActivePressure(0)).toBe(false);
    expect(isActivePressure(MINE_PRESSURE_MIN)).toBe(true);
    expect(isActivePressure(MINE_PRESSURE_MAX)).toBe(true);
  });

  it("a record forced to pressure 0 is not an active record (rejected)", () => {
    expect(isActivePressure(0)).toBe(false);
    expectInvalid(() => validRecord({ pressure: SafeInt(0) }), "pressure");
  });
});

describe("AC-1: record hash is deterministic", () => {
  it("identical content produces the identical 64-hex hash", () => {
    const a = validRecord();
    const b = validRecord();
    expect(a.recordHash).toBe(b.recordHash);
    expect(a.recordHash.length).toBe(64);
    expect(computeAreaPressureRecordHash(a)).toBe(a.recordHash);
  });

  it("the hash changes when any field changes", () => {
    const a = validRecord();
    const b = validRecord({ pressure: SafeInt(a.pressure! + 1) });
    expect(b.recordHash).not.toBe(a.recordHash);
    const c = validRecord({ freshnessBp: SafeInt(a.freshnessBp! + 1) });
    expect(c.recordHash).not.toBe(a.recordHash);
    const d = validRecord({ targetBelligerents: ["u003"] });
    expect(d.recordHash).not.toBe(a.recordHash);
    const e = validRecord({
      sourceComposition: [{ layingSourceId: "other", contributingValue: 1, count: 1 }],
    });
    expect(e.recordHash).not.toBe(a.recordHash);
  });

  it("tampering is detected by verifyAreaMinePressureRecordHash", () => {
    const a = validRecord();
    const tampered = { ...a, pressure: SafeInt(a.pressure + 1) };
    expect(verifyAreaMinePressureRecordHash(tampered)).toBe(false);
  });

  it("record hash envelope is domain-separated (mine_pressure_v1)", () => {
    expect(minePressureRecordContentVersion).toBe("mine_pressure_v1");
    const a = validRecord();
    const hash = computeAreaPressureRecordHash(a);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("AC-1: invalid pressure fails INVALID_MINE_PRESSURE_STATE", () => {
  it("rejects a negative pressure", () => {
    expectInvalid(() => validRecord({ pressure: SafeInt(-1) }), "pressure");
  });

  it("rejects a pressure above 1_000_000 (out of the §1 band)", () => {
    expectInvalid(() => validRecord({ pressure: SafeInt(1_000_001) }), "pressure");
  });

  it("rejects a fractional pressure", () => {
    expectInvalid(
      () => validRecord({ pressure: 12_500.5 } as unknown as Partial<AreaMinePressureRecord>),
      "pressure",
    );
  });

  it("rejects a zero pressure record (must be absence instead)", () => {
    expectInvalid(() => validRecord({ pressure: SafeInt(0) }), "pressure");
  });
});

describe("AC-1: invalid freshness / other fields fail INVALID_MINE_PRESSURE_STATE", () => {
  it("rejects freshness above 10_000 basis points", () => {
    expectInvalid(
      () => validRecord({ freshnessBp: SafeInt(MINE_FRESHNESS_MAX_BP + 1) }),
      "freshnessBp",
    );
  });

  it("rejects a negative freshness", () => {
    expectInvalid(() => validRecord({ freshnessBp: SafeInt(-1) }), "freshnessBp");
  });

  it("rejects empty target belligerents (ordered non-empty)", () => {
    expectInvalid(() => validRecord({ targetBelligerents: [] }), "targetBelligerents");
  });

  it("rejects a non-canonical mineTypeId", () => {
    expectInvalid(
      () => validRecord({ mineTypeId: "NUCLEAR" } as unknown as Partial<AreaMinePressureRecord>),
      "mineTypeId",
    );
  });

  it("rejects a missing recordHash on the full guard", () => {
    const r = validRecord();
    const { recordHash: _ignored, ...surface } = r;
    void _ignored;
    let err: BluewaveError | undefined;
    try {
      validateAreaMinePressureRecord({ ...surface, recordHash: "" });
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.context.field).toBe("recordHash");
  });
});
