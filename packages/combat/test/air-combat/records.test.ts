//packages/combat/test/air-combat/records.test.ts
// AC-17 (INC-7): AirCombatRecord per DESIGN-43 §38.
import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import {
  assertAirCombatRecordHash,
  createAirCombatRecord,
  computeAirCombatRecordHash,
  verifyAirCombatRecordHash,
  type AirCombatRecord,
} from "../../src/air-combat/index.js";
import { AIR_COMBAT_RULESET_VERSION } from "../../src/air-combat/index.js";
import { CombatInvariantError } from "../../src/errors.js";

function makeDefaultRecordParams() {
  return {
    recordId: "rec-001",
    battleId: "battle-test-1",
    minute: SafeInt(5),
    substep: SafeInt(1),
    recordKind: "ENGAGEMENT",
    actorId: "sqn-f4f-01",
    targetId: "strike-g3m-01",
    description: "CAP engagement with incoming strike",
    reasonCode: "AIR_COMBAT_INTERCEPTION_TOO_LATE",
    rulesetVersion: AIR_COMBAT_RULESET_VERSION,
  };
}

describe("AC-17: AirCombatRecord", () => {
  it("creates a record with all fields and a non-empty deterministic recordHash", () => {
    const record = createAirCombatRecord(makeDefaultRecordParams());
    expect(record.recordId).toBe("rec-001");
    expect(record.battleId).toBe("battle-test-1");
    expect(Number(record.minute)).toBe(5);
    expect(Number(record.substep)).toBe(1);
    expect(record.recordHash).toBeTruthy();
    expect(record.recordHash.length).toBeGreaterThan(0);
  });

  it("supports ENGAGEMENT record kind", () => {
    const record = createAirCombatRecord({
      ...makeDefaultRecordParams(),
      recordKind: "ENGAGEMENT",
    });
    expect(record.recordKind).toBe("ENGAGEMENT");
  });

  it("supports LOSS record kind", () => {
    const record = createAirCombatRecord({
      ...makeDefaultRecordParams(),
      recordKind: "LOSS",
    });
    expect(record.recordKind).toBe("LOSS");
  });

  it("supports ATTACK record kind", () => {
    const record = createAirCombatRecord({
      ...makeDefaultRecordParams(),
      recordKind: "ATTACK",
    });
    expect(record.recordKind).toBe("ATTACK");
  });

  it("supports STATE_TRANSITION record kind", () => {
    const record = createAirCombatRecord({
      ...makeDefaultRecordParams(),
      recordKind: "STATE_TRANSITION",
    });
    expect(record.recordKind).toBe("STATE_TRANSITION");
  });

  it("handles null targetId", () => {
    const record = createAirCombatRecord({
      ...makeDefaultRecordParams(),
      targetId: null,
    });
    expect(record.targetId).toBeNull();
  });

  it("verifyAirCombatRecordHash returns true for valid record", () => {
    const record = createAirCombatRecord(makeDefaultRecordParams());
    expect(verifyAirCombatRecordHash(record)).toBe(true);
  });

  it("verifyAirCombatRecordHash returns false for tampered record", () => {
    const record = createAirCombatRecord(makeDefaultRecordParams());
    const tampered: AirCombatRecord = { ...record, description: "tampered description" };
    expect(verifyAirCombatRecordHash(tampered)).toBe(false);
  });

  it("two identical records produce identical hashes", () => {
    const params = makeDefaultRecordParams();
    const record1 = createAirCombatRecord(params);
    const record2 = createAirCombatRecord(params);
    expect(record1.recordHash).toBe(record2.recordHash);
  });

  it("records with different fields produce different hashes", () => {
    const record1 = createAirCombatRecord(makeDefaultRecordParams());
    const record2 = createAirCombatRecord({
      ...makeDefaultRecordParams(),
      battleId: "different-battle",
    });
    expect(record1.recordHash).not.toBe(record2.recordHash);
  });

  it("recordHash is computed deterministically", () => {
    const hash1 = computeAirCombatRecordHash(makeDefaultRecordParams());
    const hash2 = computeAirCombatRecordHash(makeDefaultRecordParams());
    expect(hash1).toBe(hash2);
  });

  it("assertAirCombatRecordHash accepts a valid record", () => {
    const record = createAirCombatRecord(makeDefaultRecordParams());
    expect(() => assertAirCombatRecordHash(record)).not.toThrow();
  });

  it("assertAirCombatRecordHash throws a tagged CombatInvariantError on a tampered record", () => {
    const record = createAirCombatRecord(makeDefaultRecordParams());
    const tampered: AirCombatRecord = { ...record, description: "tampered description" };

    let thrown: unknown;
    try {
      assertAirCombatRecordHash(tampered);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    const tagged = thrown as CombatInvariantError;
    expect(tagged._tag).toBe("CombatInvariantError");
    expect(tagged.name).toBe("CombatInvariantError");
    expect(tagged.code).toBe("AIR_COMBAT_RECORD_INTEGRITY_FAILURE");
    expect(tagged.message).toBe("AIR_COMBAT_RECORD_INTEGRITY_FAILURE");
  });
});
