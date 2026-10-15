import { describe, expect, it } from "vite-plus/test";
import {
  DECK_CYCLE_STATES,
  type ContentionPredicates,
  isValidDeckCycleTransition,
  assertValidDeckCycleTransition,
  OPERATION_CLASSES,
  OPERATION_PRIORITY,
  operationClassPriority,
  priorityComparator,
  isLaunchOrSpottingOperation,
  isRecoveryOperation,
  mayOverlapOnAngledDeck,
  canEmergencyRecoveryPreempt,
  assertContentionPermitted,
  INVALID_CARRIER_DECK_CYCLE_TRANSITION,
  CARRIER_DECK_CONTENTION,
  validateCarrierDeckCycleStateContract,
  validateCarrierDeckContentionContract,
  SHIPPED_CARRIER_OPERATIONS_CONTRACTS,
} from "../../src/carrier-operations/index.js";

function neutralPredicates(overrides: Partial<ContentionPredicates> = {}): ContentionPredicates {
  return {
    hasAngledDeck: false,
    deckDamagePermitsOverlap: false,
    weatherPermitsOverlap: false,
    trafficPermitsOverlap: false,
    hasFueledArmedAircraftOnDeck: false,
    clearDeckCapacitySufficient: true,
    ...overrides,
  };
}

