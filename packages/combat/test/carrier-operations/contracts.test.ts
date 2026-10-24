import { describe, expect, it } from "vite-plus/test";
import { BluewaveError, isBluewaveError } from "@bluewave/contracts";
import {
  CARRIER_OPERATIONS_INVARIANT_FAILED,
  INVALID_CARRIER_OPERATIONS_STATE,
  SHIPPED_CARRIER_OPERATIONS_CONTRACTS,
  type CarrierOperationsStateContract,
  validateAllCarrierOperationsContracts,
  validateCarrierOperationsStateContract,
} from "@bluewave/combat/carrier-operations";

const REQUIRED_CARRIER_STATE_FIELDS = [
  "shipId",
  "compiledDesignId",
  "classification",
  "physicalCapacityUnits",
  "occupiedCapacityUnits",
  "currentSpotValue",
  "deckCycleState",
  "deckConfigurationId",
  "catapultDefinitions",
  "liftDefinitions",
  "flightDeckCondition",
  "hangarCondition",
  "aviationFuelState",
  "ordnanceInventory",
  "assignedAirGroupSquadronIds",
  "spottedAircraftCount",
  "fueledAircraftCount",
  "armedAircraftCount",
  "airborneAircraftCount",
  "returningAircraftCount",
  "damagedAircraftCount",
  "activeLaunchReservations",
  "activeRecoveryReservations",
  "weatherOperabilityState",
  "rulesetVersion",
  "formulaVersion",
  "stateHash",
] as const;

const CANONICAL_POLICY_IDS = [
  "carrier_operations_state_v1",
  "carrier_capacity_assignment_v1",
  "oversized_carrier_policy_v1",
  "carrier_deck_cycle_state_v1",
  "carrier_deck_contention_v1",
  "carrier_strike_state_v1",
  "carrier_launch_rate_v1",
  "carrier_wind_over_deck_v1",
  "carrier_hazard_exposure_v1",
  "carrier_night_recovery_v1",
  "carrier_weather_suspension_v1",
  "carrier_recovery_priority_v1",
  "carrier_ordnance_state_v1",
] as const;

function capture(run: () => void): BluewaveError {
  try {
    run();
  } catch (error) {
    if (!isBluewaveError(error)) throw error;
    return error;
  }
  throw new Error("expected a BluewaveError");
}

const stateEntry = SHIPPED_CARRIER_OPERATIONS_CONTRACTS[0];
const shippedState = stateEntry.shippedContract as CarrierOperationsStateContract;

describe("carrier-operations contract registry", () => {
  it("ships every contract in canonical order", () => {
    expect(SHIPPED_CARRIER_OPERATIONS_CONTRACTS.map((entry) => entry.policyId)).toEqual([
      ...CANONICAL_POLICY_IDS,
    ]);
  });

  it("holds contract data rather than Schema objects", () => {
    for (const entry of SHIPPED_CARRIER_OPERATIONS_CONTRACTS) {
      expect(typeof entry.shippedContract).toBe("object");
      expect(entry.shippedContract).not.toBeNull();
      expect(Array.isArray(entry.shippedContract)).toBe(false);
    }
  });

  it("validates every shipped contract through its own validator", () => {
    for (const entry of SHIPPED_CARRIER_OPERATIONS_CONTRACTS) {
      expect(() => entry.validate(entry.shippedContract)).not.toThrow();
    }
  });

  it("validateAllCarrierOperationsContracts passes", () => {
    expect(() => validateAllCarrierOperationsContracts()).not.toThrow();
  });
});

describe("carrier-operations strict contract decoding", () => {
  it("rejects an excess property on every shipped contract", () => {
    for (const entry of SHIPPED_CARRIER_OPERATIONS_CONTRACTS) {
      const expectedCode =
        entry.policyId === "oversized_carrier_policy_v1"
          ? CARRIER_OPERATIONS_INVARIANT_FAILED
          : INVALID_CARRIER_OPERATIONS_STATE;
      const tampered = { ...(entry.shippedContract as object), unexpectedProperty: true };

      const error = capture(() => entry.validate(tampered));

      expect(error._tag).toBe("BluewaveError");
      expect(error.message).toBe(expectedCode);
      expect(error.context.code).toBe(expectedCode);
      expect(error.context.field).toBe("unexpectedProperty");
      expect(error.context.reason).toBe("Expected no excess property");
      expect(error.context.issues).toEqual([
        { path: "unexpectedProperty", message: "Expected no excess property" },
      ]);
    }
  });

  it("rejects an excess nested property and reports its joined path", () => {
    const error = capture(() =>
      validateCarrierOperationsStateContract({
        ...shippedState,
        weatherOperabilityState: {
          ...shippedState.weatherOperabilityState,
          unexpectedProperty: true,
        },
      }),
    );

    expect(error.context.code).toBe(INVALID_CARRIER_OPERATIONS_STATE);
    expect(error.context.field).toBe("weatherOperabilityState.unexpectedProperty");
    expect(error.context.issues).toEqual([
      {
        path: "weatherOperabilityState.unexpectedProperty",
        message: "Expected no excess property",
      },
    ]);
  });

  it("reports every missing required state field in declaration order", () => {
    const error = capture(() => validateCarrierOperationsStateContract({}));

    expect(error.context.field).toBe("shipId");
    expect(error.context.reason).toBe("Missing key");
    expect(
      (error.context.issues as ReadonlyArray<{ path: string }>).map((issue) => issue.path),
    ).toEqual([...REQUIRED_CARRIER_STATE_FIELDS]);
    expect(error.context.value).toEqual({});
  });

  it("preserves nested issue order and paths", () => {
    const error = capture(() =>
      validateCarrierOperationsStateContract({
        ...shippedState,
        aviationFuelState: {},
        weatherOperabilityState: { ...shippedState.weatherOperabilityState, currentSeaState: -1 },
      }),
    );

    expect(error.context.field).toBe("aviationFuelState.fuelRemainingBp");
    expect(
      (error.context.issues as ReadonlyArray<{ path: string }>).map((issue) => issue.path),
    ).toEqual([
      "aviationFuelState.fuelRemainingBp",
      "aviationFuelState.fuelCapacityBp",
      "weatherOperabilityState.currentSeaState",
    ]);
  });
});
