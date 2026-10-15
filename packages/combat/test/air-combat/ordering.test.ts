//packages/combat/test/air-combat/ordering.test.ts
// AC-18 (INC-7): canonical ordering per DESIGN-43 §39 + DESIGN-38 §29.
import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import {
  compareAirCombatRecords,
  canonicallySortedRecords,
  compareStrings,
} from "../../src/air-combat/index.js";
import { AIR_COMBAT_RULESET_VERSION } from "../../src/air-combat/index.js";
import type { AirCombatRecord } from "../../src/air-combat/index.js";

function makeRecord(overrides: Partial<AirCombatRecord> = {}): AirCombatRecord {
  return {
    recordId: "rec-001",
    battleId: "battle-1",
    minute: SafeInt(5),
    substep: SafeInt(1),
    recordKind: "ENGAGEMENT",
    actorId: "sqn-a",
    targetId: "sqn-b",
    description: "test record",
    reasonCode: "AIR_COMBAT_INVALID_STATE",
    rulesetVersion: AIR_COMBAT_RULESET_VERSION,
    recordHash: "hash-placeholder",
    ...overrides,
  };
}

describe("AC-18: canonical ordering", () => {
  it("compareStrings orders alphabetically", () => {
    expect(compareStrings("a", "b")).toBeLessThan(0);
    expect(compareStrings("b", "a")).toBeGreaterThan(0);
    expect(compareStrings("a", "a")).toBe(0);
  });

  it("earlier minute sorts before later minute", () => {
    const a = makeRecord({ minute: SafeInt(1) });
    const b = makeRecord({ minute: SafeInt(5) });
    expect(compareAirCombatRecords(a, b)).toBeLessThan(0);
    expect(compareAirCombatRecords(b, a)).toBeGreaterThan(0);
  });

  it("same minute, lower substep sorts first", () => {
    const a = makeRecord({ minute: SafeInt(5), substep: SafeInt(1) });
    const b = makeRecord({ minute: SafeInt(5), substep: SafeInt(3) });
    expect(compareAirCombatRecords(a, b)).toBeLessThan(0);
    expect(compareAirCombatRecords(b, a)).toBeGreaterThan(0);
  });

  it("same minute+substep, actorId string sort", () => {
    const a = makeRecord({ minute: SafeInt(5), substep: SafeInt(1), actorId: "sqn-alpha" });
    const b = makeRecord({ minute: SafeInt(5), substep: SafeInt(1), actorId: "sqn-beta" });
    expect(compareAirCombatRecords(a, b)).toBeLessThan(0);
    expect(compareAirCombatRecords(b, a)).toBeGreaterThan(0);
  });

  it("same minute+substep+actor, targetId string sort", () => {
    const a = makeRecord({
      minute: SafeInt(5),
      substep: SafeInt(1),
      actorId: "sqn-x",
      targetId: "tgt-1",
    });
    const b = makeRecord({
      minute: SafeInt(5),
      substep: SafeInt(1),
      actorId: "sqn-x",
      targetId: "tgt-2",
    });
    expect(compareAirCombatRecords(a, b)).toBeLessThan(0);
    expect(compareAirCombatRecords(b, a)).toBeGreaterThan(0);
  });

  it("null targetId sorts as empty string", () => {
    const a = makeRecord({
      minute: SafeInt(5),
      substep: SafeInt(1),
      actorId: "sqn-x",
      targetId: null,
    });
    const b = makeRecord({
      minute: SafeInt(5),
      substep: SafeInt(1),
      actorId: "sqn-x",
      targetId: "tgt-1",
    });
    expect(compareAirCombatRecords(a, b)).toBeLessThan(0);
    expect(compareAirCombatRecords(b, a)).toBeGreaterThan(0);
  });

  it("same minute+substep+actor+target, different recordKinds sorted by kind string", () => {
    const a = makeRecord({
      minute: SafeInt(5),
      substep: SafeInt(1),
      actorId: "sqn-a",
      targetId: "tgt-b",
      recordKind: "ATTACK",
    });
    const b = makeRecord({
      minute: SafeInt(5),
      substep: SafeInt(1),
      actorId: "sqn-a",
      targetId: "tgt-b",
      recordKind: "ENGAGEMENT",
    });
    expect(compareAirCombatRecords(a, b)).toBeLessThan(0); // "ATTACK" < "ENGAGEMENT"
  });

  it("canonicallySortedRecords returns sorted copy", () => {
    const records = [
      makeRecord({ minute: SafeInt(10), recordId: "rec-c" }),
      makeRecord({ minute: SafeInt(1), recordId: "rec-a" }),
      makeRecord({ minute: SafeInt(5), recordId: "rec-b" }),
    ];
    const sorted = canonicallySortedRecords(records);
    expect(sorted[0].minute).toBe(SafeInt(1));
    expect(sorted[1].minute).toBe(SafeInt(5));
    expect(sorted[2].minute).toBe(SafeInt(10));
  });

  it("canonicallySortedRecords does NOT mutate input array", () => {
    const records = [
      makeRecord({ minute: SafeInt(10), recordId: "rec-c" }),
      makeRecord({ minute: SafeInt(1), recordId: "rec-a" }),
      makeRecord({ minute: SafeInt(5), recordId: "rec-b" }),
    ];
    const original = [...records];
    canonicallySortedRecords(records);
    expect(records.map((r) => r.recordId)).toEqual(original.map((r) => r.recordId));
  });

  it("multiple records with full sort criteria sorted correctly", () => {
    const records = [
      makeRecord({ minute: SafeInt(5), substep: SafeInt(1), actorId: "sqn-b", recordId: "r3" }),
      makeRecord({ minute: SafeInt(3), substep: SafeInt(1), actorId: "sqn-a", recordId: "r1" }),
      makeRecord({ minute: SafeInt(5), substep: SafeInt(1), actorId: "sqn-a", recordId: "r2" }),
      makeRecord({ minute: SafeInt(5), substep: SafeInt(2), actorId: "sqn-a", recordId: "r4" }),
    ];
    const sorted = canonicallySortedRecords(records);
    expect(sorted[0].recordId).toBe("r1"); // minute 3
    expect(sorted[1].recordId).toBe("r2"); // minute 5, substep 1, sqn-a
    expect(sorted[2].recordId).toBe("r3"); // minute 5, substep 1, sqn-b
    expect(sorted[3].recordId).toBe("r4"); // minute 5, substep 2, sqn-a
  });
});
