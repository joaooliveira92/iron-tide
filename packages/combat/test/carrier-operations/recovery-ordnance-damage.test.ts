import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import {
  RECOVERY_PRIORITY_LEVELS,
  RECOVERY_PRIORITY_NUMBERS,
  CARRIER_ORDNANCE_INVENTORY_INSUFFICIENT,
  type RecoveryRequest,
  type OrdnanceInventoryCheck,
  type DeckHangarDamageState,
  recoveryPriorityComparator,
  sortByRecoveryPriority,
  canReserveForRecovery,
  hasSufficientOrdnance,
  assertSufficientOrdnance,
  canReturnOrdnanceToStorage,
  computeDeckHangarDamageEffects,
  validateCarrierRecoveryPriorityContract,
  validateCarrierOrdnanceStateContract,
  SHIPPED_CARRIER_OPERATIONS_CONTRACTS,
} from "@bluewave/combat/carrier-operations";

describe("AC-28: Recovery priority", () => {
  it("has 7 priority levels in correct order", () => {
    expect([...RECOVERY_PRIORITY_LEVELS]).toEqual([
      "EMERGENCY_FUEL",
      "DAMAGED_AIRCRAFT",
      "HAZARDOUS_ORDNANCE",
      "IMMEDIATE_CAP_RELAUNCH",
      "RETURNING_STRIKE",
      "SEARCH",
      "NORMAL_CAP",
    ]);
  });

  it("priority numbers match §26", () => {
    expect(RECOVERY_PRIORITY_NUMBERS.EMERGENCY_FUEL).toBe(1);
    expect(RECOVERY_PRIORITY_NUMBERS.DAMAGED_AIRCRAFT).toBe(2);
    expect(RECOVERY_PRIORITY_NUMBERS.HAZARDOUS_ORDNANCE).toBe(3);
    expect(RECOVERY_PRIORITY_NUMBERS.IMMEDIATE_CAP_RELAUNCH).toBe(4);
    expect(RECOVERY_PRIORITY_NUMBERS.RETURNING_STRIKE).toBe(5);
    expect(RECOVERY_PRIORITY_NUMBERS.SEARCH).toBe(6);
    expect(RECOVERY_PRIORITY_NUMBERS.NORMAL_CAP).toBe(7);
  });

  it("recoveryPriorityComparator orders by priority then id", () => {
    const a: RecoveryRequest = {
      aircraftId: "ac_01",
      priorityLevel: "EMERGENCY_FUEL",
      squadronId: "sqn_1",
      fuelStateBp: 100,
      isDamaged: false,
      hasHazardousOrdnance: false,
    };
    const b: RecoveryRequest = {
      aircraftId: "ac_02",
      priorityLevel: "NORMAL_CAP",
      squadronId: "sqn_1",
      fuelStateBp: 5000,
      isDamaged: false,
      hasHazardousOrdnance: false,
    };
    expect(recoveryPriorityComparator(a, b)).toBeLessThan(0);
  });

  it("same priority sorted by aircraft id", () => {
    const a: RecoveryRequest = {
      aircraftId: "ac_a",
      priorityLevel: "SEARCH",
      squadronId: "sqn_1",
      fuelStateBp: 3000,
      isDamaged: false,
      hasHazardousOrdnance: false,
    };
    const b: RecoveryRequest = {
      aircraftId: "ac_b",
      priorityLevel: "SEARCH",
      squadronId: "sqn_1",
      fuelStateBp: 3000,
      isDamaged: false,
      hasHazardousOrdnance: false,
    };
    expect(recoveryPriorityComparator(a, b)).toBeLessThan(0);
    expect(recoveryPriorityComparator(b, a)).toBeGreaterThan(0);
  });

  it("sortByRecoveryPriority returns correctly ordered list", () => {
    const requests: RecoveryRequest[] = [
      {
        aircraftId: "ac_03",
        priorityLevel: "RETURNING_STRIKE",
        squadronId: "sqn_1",
        fuelStateBp: 3000,
        isDamaged: false,
        hasHazardousOrdnance: false,
      },
      {
        aircraftId: "ac_01",
        priorityLevel: "EMERGENCY_FUEL",
        squadronId: "sqn_1",
        fuelStateBp: 100,
        isDamaged: false,
        hasHazardousOrdnance: false,
      },
      {
        aircraftId: "ac_02",
        priorityLevel: "NORMAL_CAP",
        squadronId: "sqn_1",
        fuelStateBp: 5000,
        isDamaged: false,
        hasHazardousOrdnance: false,
      },
    ];
    const sorted = sortByRecoveryPriority(requests);
    expect(sorted[0].aircraftId).toBe("ac_01");
    expect(sorted[1].aircraftId).toBe("ac_03");
    expect(sorted[2].aircraftId).toBe("ac_02");
  });

  it("canReserveForRecovery: sufficient deck capacity returns true", () => {
    expect(
      canReserveForRecovery({
        deckCapacityAvailable: SafeInt(10),
        requestedSlots: SafeInt(5),
        carrierHasAlternateLanding: false,
      }),
    ).toBe(true);
  });

  it("canReserveForRecovery: insufficient capacity + no alternate = false", () => {
    expect(
      canReserveForRecovery({
        deckCapacityAvailable: SafeInt(3),
        requestedSlots: SafeInt(5),
        carrierHasAlternateLanding: false,
      }),
    ).toBe(false);
  });

  it("canReserveForRecovery: insufficient capacity + alternate = true", () => {
    expect(
      canReserveForRecovery({
        deckCapacityAvailable: SafeInt(3),
        requestedSlots: SafeInt(5),
        carrierHasAlternateLanding: true,
      }),
    ).toBe(true);
  });
});