describe("AC-13: Explicit deck-cycle states", () => {
  describe("13 canonical states", () => {
    it("declares exactly the 13 states per DESIGN-44 §11", () => {
      expect([...DECK_CYCLE_STATES]).toEqual([
        "UNREADY",
        "READYING",
        "SPOTTING",
        "SPOTTED",
        "LAUNCHING",
        "FORMING",
        "AIRBORNE",
        "RETURNING",
        "HOLDING",
        "LANDING",
        "REFUELING",
        "REARMING",
        "STRUCK_DOWN",
      ]);
    });
  });

  describe("isValidDeckCycleTransition", () => {
    it("UNREADY → READYING is valid", () => {
      expect(isValidDeckCycleTransition("UNREADY", "READYING")).toBe(true);
    });

    it("UNREADY → LAUNCHING is invalid", () => {
      expect(isValidDeckCycleTransition("UNREADY", "LAUNCHING")).toBe(false);
    });

    it("READYING → SPOTTING is valid", () => {
      expect(isValidDeckCycleTransition("READYING", "SPOTTING")).toBe(true);
    });

    it("READYING → UNREADY is valid (abort)", () => {
      expect(isValidDeckCycleTransition("READYING", "UNREADY")).toBe(true);
    });

    it("SPOTTING → SPOTTED is valid", () => {
      expect(isValidDeckCycleTransition("SPOTTING", "SPOTTED")).toBe(true);
    });

    it("SPOTTING → READYING is valid (abort spotting)", () => {
      expect(isValidDeckCycleTransition("SPOTTING", "READYING")).toBe(true);
    });

    it("SPOTTED → LAUNCHING is valid", () => {
      expect(isValidDeckCycleTransition("SPOTTED", "LAUNCHING")).toBe(true);
    });

    it("LAUNCHING → FORMING is valid", () => {
      expect(isValidDeckCycleTransition("LAUNCHING", "FORMING")).toBe(true);
    });

    it("LAUNCHING → AIRBORNE is valid (skip FORMING)", () => {
      expect(isValidDeckCycleTransition("LAUNCHING", "AIRBORNE")).toBe(true);
    });

    it("FORMING → AIRBORNE is valid", () => {
      expect(isValidDeckCycleTransition("FORMING", "AIRBORNE")).toBe(true);
    });

    it("FORMING → LAUNCHING is valid (reform)", () => {
      expect(isValidDeckCycleTransition("FORMING", "LAUNCHING")).toBe(true);
    });

    it("AIRBORNE → RETURNING is valid", () => {
      expect(isValidDeckCycleTransition("AIRBORNE", "RETURNING")).toBe(true);
    });

    it("AIRBORNE → LANDING is valid (emergency direct landing)", () => {
      expect(isValidDeckCycleTransition("AIRBORNE", "LANDING")).toBe(true);
    });

    it("RETURNING → HOLDING is valid", () => {
      expect(isValidDeckCycleTransition("RETURNING", "HOLDING")).toBe(true);
    });

    it("RETURNING → LANDING is valid (direct landing)", () => {
      expect(isValidDeckCycleTransition("RETURNING", "LANDING")).toBe(true);
    });

    it("HOLDING → LANDING is valid", () => {
      expect(isValidDeckCycleTransition("HOLDING", "LANDING")).toBe(true);
    });

    it("HOLDING → AIRBORNE is valid (abort landing)", () => {
      expect(isValidDeckCycleTransition("HOLDING", "AIRBORNE")).toBe(true);
    });

    it("LANDING → REFUELING is valid", () => {
      expect(isValidDeckCycleTransition("LANDING", "REFUELING")).toBe(true);
    });

    it("LANDING → REARMING is valid", () => {
      expect(isValidDeckCycleTransition("LANDING", "REARMING")).toBe(true);
    });

    it("LANDING → AIRBORNE is valid (bolter/go-around)", () => {
      expect(isValidDeckCycleTransition("LANDING", "AIRBORNE")).toBe(true);
    });

    it("REFUELING → REARMING is valid", () => {
      expect(isValidDeckCycleTransition("REFUELING", "REARMING")).toBe(true);
    });

    it("REFUELING → STRUCK_DOWN is valid", () => {
      expect(isValidDeckCycleTransition("REFUELING", "STRUCK_DOWN")).toBe(true);
    });

    it("REFUELING → LAUNCHING is valid (emergency re-launch)", () => {
      expect(isValidDeckCycleTransition("REFUELING", "LAUNCHING")).toBe(true);
    });

    it("REFUELING → UNREADY is valid (reset)", () => {
      expect(isValidDeckCycleTransition("REFUELING", "UNREADY")).toBe(true);
    });

    it("REARMING → STRUCK_DOWN is valid", () => {
      expect(isValidDeckCycleTransition("REARMING", "STRUCK_DOWN")).toBe(true);
    });

    it("REARMING → LAUNCHING is valid (emergency re-launch)", () => {
      expect(isValidDeckCycleTransition("REARMING", "LAUNCHING")).toBe(true);
    });

    it("REARMING → UNREADY is valid (reset)", () => {
      expect(isValidDeckCycleTransition("REARMING", "UNREADY")).toBe(true);
    });

    it("STRUCK_DOWN → UNREADY is valid (cycle complete)", () => {
      expect(isValidDeckCycleTransition("STRUCK_DOWN", "UNREADY")).toBe(true);
    });
  });

  describe("assertValidDeckCycleTransition", () => {
    it("does not throw for valid transition", () => {
      expect(() => assertValidDeckCycleTransition("UNREADY", "READYING")).not.toThrow();
    });

    it("throws INVALID_CARRIER_DECK_CYCLE_TRANSITION for invalid transition", () => {
      expect(() => assertValidDeckCycleTransition("UNREADY", "LAUNCHING")).toThrow(
        INVALID_CARRIER_DECK_CYCLE_TRANSITION,
      );
    });

    it("throws for STRUCK_DOWN → AIRBORNE", () => {
      expect(() => assertValidDeckCycleTransition("STRUCK_DOWN", "AIRBORNE")).toThrow(
        INVALID_CARRIER_DECK_CYCLE_TRANSITION,
      );
    });

    it("throws for AIRBORNE → UNREADY", () => {
      expect(() => assertValidDeckCycleTransition("AIRBORNE", "UNREADY")).toThrow(
        INVALID_CARRIER_DECK_CYCLE_TRANSITION,
      );
    });
  });
});

