import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import {
  CARRIER_OPERATIONS_REASON_CODES,
  type CarrierRecordKey,
  createCarrierOperationRecord,
  recordComparator,
  sortRecords,
} from "../../src/carrier-operations/index.js";

describe("AC-31: Carrier operation records", () => {
  it("createCarrierOperationRecord builds a valid record", () => {
    const record = createCarrierOperationRecord(
      {
        minute: 0,
        substep: "assignment",
        carrierId: "ship_cv_01",
        formulaVersion: "v1",
        contentVersion: "v1",
        rulesetVersion: "v1",
      },
      { capacityUnitsDelta: SafeInt(2) },
    );
    expect(record.battleMinute).toBe(0);
    expect(record.substep).toBe("assignment");
    expect(record.carrierId).toBe("ship_cv_01");
    expect(record.capacityUnitsDelta).toBe(2);
    expect(record.recordHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("records carry all required §29 fields", () => {
    const record = createCarrierOperationRecord({
      minute: 1,
      substep: "spot_calc",
      carrierId: "ship_cv_02",
      formulaVersion: "f2",
      contentVersion: "c2",
      rulesetVersion: "r2",
      rngVersion: "rng_v1",
    });
    expect(record.formulaVersion).toBe("f2");
    expect(record.contentVersion).toBe("c2");
    expect(record.rulesetVersion).toBe("r2");
    expect(record.rngVersion).toBe("rng_v1");
  });
});

describe("AC-32: Canonical ordering", () => {
  function key(overrides: Partial<CarrierRecordKey> = {}): CarrierRecordKey {
    return {
      carrierId: "ship_cv_01",
      isEmergency: false,
      operationClassPriority: 7,
      strikeLaunchMinute: 0,
      strikeId: "",
      squadronId: "",
      aircraftModelId: "",
      aircraftId: "",
      equipmentId: "",
      hazardEventId: "",
      ordnanceItemId: "",
      transactionId: "",
      ...overrides,
    };
  }

  it("orders by carrier id first", () => {
    expect(recordComparator(key({ carrierId: "a" }), key({ carrierId: "b" }))).toBeLessThan(0);
    expect(recordComparator(key({ carrierId: "b" }), key({ carrierId: "a" }))).toBeGreaterThan(0);
  });

  it("emergency before non-emergency", () => {
    expect(recordComparator(key({ isEmergency: true }), key({ isEmergency: false }))).toBeLessThan(
      0,
    );
  });

  it("lower operation class priority first", () => {
    expect(
      recordComparator(key({ operationClassPriority: 1 }), key({ operationClassPriority: 3 })),
    ).toBeLessThan(0);
  });

  it("earlier strike launch minute first", () => {
    expect(
      recordComparator(
        key({ strikeLaunchMinute: 10, strikeId: "s1" }),
        key({ strikeLaunchMinute: 20, strikeId: "s2" }),
      ),
    ).toBeLessThan(0);
  });

  it("same minute ordered by strike id", () => {
    expect(
      recordComparator(
        key({ strikeLaunchMinute: 10, strikeId: "a" }),
        key({ strikeLaunchMinute: 10, strikeId: "b" }),
      ),
    ).toBeLessThan(0);
  });

  it("squadron id tiebreak", () => {
    expect(
      recordComparator(key({ squadronId: "sqn_a" }), key({ squadronId: "sqn_b" })),
    ).toBeLessThan(0);
  });

  it("aircraft model then aircraft id tiebreak", () => {
    const a = key({ aircraftModelId: "m_a", aircraftId: "ac_01" });
    const b = key({ aircraftModelId: "m_b", aircraftId: "ac_01" });
    const a2 = key({ aircraftModelId: "m_a", aircraftId: "ac_02" });
    expect(recordComparator(a, b)).toBeLessThan(0);
    expect(recordComparator(a, a2)).toBeLessThan(0);
  });

  it("equipment id tiebreak", () => {
    expect(
      recordComparator(key({ equipmentId: "cat_1" }), key({ equipmentId: "cat_2" })),
    ).toBeLessThan(0);
  });

  it("hazard event id tiebreak", () => {
    expect(
      recordComparator(key({ hazardEventId: "fire_1" }), key({ hazardEventId: "fire_2" })),
    ).toBeLessThan(0);
  });

  it("ordnance item + transaction id tiebreak", () => {
    const a = key({ ordnanceItemId: "bomb_500", transactionId: "tx_1" });
    const b = key({ ordnanceItemId: "torpedo_mk14", transactionId: "tx_2" });
    expect(recordComparator(a, b)).toBeLessThan(0);
  });

  it("identical keys compare equal", () => {
    expect(recordComparator(key(), key())).toBe(0);
  });

  it("sortRecords sorts deterministically", () => {
    const keys = [
      key({ carrierId: "cv_02" }),
      key({ carrierId: "cv_01", isEmergency: true }),
      key({ carrierId: "cv_01", isEmergency: false, operationClassPriority: 3 }),
      key({ carrierId: "cv_01", isEmergency: false, operationClassPriority: 1 }),
    ];
    const sorted = sortRecords(keys);
    expect(sorted[0].carrierId).toBe("cv_01");
    expect(sorted[0].isEmergency).toBe(true);
    expect(sorted[1].operationClassPriority).toBe(1);
    expect(sorted[2].operationClassPriority).toBe(3);
    expect(sorted[3].carrierId).toBe("cv_02");
  });
});

describe("AC-33: Reason code set-equality", () => {
  const EXPECTED_21_CODES = [
    "INVALID_CARRIER_OPERATIONS_STATE",
    "CARRIER_CAPACITY_EXCEEDED",
    "CARRIER_AIRCRAFT_CAPACITY_INCOMPATIBLE",
    "CARRIER_OVERSIZED_AIR_GROUP_PENALTY_ACTIVE",
    "CARRIER_SPOT_VALUE_ZERO",
    "CARRIER_STRIKE_EXCEEDS_SPOT_VALUE",
    "JET_CARRIER_DISPLACEMENT_INSUFFICIENT",
    "JET_CARRIER_CATAPULT_REQUIRED",
    "HEAVY_JET_CARRIER_INELIGIBLE",
    "HEAVY_JET_ANGLED_DECK_REQUIRED",
    "INVALID_CARRIER_DECK_CYCLE_TRANSITION",
    "CARRIER_DECK_CONTENTION",
    "CARRIER_MANEUVER_LOCKED_BY_DECK_OPERATION",
    "CARRIER_WIND_OVER_DECK_INSUFFICIENT",
    "CARRIER_OPERATIONS_SUSPENDED_BY_WEATHER",
    "CARRIER_NIGHT_RECOVERY_INELIGIBLE",
    "CARRIER_RECOVERY_OPERATIONAL_LOSS",
    "CARRIER_AVIATION_FIRE_HAZARD",
    "CARRIER_AVIATION_ORDNANCE_HAZARD",
    "CARRIER_ORDNANCE_INVENTORY_INSUFFICIENT",
    "CARRIER_OPERATIONS_INVARIANT_FAILED",
  ];

  it("ships exactly 21 codes matching §31", () => {
    const shipped = Object.keys(CARRIER_OPERATIONS_REASON_CODES);
    expect(shipped).toHaveLength(21);
    expect(shipped).toEqual(EXPECTED_21_CODES);
  });

  it("every shipped code is in the §31 list", () => {
    const shipped = Object.keys(CARRIER_OPERATIONS_REASON_CODES);
    for (const code of shipped) {
      expect(EXPECTED_21_CODES).toContain(code);
    }
  });

  it("every §31 code is shipped", () => {
    for (const code of EXPECTED_21_CODES) {
      expect(CARRIER_OPERATIONS_REASON_CODES).toHaveProperty(code);
    }
  });
});
