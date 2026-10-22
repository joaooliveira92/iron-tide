import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import {
  CVL_MIN_CAPACITY,
  CVL_MAX_CAPACITY,
  CV_MIN_CAPACITY,
  ORDINARY_SLOT_CAPACITY_UNITS,
  LIGHT_JET_CAPACITY_UNITS,
  HEAVY_JET_CAPACITY_UNITS,
  HELICOPTER_CAPACITY_UNITS,
  OVERSIZED_CARRIER_THRESHOLD,
  OVERSIZED_DECK_CYCLE_EFFICIENCY_BP,
  OVERSIZED_SORTIE_GENERATION_BP,
  OVERSIZED_MAINTENANCE_COST_BP,
  OVERSIZED_COORDINATION_BP,
  OVERSIZED_HAZARD_BP,
  DECK_CYCLE_STATES,
  INVALID_CARRIER_OPERATIONS_STATE,
  CARRIER_OPERATIONS_INVARIANT_FAILED,
  CARRIER_OPERATIONS_REASON_CODES,
  type CarrierOperationsState,
  type CarrierClassification,
  type DeckCycleState,
  type CarrierCapacityAssignment,
  carrierClassification,
  physicalCapacityUnits,
  capacityUnitsForAircraftType,
  capacityCheck,
  assignAircraft,
  assignmentOrderComparator,
  AssignmentPriority,
  SHIPPED_OVERSIZED_POLICY,
  isOversized,
  assertCarrierOperationsState,
  validateCarrierOperationsStateContract,
  validateOversizedCarrierPolicyContract,
  SHIPPED_CARRIER_OPERATIONS_CONTRACTS,
} from "@bluewave/combat/carrier-operations";
import {
  CARRIER_OPERATIONS_RULESET_VERSION,
  CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT,
} from "@bluewave/combat/carrier-operations";

function validState(overrides: Partial<CarrierOperationsState> = {}): CarrierOperationsState {
  return {
    shipId: "ship_cv_01",
    compiledDesignId: "design_essex_1943",
    classification: "CV" as CarrierClassification,
    physicalCapacityUnits: SafeInt(72),
    occupiedCapacityUnits: SafeInt(48),
    currentSpotValue: SafeInt(18),
    deckCycleState: "UNREADY" as DeckCycleState,
    deckConfigurationId: "straight_deck",
    catapultDefinitions: [],
    liftDefinitions: [],
    flightDeckCondition: CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT,
    hangarCondition: CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT,
    aviationFuelState: { fuelRemainingBp: SafeInt(8_000), fuelCapacityBp: SafeInt(10_000) },
    ordnanceInventory: [],
    assignedAirGroupSquadronIds: [],
    spottedAircraftCount: SafeInt(0),
    fueledAircraftCount: SafeInt(0),
    armedAircraftCount: SafeInt(0),
    airborneAircraftCount: SafeInt(0),
    returningAircraftCount: SafeInt(0),
    damagedAircraftCount: SafeInt(0),
    activeLaunchReservations: [],
    activeRecoveryReservations: [],
    weatherOperabilityState: {
      currentSeaState: SafeInt(3),
      windOverDeckKnots: SafeInt(24),
      precipitationIntensityBp: SafeInt(0),
      visibilityNauticalMiles: SafeInt(10),
      deckFireIntensityBp: SafeInt(0),
      nightOperationsActive: false,
    },
    rulesetVersion: CARRIER_OPERATIONS_RULESET_VERSION,
    formulaVersion: "carrier_operations_formula_v1",
    stateHash: "a".repeat(64),
    ...overrides,
  };
}