describe("AC-14: Deck contention policy", () => {
  describe("operation classes and priority", () => {
    it("has exactly 9 operation classes", () => {
      expect([...OPERATION_CLASSES]).toEqual([
        "EMERGENCY_RECOVERY",
        "ORDINARY_RECOVERY",
        "ALERT_CAP_LAUNCH",
        "ACTIVE_STRIKE_LAUNCH",
        "SEARCH_LAUNCH",
        "ORDINARY_CAP_LAUNCH",
        "SPOTTING",
        "REFUELING_REARMING",
        "STRIKE_DOWN",
      ]);
    });

    it("priority matches DESIGN-44 §12", () => {
      expect(OPERATION_PRIORITY.EMERGENCY_RECOVERY).toBe(1);
      expect(OPERATION_PRIORITY.ORDINARY_RECOVERY).toBe(2);
      expect(OPERATION_PRIORITY.ALERT_CAP_LAUNCH).toBe(3);
      expect(OPERATION_PRIORITY.ACTIVE_STRIKE_LAUNCH).toBe(4);
      expect(OPERATION_PRIORITY.SEARCH_LAUNCH).toBe(5);
      expect(OPERATION_PRIORITY.ORDINARY_CAP_LAUNCH).toBe(6);
      expect(OPERATION_PRIORITY.SPOTTING).toBe(7);
      expect(OPERATION_PRIORITY.REFUELING_REARMING).toBe(8);
      expect(OPERATION_PRIORITY.STRIKE_DOWN).toBe(9);
    });

    it("priorityComparator orders operations by priority", () => {
      expect(priorityComparator("EMERGENCY_RECOVERY", "STRIKE_DOWN")).toBeLessThan(0);
      expect(priorityComparator("STRIKE_DOWN", "EMERGENCY_RECOVERY")).toBeGreaterThan(0);
      expect(priorityComparator("SPOTTING", "SPOTTING")).toBe(0);
    });

    it("operationClassPriority returns correct value", () => {
      expect(operationClassPriority("ALERT_CAP_LAUNCH")).toBe(3);
      expect(operationClassPriority("STRIKE_DOWN")).toBe(9);
    });
  });

  describe("isLaunchOrSpottingOperation", () => {
    it("returns true for launch and spotting operations", () => {
      expect(isLaunchOrSpottingOperation("ALERT_CAP_LAUNCH")).toBe(true);
      expect(isLaunchOrSpottingOperation("ACTIVE_STRIKE_LAUNCH")).toBe(true);
      expect(isLaunchOrSpottingOperation("SEARCH_LAUNCH")).toBe(true);
      expect(isLaunchOrSpottingOperation("ORDINARY_CAP_LAUNCH")).toBe(true);
      expect(isLaunchOrSpottingOperation("SPOTTING")).toBe(true);
    });

    it("returns false for recovery and other operations", () => {
      expect(isLaunchOrSpottingOperation("EMERGENCY_RECOVERY")).toBe(false);
      expect(isLaunchOrSpottingOperation("ORDINARY_RECOVERY")).toBe(false);
      expect(isLaunchOrSpottingOperation("REFUELING_REARMING")).toBe(false);
      expect(isLaunchOrSpottingOperation("STRIKE_DOWN")).toBe(false);
    });
  });

  describe("isRecoveryOperation", () => {
    it("returns true for recovery operations", () => {
      expect(isRecoveryOperation("EMERGENCY_RECOVERY")).toBe(true);
      expect(isRecoveryOperation("ORDINARY_RECOVERY")).toBe(true);
    });

    it("returns false for non-recovery operations", () => {
      expect(isRecoveryOperation("ALERT_CAP_LAUNCH")).toBe(false);
      expect(isRecoveryOperation("SPOTTING")).toBe(false);
      expect(isRecoveryOperation("STRIKE_DOWN")).toBe(false);
    });
  });

  describe("mayOverlapOnAngledDeck", () => {
    const predicates = neutralPredicates({
      hasAngledDeck: true,
      deckDamagePermitsOverlap: true,
      weatherPermitsOverlap: true,
      trafficPermitsOverlap: true,
    });

    it("allows launch + recovery overlap on angled deck", () => {
      expect(mayOverlapOnAngledDeck("ALERT_CAP_LAUNCH", "ORDINARY_RECOVERY", predicates)).toBe(
        true,
      );
    });

    it("allows recovery + spotting overlap on angled deck", () => {
      expect(mayOverlapOnAngledDeck("ORDINARY_RECOVERY", "SPOTTING", predicates)).toBe(true);
    });

    it("does not allow two launch operations to overlap", () => {
      expect(mayOverlapOnAngledDeck("ALERT_CAP_LAUNCH", "ACTIVE_STRIKE_LAUNCH", predicates)).toBe(
        false,
      );
    });

    it("does not allow two recovery operations to overlap", () => {
      expect(mayOverlapOnAngledDeck("EMERGENCY_RECOVERY", "ORDINARY_RECOVERY", predicates)).toBe(
        false,
      );
    });

    it("returns false without angled deck", () => {
      const noAngled = neutralPredicates({ hasAngledDeck: false });
      expect(mayOverlapOnAngledDeck("ALERT_CAP_LAUNCH", "ORDINARY_RECOVERY", noAngled)).toBe(false);
    });

    it("returns false when deck damage prevents overlap", () => {
      const damaged = neutralPredicates({
        hasAngledDeck: true,
        deckDamagePermitsOverlap: false,
        weatherPermitsOverlap: true,
        trafficPermitsOverlap: true,
      });
      expect(mayOverlapOnAngledDeck("ALERT_CAP_LAUNCH", "ORDINARY_RECOVERY", damaged)).toBe(false);
    });

    it("returns false when weather prevents overlap", () => {
      const badWeather = neutralPredicates({
        hasAngledDeck: true,
        deckDamagePermitsOverlap: true,
        weatherPermitsOverlap: false,
        trafficPermitsOverlap: true,
      });
      expect(mayOverlapOnAngledDeck("ALERT_CAP_LAUNCH", "ORDINARY_RECOVERY", badWeather)).toBe(
        false,
      );
    });
  });

  describe("canEmergencyRecoveryPreempt", () => {
    it("can preempt spotting", () => {
      expect(canEmergencyRecoveryPreempt("SPOTTING")).toBe(true);
    });

    it("can preempt launch", () => {
      expect(canEmergencyRecoveryPreempt("ALERT_CAP_LAUNCH")).toBe(true);
    });

    it("cannot preempt emergency recovery", () => {
      expect(canEmergencyRecoveryPreempt("EMERGENCY_RECOVERY")).toBe(false);
    });

    it("cannot preempt ordinary recovery", () => {
      expect(canEmergencyRecoveryPreempt("ORDINARY_RECOVERY")).toBe(false);
    });
  });

  describe("assertContentionPermitted", () => {
    it("allows single operation on straight deck", () => {
      const pred = neutralPredicates();
      expect(() => assertContentionPermitted("SPOTTING", [], pred)).not.toThrow();
    });

    it("rejects second operation on straight deck", () => {
      const pred = neutralPredicates();
      expect(() => assertContentionPermitted("SPOTTING", ["REFUELING_REARMING"], pred)).toThrow(
        CARRIER_DECK_CONTENTION,
      );
    });

    it("allows launch + recovery overlap on angled deck", () => {
      const pred = neutralPredicates({
        hasAngledDeck: true,
        deckDamagePermitsOverlap: true,
        weatherPermitsOverlap: true,
        trafficPermitsOverlap: true,
      });
      expect(() =>
        assertContentionPermitted("ALERT_CAP_LAUNCH", ["ORDINARY_RECOVERY"], pred),
      ).not.toThrow();
    });

    it("rejects two launch operations on angled deck", () => {
      const pred = neutralPredicates({
        hasAngledDeck: true,
        deckDamagePermitsOverlap: true,
        weatherPermitsOverlap: true,
        trafficPermitsOverlap: true,
      });
      expect(() =>
        assertContentionPermitted("ALERT_CAP_LAUNCH", ["ACTIVE_STRIKE_LAUNCH"], pred),
      ).toThrow(CARRIER_DECK_CONTENTION);
    });

    it("allows emergency recovery to preempt spotting", () => {
      const pred = neutralPredicates();
      expect(() =>
        assertContentionPermitted("EMERGENCY_RECOVERY", ["SPOTTING"], pred),
      ).not.toThrow();
    });

    it("rejects emergency recovery preempting another recovery", () => {
      const pred = neutralPredicates();
      expect(() =>
        assertContentionPermitted("EMERGENCY_RECOVERY", ["ORDINARY_RECOVERY"], pred),
      ).toThrow(CARRIER_DECK_CONTENTION);
    });

    it("rejects recovery when fueled/armed aircraft on deck block it", () => {
      const pred = neutralPredicates({
        hasFueledArmedAircraftOnDeck: true,
        clearDeckCapacitySufficient: false,
      });
      expect(() => assertContentionPermitted("ORDINARY_RECOVERY", [], pred)).toThrow(
        CARRIER_DECK_CONTENTION,
      );
    });

    it("allows spotting even with fueled/armed aircraft on deck", () => {
      const pred = neutralPredicates({
        hasFueledArmedAircraftOnDeck: true,
        clearDeckCapacitySufficient: false,
      });
      expect(() => assertContentionPermitted("SPOTTING", [], pred)).not.toThrow();
    });

    it("allows refueling/rearming on any deck with no conflicts", () => {
      const pred = neutralPredicates();
      expect(() => assertContentionPermitted("REFUELING_REARMING", [], pred)).not.toThrow();
    });
  });
});

