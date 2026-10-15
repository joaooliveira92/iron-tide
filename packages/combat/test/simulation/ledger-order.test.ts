import { describe, it, expect } from "vite-plus/test";
import { advanceMinutes } from "../../src/simulation/engine.js";
import { BattleLedger, canonicalEventOrder, type BattleEvent } from "../../src/battleLedger.js";
import { buildTestState } from "./advance.test.js";

describe("AC-12 battle ledger ordering (DESIGN-38 §35)", () => {
  it("BattleLedger appends events with a deterministic eventHash and sorts canonically", () => {
    const ledger = new BattleLedger();
    const a: BattleEvent = {
      battleId: "b",
      minute: 1,
      substep: 0,
      eventPriority: 4,
      actorId: "pipeline",
      targetId: "",
      eventId: "update",
      eventType: "update_contact_knowledge",
    };
    const b: BattleEvent = {
      battleId: "b",
      minute: 1,
      substep: 0,
      eventPriority: 6,
      actorId: "pipeline",
      targetId: "",
      eventId: "resolve",
      eventType: "resolve_propulsion_formation",
    };
    ledger.append(b);
    ledger.append(a);
    expect(ledger.sorted()[0]!.eventType).toBe("update_contact_knowledge");
    expect(ledger.sorted()[1]!.eventType).toBe("resolve_propulsion_formation");
    expect(ledger.sorted()[0]!.eventHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("canonicalEventOrder uses minute, substep, priority, actor, target, eventId (§35)", () => {
    const base = (partial: Partial<BattleEvent>): BattleEvent => ({
      battleId: "b",
      minute: 1,
      substep: 0,
      eventPriority: 4,
      actorId: "pipeline",
      targetId: "",
      eventId: "x",
      eventType: "type",
      ...partial,
    });
    expect(canonicalEventOrder(base({ minute: 1 }), base({ minute: 2 }))).toBeLessThan(0);
    expect(canonicalEventOrder(base({ substep: 0 }), base({ substep: 1 }))).toBeLessThan(0);
    expect(
      canonicalEventOrder(base({ eventPriority: 4 }), base({ eventPriority: 6 })),
    ).toBeLessThan(0);
    expect(canonicalEventOrder(base({ actorId: "a" }), base({ actorId: "b" }))).toBeLessThan(0);
  });

  it("minute-advance events flow through the existing BattleLedger append path", () => {
    const state = buildTestState();
    const res = advanceMinutes({
      state,
      minutes: 1,
      observationTime: "1900-01-01T00:00:00.000Z",
      orders: { a1: { orderedHeading: 90, orderedSpeedBp: 20_000 } },
    });
    expect(res.results[0]!.events.length).toBeGreaterThan(0);
    for (const e of res.results[0]!.events) {
      expect(e.eventId).toBeDefined();
      expect(e.battleId).toBe("b1");
      expect(e.minute).toBe(1);
    }
  });
});