describe("AC-29: Ordnance state", () => {
  it("hasSufficientOrdnance returns true when enough", () => {
    const check: OrdnanceInventoryCheck = {
      inventoryTypeId: "bomb_500lb",
      availableQuantity: SafeInt(20),
      requestedQuantity: SafeInt(10),
    };
    expect(hasSufficientOrdnance(check)).toBe(true);
  });

  it("hasSufficientOrdnance returns false when insufficient", () => {
    const check: OrdnanceInventoryCheck = {
      inventoryTypeId: "bomb_500lb",
      availableQuantity: SafeInt(5),
      requestedQuantity: SafeInt(10),
    };
    expect(hasSufficientOrdnance(check)).toBe(false);
  });

  it("assertSufficientOrdnance throws CARRIER_ORDNANCE_INVENTORY_INSUFFICIENT", () => {
    const check: OrdnanceInventoryCheck = {
      inventoryTypeId: "torpedo_mk14",
      availableQuantity: SafeInt(0),
      requestedQuantity: SafeInt(2),
    };
    expect(() => assertSufficientOrdnance(check)).toThrow(CARRIER_ORDNANCE_INVENTORY_INSUFFICIENT);
  });

  it("canReturnOrdnanceToStorage: all predicates met = true", () => {
    expect(canReturnOrdnanceToStorage(true, false, true, true)).toBe(true);
  });

  it("canReturnOrdnanceToStorage: aircraft not aboard = false", () => {
    expect(canReturnOrdnanceToStorage(false, false, true, true)).toBe(false);
  });

  it("canReturnOrdnanceToStorage: jettison occurred = false", () => {
    expect(canReturnOrdnanceToStorage(true, true, true, true)).toBe(false);
  });

  it("canReturnOrdnanceToStorage: weapon not safe = false", () => {
    expect(canReturnOrdnanceToStorage(true, false, false, true)).toBe(false);
  });

  it("canReturnOrdnanceToStorage: no storage capacity = false", () => {
    expect(canReturnOrdnanceToStorage(true, false, true, false)).toBe(false);
  });
});