describe("INC-3 contracts", () => {
  it("CarrierDeckCycleState_v1 validates a valid transition record", () => {
    const record = {
      fromState: "UNREADY",
      toState: "READYING",
      timestamp: 0,
      transitionValidated: true,
    };
    expect(() => validateCarrierDeckCycleStateContract(record)).not.toThrow();
  });

  it("CarrierDeckCycleState_v1 rejects invalid fromState", () => {
    const record = {
      fromState: "INVALID",
      toState: "READYING",
      timestamp: 0,
      transitionValidated: true,
    };
    expect(() => validateCarrierDeckCycleStateContract(record)).toThrow();
  });

  it("CarrierDeckContention_v1 validates a permitted contention", () => {
    const record = {
      requested: "SPOTTING",
      currentOperations: [],
      predicates: neutralPredicates(),
      permitted: true,
    };
    expect(() => validateCarrierDeckContentionContract(record)).not.toThrow();
  });

  it("CarrierDeckContention_v1 rejects invalid requested operation", () => {
    const record = {
      requested: "INVALID",
      currentOperations: [],
      predicates: neutralPredicates(),
      permitted: true,
    };
    expect(() => validateCarrierDeckContentionContract(record)).toThrow();
  });

  it("contract rollup includes the 2 new INC-3 contracts", () => {
    const contractIds = SHIPPED_CARRIER_OPERATIONS_CONTRACTS.map((c) => c.policyId);
    expect(contractIds).toContain("carrier_deck_cycle_state_v1");
    expect(contractIds).toContain("carrier_deck_contention_v1");
  });

  it("INC-3 contracts have exactly 2 entries", () => {
    const inc3Contracts = SHIPPED_CARRIER_OPERATIONS_CONTRACTS.filter(
      (c) =>
        c.policyId === "carrier_deck_cycle_state_v1" || c.policyId === "carrier_deck_contention_v1",
    );
    expect(inc3Contracts).toHaveLength(2);
  });
});
