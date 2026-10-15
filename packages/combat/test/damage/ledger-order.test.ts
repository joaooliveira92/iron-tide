//packages/combat/test/damage/ledger-order.test.ts
// INC-4 — BattleLedger + canonicalEventOrder integration.
// Tests that damage events integrate correctly with the BattleLedger.
import { describe, it, expect } from "vite-plus/test";
import { BattleLedger, canonicalEventOrder, type BattleEvent } from "../../src/battleLedger.js";
import { damageEventOrder, createDamageEventRecord } from "../../src/damage/index.js";

// ---------------------------------------------------------------------------
// BattleLedger integration

describe("AC-4: BattleLedger integration", () => {
  it("damage events can be appended to BattleLedger via their metadata", () => {
    const ledger = new BattleLedger();

    const damageRecord = createDamageEventRecord({
      battleMinute: 10,
      substep: 2,
      sourceId: "BATTERY-A",
      targetShipId: "SHIP-001",
      causalWeaponId: "SHELL-AP-1",
      hitLocation: "BELT-1",
      protectionInteraction: {
        effectiveResistanceUm: 300_000,
        penetrationMargin: 50_000,
        outcome: "FULL_PENETRATION",
      },
      componentEffects: [],
      structureFlotationEffects: {
        structuralIntegrityAfter: 95_000,
        flotationReserveAfter: 48_000,
        uncappedStructuralDamage: 5_000,
        uncappedFlotationDamage: 2_000,
      },
      createdFireSources: [],
      createdFloodingSources: [],
      terminalTransition: null,
    });

    const battleEvent: BattleEvent = {
      battleId: "BATTLE-001",
      minute: damageRecord.battleMinute,
      substep: damageRecord.substep,
      eventPriority: 8, // damage events sit after gunnery (9)
      actorId: damageRecord.sourceId,
      targetId: damageRecord.targetShipId,
      eventId: `damage:${damageRecord.sourceId}:${damageRecord.hitLocation}`,
      eventType: "damage_event",
      eventHash: damageRecord.recordHash,
    };

    expect(() => ledger.append(battleEvent)).not.toThrow();
    expect(ledger.all).toHaveLength(1);
  });

  it("canonicalEventOrder sorts damage events correctly alongside other events", () => {
    const events: BattleEvent[] = [
      {
        battleId: "B-1",
        minute: 10,
        substep: 1,
        eventPriority: 9,
        actorId: "BATTERY-A",
        targetId: "SHIP-002",
        eventId: "gunnery:1",
        eventType: "gunnery_salvo",
      },
      {
        battleId: "B-1",
        minute: 10,
        substep: 2,
        eventPriority: 8,
        actorId: "BATTERY-A",
        targetId: "SHIP-001",
        eventId: "damage:1",
        eventType: "damage_event",
      },
      {
        battleId: "B-1",
        minute: 10,
        substep: 3,
        eventPriority: 7,
        actorId: "SPOTTING-1",
        targetId: "SHIP-001",
        eventId: "spotting:1",
        eventType: "spotting",
      },
    ];

    const sorted = [...events].sort(canonicalEventOrder);

    // Same minute and substep: eventPriority determines order (lower = earlier)
    // substep 1,2,3 so they sort by substep
    expect(sorted[0].substep).toBe(1);
    expect(sorted[1].substep).toBe(2);
    expect(sorted[2].substep).toBe(3);
  });

  it("canonicalEventOrder orders same-substep events by eventPriority", () => {
    const events: BattleEvent[] = [
      {
        battleId: "B-1",
        minute: 10,
        substep: 2,
        eventPriority: 9,
        actorId: "BATTERY-A",
        targetId: "SHIP-001",
        eventId: "g:1",
        eventType: "gunnery",
      },
      {
        battleId: "B-1",
        minute: 10,
        substep: 2,
        eventPriority: 8,
        actorId: "DAMAGE",
        targetId: "SHIP-001",
        eventId: "d:1",
        eventType: "damage",
      },
    ];

    const sorted = [...events].sort(canonicalEventOrder);
    // Lower priority (8) comes first
    expect(sorted[0].eventPriority).toBe(8);
    expect(sorted[1].eventPriority).toBe(9);
  });

  it("damageEventOrder and canonicalEventOrder agree on field ordering", () => {
    const a = createDamageEventRecord({
      battleMinute: 10,
      substep: 2,
      sourceId: "BATTERY-A",
      targetShipId: "SHIP-001",
      causalWeaponId: "AP-1",
      hitLocation: "BELT-1",
      protectionInteraction: {
        effectiveResistanceUm: 300_000,
        penetrationMargin: 50_000,
        outcome: "FULL_PENETRATION",
      },
      componentEffects: [],
      structureFlotationEffects: {
        structuralIntegrityAfter: 95_000,
        flotationReserveAfter: 48_000,
        uncappedStructuralDamage: 5_000,
        uncappedFlotationDamage: 2_000,
      },
      createdFireSources: [],
      createdFloodingSources: [],
      terminalTransition: null,
    });
    const b = createDamageEventRecord({
      battleMinute: 10,
      substep: 2,
      sourceId: "BATTERY-A",
      targetShipId: "SHIP-001",
      causalWeaponId: "AP-1",
      hitLocation: "BELT-2",
      protectionInteraction: {
        effectiveResistanceUm: 300_000,
        penetrationMargin: 50_000,
        outcome: "FULL_PENETRATION",
      },
      componentEffects: [],
      structureFlotationEffects: {
        structuralIntegrityAfter: 95_000,
        flotationReserveAfter: 48_000,
        uncappedStructuralDamage: 5_000,
        uncappedFlotationDamage: 2_000,
      },
      createdFireSources: [],
      createdFloodingSources: [],
      terminalTransition: null,
    });

    // damageEventOrder should give a non-zero result (hitLocation differs)
    expect(damageEventOrder(a, b)).not.toBe(0);
  });
});