describe("AC-1: Complete carrier state", () => {
  it("constructs a valid CarrierOperationsState with all §1 fields", () => {
    const state = validState();
    expect(state.shipId).toBe("ship_cv_01");
    expect(state.compiledDesignId).toBe("design_essex_1943");
    expect(state.classification).toBe("CV");
    expect(Number(state.physicalCapacityUnits)).toBe(72);
    expect(Number(state.occupiedCapacityUnits)).toBe(48);
    expect(state.deckCycleState).toBe("UNREADY");
    expect(state.rulesetVersion).toBe(CARRIER_OPERATIONS_RULESET_VERSION);
    expect(state.stateHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("assertCarrierOperationsState passes for valid state", () => {
    expect(() => assertCarrierOperationsState(validState())).not.toThrow();
  });

  it("assertCarrierOperationsState rejects missing shipId", () => {
    expect(() => assertCarrierOperationsState(validState({ shipId: "" }))).toThrow(
      INVALID_CARRIER_OPERATIONS_STATE,
    );
  });

  it("assertCarrierOperationsState rejects invalid classification", () => {
    expect(() =>
      assertCarrierOperationsState(
        validState({ classification: "INVALID" as CarrierClassification }),
      ),
    ).toThrow(INVALID_CARRIER_OPERATIONS_STATE);
  });

  it("assertCarrierOperationsState rejects occupied > physical capacity", () => {
    expect(() =>
      assertCarrierOperationsState(
        validState({ occupiedCapacityUnits: SafeInt(100), physicalCapacityUnits: SafeInt(72) }),
      ),
    ).toThrow(INVALID_CARRIER_OPERATIONS_STATE);
  });

  it("assertCarrierOperationsState rejects invalid deckCycleState", () => {
    expect(() =>
      assertCarrierOperationsState(validState({ deckCycleState: "INVALID" as DeckCycleState })),
    ).toThrow(INVALID_CARRIER_OPERATIONS_STATE);
  });

  it("assertCarrierOperationsState rejects wrong ruleset version", () => {
    expect(() => assertCarrierOperationsState(validState({ rulesetVersion: "wrong_v1" }))).toThrow(
      INVALID_CARRIER_OPERATIONS_STATE,
    );
  });
});

describe("AC-1: CarrierOperationsState_v1 contract", () => {
  it("validates a valid state through Zod contract", () => {
    expect(() => validateCarrierOperationsStateContract(validState())).not.toThrow();
  });

  it("rejects state with empty shipId through contract", () => {
    expect(() => validateCarrierOperationsStateContract(validState({ shipId: "" }))).toThrow(
      INVALID_CARRIER_OPERATIONS_STATE,
    );
  });
});

describe("AC-2: Classification capacity bounds", () => {
  it("classifies capacity 4 as CVL", () => {
    expect(carrierClassification(4)).toBe("CVL");
  });

  it("classifies capacity 34 as CVL", () => {
    expect(carrierClassification(34)).toBe("CVL");
  });

  it("classifies capacity 35 as CV", () => {
    expect(carrierClassification(35)).toBe("CV");
  });

  it("classifies capacity 100 as CV", () => {
    expect(carrierClassification(100)).toBe("CV");
  });

  it("rejects capacity below 4", () => {
    expect(() => carrierClassification(3)).toThrow(INVALID_CARRIER_OPERATIONS_STATE);
  });

  it("rejects capacity 0", () => {
    expect(() => carrierClassification(0)).toThrow(INVALID_CARRIER_OPERATIONS_STATE);
  });

  it("CVL_MIN_CAPACITY equals 4", () => {
    expect(CVL_MIN_CAPACITY).toBe(4);
  });

  it("CVL_MAX_CAPACITY equals 34", () => {
    expect(CVL_MAX_CAPACITY).toBe(34);
  });

  it("CV_MIN_CAPACITY equals 35", () => {
    expect(CV_MIN_CAPACITY).toBe(35);
  });
});

describe("AC-3: Capacity units scale", () => {
  it("physicalCapacityUnits = compiledAircraftCapacity * 2", () => {
    expect(Number(physicalCapacityUnits(4))).toBe(8);
    expect(Number(physicalCapacityUnits(35))).toBe(70);
    expect(Number(physicalCapacityUnits(100))).toBe(200);
  });

  it("piston aircraft consume 2 units", () => {
    expect(Number(capacityUnitsForAircraftType("FIGHTER"))).toBe(ORDINARY_SLOT_CAPACITY_UNITS);
    expect(Number(capacityUnitsForAircraftType("TORPEDO_BOMBER"))).toBe(
      ORDINARY_SLOT_CAPACITY_UNITS,
    );
    expect(Number(capacityUnitsForAircraftType("MEDIUM_BOMBER"))).toBe(
      ORDINARY_SLOT_CAPACITY_UNITS,
    );
  });

  it("light jet fighter consumes 3 units", () => {
    expect(Number(capacityUnitsForAircraftType("LIGHT_JET_FIGHTER"))).toBe(
      LIGHT_JET_CAPACITY_UNITS,
    );
  });

  it("heavy jet fighter consumes 3 units", () => {
    expect(Number(capacityUnitsForAircraftType("HEAVY_JET_FIGHTER"))).toBe(
      HEAVY_JET_CAPACITY_UNITS,
    );
  });

  it("jet attack aircraft consumes 3 units", () => {
    expect(Number(capacityUnitsForAircraftType("JET_ATTACK_AIRCRAFT"))).toBe(
      LIGHT_JET_CAPACITY_UNITS,
    );
  });

  it("helicopter consumes 2 units", () => {
    expect(Number(capacityUnitsForAircraftType("HELICOPTER"))).toBe(HELICOPTER_CAPACITY_UNITS);
  });

  it("rejects unknown aircraft type", () => {
    expect(() => capacityUnitsForAircraftType("INVALID")).toThrow(
      CARRIER_OPERATIONS_INVARIANT_FAILED,
    );
  });
});

describe("AC-4: Integer capacity check", () => {
  it("passes when occupied + assigned <= physical", () => {
    expect(capacityCheck(SafeInt(72), SafeInt(48), SafeInt(24))).toBe(true);
  });

  it("passes when occupied + assigned equals physical", () => {
    expect(capacityCheck(SafeInt(72), SafeInt(48), SafeInt(24))).toBe(true);
  });

  it("fails when occupied + assigned > physical", () => {
    expect(capacityCheck(SafeInt(72), SafeInt(48), SafeInt(30))).toBe(false);
  });

  it("passes with zero occupied", () => {
    expect(capacityCheck(SafeInt(72), SafeInt(0), SafeInt(72))).toBe(true);
  });
});

describe("AC-5: Deterministic capacity assignment", () => {
  it("processes assignments in priority order", () => {
    const assignments: CarrierCapacityAssignment[] = [
      {
        squadronId: "sqn_vf_1",
        aircraftModelId: "f4f_wildcat",
        aircraftType: "FIGHTER",
        capacityUnits: SafeInt(2),
        assignmentPriority: AssignmentPriority.CAP,
      },
      {
        squadronId: "sqn_vb_3",
        aircraftModelId: "sb2c_helldiver",
        aircraftType: "DIVE_BOMBER",
        capacityUnits: SafeInt(2),
        assignmentPriority: AssignmentPriority.STRIKE,
      },
      {
        squadronId: "sqn_vs_5",
        aircraftModelId: "sbd_dauntless",
        aircraftType: "DIVE_BOMBER",
        capacityUnits: SafeInt(2),
        assignmentPriority: AssignmentPriority.SEARCH,
      },
    ];
    const sorted = [...assignments].sort(assignmentOrderComparator);
    expect(sorted[0].assignmentPriority).toBe(AssignmentPriority.CAP);
    expect(sorted[1].assignmentPriority).toBe(AssignmentPriority.STRIKE);
    expect(sorted[2].assignmentPriority).toBe(AssignmentPriority.SEARCH);
  });

  it("accepts all when capacity sufficient", () => {
    const assignments: CarrierCapacityAssignment[] = [
      {
        squadronId: "sqn_vf_1",
        aircraftModelId: "f4f_wildcat",
        aircraftType: "FIGHTER",
        capacityUnits: SafeInt(2),
        assignmentPriority: AssignmentPriority.CAP,
      },
      {
        squadronId: "sqn_vf_2",
        aircraftModelId: "f4f_wildcat",
        aircraftType: "FIGHTER",
        capacityUnits: SafeInt(2),
        assignmentPriority: AssignmentPriority.PERMANENT,
      },
    ];
    const result = assignAircraft(assignments, SafeInt(72), SafeInt(0));
    expect(result.accepted).toHaveLength(2);
    expect(result.rejected).toHaveLength(0);
    expect(Number(result.finalOccupied)).toBe(4);
  });

  it("rejects excess aircraft with capacity exceeded", () => {
    const assignments: CarrierCapacityAssignment[] = [
      {
        squadronId: "sqn_vf_1",
        aircraftModelId: "f4f_wildcat",
        aircraftType: "FIGHTER",
        capacityUnits: SafeInt(2),
        assignmentPriority: AssignmentPriority.CAP,
      },
      {
        squadronId: "sqn_vf_2",
        aircraftModelId: "f4f_wildcat",
        aircraftType: "FIGHTER",
        capacityUnits: SafeInt(72),
        assignmentPriority: AssignmentPriority.PERMANENT,
      },
    ];
    const result = assignAircraft(assignments, SafeInt(72), SafeInt(0));
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected).toHaveLength(1);
    expect(Number(result.finalOccupied)).toBe(2);
  });

  it("maintains deterministic order for same-priority assignments", () => {
    const a: CarrierCapacityAssignment = {
      squadronId: "sqn_a",
      aircraftModelId: "model_a",
      aircraftType: "FIGHTER",
      capacityUnits: SafeInt(2),
      assignmentPriority: AssignmentPriority.PERMANENT,
    };
    const b: CarrierCapacityAssignment = {
      squadronId: "sqn_b",
      aircraftModelId: "model_b",
      aircraftType: "FIGHTER",
      capacityUnits: SafeInt(2),
      assignmentPriority: AssignmentPriority.PERMANENT,
    };
    expect(assignmentOrderComparator(a, b)).toBeLessThan(0);
    expect(assignmentOrderComparator(b, a)).toBeGreaterThan(0);
    expect(assignmentOrderComparator(a, a)).toBe(0);
  });
});

describe("AC-6: Oversized carrier policy", () => {
  it("threshold equals 100", () => {
    expect(OVERSIZED_CARRIER_THRESHOLD).toBe(100);
  });

  it("isOversized returns false for capacity 100", () => {
    expect(isOversized(100)).toBe(false);
  });

  it("isOversized returns true for capacity 101", () => {
    expect(isOversized(101)).toBe(true);
  });

  it("isOversized returns false for capacity 4", () => {
    expect(isOversized(4)).toBe(false);
  });

  it("shipped oversized policy has correct multipliers (BP values)", () => {
    const policy = SHIPPED_OVERSIZED_POLICY;
    expect(policy.threshold).toBe(OVERSIZED_CARRIER_THRESHOLD);
    expect(policy.deckCycleEfficiencyBp).toBe(OVERSIZED_DECK_CYCLE_EFFICIENCY_BP);
    expect(policy.sortieGenerationBp).toBe(OVERSIZED_SORTIE_GENERATION_BP);
    expect(policy.maintenanceCostBp).toBe(OVERSIZED_MAINTENANCE_COST_BP);
    expect(policy.coordinationBp).toBe(OVERSIZED_COORDINATION_BP);
    expect(policy.hazardBp).toBe(OVERSIZED_HAZARD_BP);
  });

  it("shipped policy validates through Zod contract", () => {
    expect(() => validateOversizedCarrierPolicyContract(SHIPPED_OVERSIZED_POLICY)).not.toThrow();
  });

  it("shipped policy values match DESIGN-44 §5", () => {
    expect(SHIPPED_OVERSIZED_POLICY.deckCycleEfficiencyBp).toBe(9_000);
    expect(SHIPPED_OVERSIZED_POLICY.sortieGenerationBp).toBe(9_000);
    expect(SHIPPED_OVERSIZED_POLICY.maintenanceCostBp).toBe(12_500);
    expect(SHIPPED_OVERSIZED_POLICY.coordinationBp).toBe(9_500);
    expect(SHIPPED_OVERSIZED_POLICY.hazardBp).toBe(11_000);
  });
});

describe("INC-1 contract rollup", () => {
  it("ships exactly 3 INC-1 contracts in rollup", () => {
    const inc1Contracts = SHIPPED_CARRIER_OPERATIONS_CONTRACTS.filter(
      (c) =>
        c.policyId === "carrier_operations_state_v1" ||
        c.policyId === "carrier_capacity_assignment_v1" ||
        c.policyId === "oversized_carrier_policy_v1",
    );
    expect(inc1Contracts).toHaveLength(3);
  });

  it("shipped contracts are all defined", () => {
    expect(SHIPPED_CARRIER_OPERATIONS_CONTRACTS[0].policyId).toBe("carrier_operations_state_v1");
    expect(SHIPPED_CARRIER_OPERATIONS_CONTRACTS[1].policyId).toBe("carrier_capacity_assignment_v1");
    expect(SHIPPED_CARRIER_OPERATIONS_CONTRACTS[2].policyId).toBe("oversized_carrier_policy_v1");
  });
});

describe("Reason codes surface", () => {
  it("all 21 §31 codes are present in the catalog", () => {
    const codes = Object.keys(CARRIER_OPERATIONS_REASON_CODES);
    expect(codes).toContain("INVALID_CARRIER_OPERATIONS_STATE");
    expect(codes).toContain("CARRIER_CAPACITY_EXCEEDED");
    expect(codes).toContain("CARRIER_AIRCRAFT_CAPACITY_INCOMPATIBLE");
    expect(codes).toContain("CARRIER_OVERSIZED_AIR_GROUP_PENALTY_ACTIVE");
    expect(codes).toContain("CARRIER_SPOT_VALUE_ZERO");
    expect(codes).toContain("CARRIER_STRIKE_EXCEEDS_SPOT_VALUE");
    expect(codes).toContain("JET_CARRIER_DISPLACEMENT_INSUFFICIENT");
    expect(codes).toContain("JET_CARRIER_CATAPULT_REQUIRED");
    expect(codes).toContain("HEAVY_JET_CARRIER_INELIGIBLE");
    expect(codes).toContain("HEAVY_JET_ANGLED_DECK_REQUIRED");
    expect(codes).toContain("INVALID_CARRIER_DECK_CYCLE_TRANSITION");
    expect(codes).toContain("CARRIER_DECK_CONTENTION");
    expect(codes).toContain("CARRIER_MANEUVER_LOCKED_BY_DECK_OPERATION");
    expect(codes).toContain("CARRIER_WIND_OVER_DECK_INSUFFICIENT");
    expect(codes).toContain("CARRIER_OPERATIONS_SUSPENDED_BY_WEATHER");
    expect(codes).toContain("CARRIER_NIGHT_RECOVERY_INELIGIBLE");
    expect(codes).toContain("CARRIER_RECOVERY_OPERATIONAL_LOSS");
    expect(codes).toContain("CARRIER_AVIATION_FIRE_HAZARD");
    expect(codes).toContain("CARRIER_AVIATION_ORDNANCE_HAZARD");
    expect(codes).toContain("CARRIER_ORDNANCE_INVENTORY_INSUFFICIENT");
    expect(codes).toContain("CARRIER_OPERATIONS_INVARIANT_FAILED");
  });

  it("has exactly 21 reason codes (§31)", () => {
    expect(Object.keys(CARRIER_OPERATIONS_REASON_CODES)).toHaveLength(21);
  });
});

describe("13 canonical deck cycle states", () => {
  it("declares exactly the 13 states per §11", () => {
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