describe("AC-30: Deck/hangar damage effects", () => {
  function intactDamage(): DeckHangarDamageState {
    return {
      flightDeckDamageBp: 10_000,
      catapultDamageCount: 0,
      totalCatapultCount: 2,
      liftOperationalCount: 2,
      totalLiftCount: 2,
      hangarDamageBp: 0,
      fuelSystemDamageBp: 0,
      ordnanceStorageDamageBp: 0,
    };
  }

  it("intact carrier has no degradation", () => {
    const effects = computeDeckHangarDamageEffects(intactDamage());
    expect(effects.spotValueMultiplierBp).toBe(10_000);
    expect(effects.hangarDeckMovementAllowed).toBe(true);
    expect(effects.refuelingPermitted).toBe(true);
    expect(effects.rearmingPermitted).toBe(true);
    expect(effects.jetCompatibilityDegraded).toBe(false);
  });

  it("damaged flight deck reduces spot value", () => {
    const effects = computeDeckHangarDamageEffects({
      ...intactDamage(),
      flightDeckDamageBp: 5_000,
    });
    expect(effects.spotValueMultiplierBp).toBe(3_500);
  });

  it("inoperable flight deck gives zero multiplier", () => {
    const effects = computeDeckHangarDamageEffects({ ...intactDamage(), flightDeckDamageBp: 0 });
    expect(effects.spotValueMultiplierBp).toBe(0);
  });

  it("no operational lifts blocks hangar deck movement", () => {
    const effects = computeDeckHangarDamageEffects({ ...intactDamage(), liftOperationalCount: 0 });
    expect(effects.hangarDeckMovementAllowed).toBe(false);
  });

  it("fuel system damage blocks refueling", () => {
    const effects = computeDeckHangarDamageEffects({
      ...intactDamage(),
      fuelSystemDamageBp: 10_000,
    });
    expect(effects.refuelingPermitted).toBe(false);
  });

  it("ordnance storage damage blocks rearming", () => {
    const effects = computeDeckHangarDamageEffects({
      ...intactDamage(),
      ordnanceStorageDamageBp: 10_000,
    });
    expect(effects.rearmingPermitted).toBe(false);
  });

  it("hangar damage increases fire risk", () => {
    const effects = computeDeckHangarDamageEffects({ ...intactDamage(), hangarDamageBp: 7_000 });
    expect(effects.fireExplosionRiskMultiplierBp).toBe(12_000);
  });

  it("catapult damage reduces launch rate", () => {
    const effects = computeDeckHangarDamageEffects({ ...intactDamage(), catapultDamageCount: 1 });
    expect(effects.launchRateMultiplierBp).toBeLessThan(10_000);
  });
});

describe("INC-7 contracts", () => {
  it("INC-7 contract IDs appear in rollup", () => {
    const ids = SHIPPED_CARRIER_OPERATIONS_CONTRACTS.map((c) => c.policyId);
    expect(ids).toContain("carrier_recovery_priority_v1");
    expect(ids).toContain("carrier_ordnance_state_v1");
  });

  it("CarrierRecoveryPriority_v1 validates", () => {
    const record = {
      requests: [
        {
          aircraftId: "ac_01",
          priorityLevel: "EMERGENCY_FUEL",
          squadronId: "sqn_1",
          fuelStateBp: 100,
          isDamaged: false,
          hasHazardousOrdnance: false,
        },
      ],
      deckCapacityAvailable: SafeInt(10),
      requestedSlots: SafeInt(1),
      carrierHasAlternateLanding: false,
      sortedAircraftIds: ["ac_01"],
    };
    expect(() => validateCarrierRecoveryPriorityContract(record)).not.toThrow();
  });

  it("CarrierOrdnanceState_v1 validates", () => {
    const record = {
      transactions: [
        {
          ordnanceTypeId: "bomb_500lb",
          quantity: SafeInt(10),
          transactionType: "RESERVE",
          timestamp: 0,
        },
      ],
      inventoryTypeId: "bomb_500lb",
      availableQuantity: SafeInt(20),
      requestedQuantity: SafeInt(10),
      sufficient: true,
    };
    expect(() => validateCarrierOrdnanceStateContract(record)).not.toThrow();
  });
});
