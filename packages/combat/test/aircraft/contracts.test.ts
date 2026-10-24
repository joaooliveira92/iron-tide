import { describe, expect, it } from "vite-plus/test";
import { BluewaveError, isBluewaveError } from "@bluewave/contracts";
import {
  AircraftModelDefinition_v1,
  INVALID_AIRCRAFT_MODEL_DEFINITION,
  SHIPPED_AIRCRAFT_CONTRACTS,
  type AircraftModelDefinition,
  validateAircraftModelDefinition,
  validateAircraftModelDefinitionContract,
  validateAllAircraftContracts,
} from "@bluewave/combat/aircraft";

const entry = SHIPPED_AIRCRAFT_CONTRACTS[0];
const shipped = entry.shippedContract as AircraftModelDefinition;

const requiredModelFields = [
  "aircraftModelId",
  "aircraftType",
  "ownerOrLicenseHolder",
  "introductionMonth",
  "speed",
  "firepower",
  "maneuverability",
  "toughness",
  "payloadCapacity",
  "rangeClass",
  "rangeDistance",
  "eligibleRoleIds",
  "basingRequirementId",
  "carrierSuitable",
  "technologyPrerequisiteIds",
  "productionWork",
  "unitCost",
  "maintenanceRequirement",
  "crewRequirement",
  "contentVersion",
  "contentHash",
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

describe("aircraft contract registry", () => {
  it("registers the model-definition contract once", () => {
    expect(SHIPPED_AIRCRAFT_CONTRACTS).toHaveLength(1);
    expect(entry.policyId).toBe("aircraft_model_definition_v1");
  });

  it("holds contract data rather than a Schema", () => {
    expect(typeof entry.shippedContract).toBe("object");
    expect(entry.shippedContract).not.toBeNull();
    expect(Array.isArray(entry.shippedContract)).toBe(false);
    expect(entry.shippedContract).not.toBe(AircraftModelDefinition_v1);
    expect((entry.shippedContract as { aircraftModelId?: unknown }).aircraftModelId).toBe(
      "aircraft_model_definition_v1",
    );
  });

  it("validates every shipped contract through its own validator", () => {
    for (const contract of SHIPPED_AIRCRAFT_CONTRACTS) {
      expect(() => contract.validate(contract.shippedContract)).not.toThrow();
    }
  });

  it("validateAllAircraftContracts passes", () => {
    expect(() => validateAllAircraftContracts()).not.toThrow();
  });
});

describe("aircraft model contract decoding", () => {
  it("accepts the shipped contract data", () => {
    expect(() => validateAircraftModelDefinitionContract(shipped)).not.toThrow();
  });

  it("rejects an excess top-level property", () => {
    const error = capture(() =>
      validateAircraftModelDefinitionContract({ ...shipped, unexpectedProperty: true }),
    );

    expect(error._tag).toBe("BluewaveError");
    expect(error.message).toBe(INVALID_AIRCRAFT_MODEL_DEFINITION);
    expect(error.context.code).toBe(INVALID_AIRCRAFT_MODEL_DEFINITION);
    expect(error.context.field).toBe("unexpectedProperty");
    expect(error.context.reason).toBe("Expected no excess property");
    expect(error.context.issues).toEqual([
      { path: "unexpectedProperty", message: "Expected no excess property" },
    ]);
  });

  it("reports every missing required field in declaration order", () => {
    const error = capture(() => validateAircraftModelDefinitionContract({}));

    expect(error.context.field).toBe("aircraftModelId");
    expect(error.context.reason).toBe("Missing key");
    expect(
      (error.context.issues as ReadonlyArray<{ path: string }>).map((issue) => issue.path),
    ).toEqual([...requiredModelFields]);
    for (const issue of error.context.issues as ReadonlyArray<{ message: string }>) {
      expect(issue.message).toBe("Missing key");
    }
    expect(error.context.value).toEqual({});
  });
});

describe("hand-written aircraft model validation delegates to the contract schema", () => {
  it("accepts the shipped contract data", () => {
    expect(() => validateAircraftModelDefinition(shipped)).not.toThrow();
  });

  it.each([
    ["aircraftModelId", { aircraftModelId: "" }],
    ["aircraftType", { aircraftType: "INVALID" }],
    ["ownerOrLicenseHolder", { ownerOrLicenseHolder: "" }],
    ["introductionMonth", { introductionMonth: "" }],
    ["speed", { speed: -1 }],
    ["firepower", { firepower: 101 }],
    ["eligibleRoleIds", { eligibleRoleIds: [] }],
    ["basingRequirementId", { basingRequirementId: "INVALID" }],
    ["carrierSuitable", { carrierSuitable: "yes" }],
    ["deckRequirement", { deckRequirement: 5 }],
    ["contentVersion", { contentVersion: "" }],
  ] as const)("reports %s with the same error shape as the contract validator", (field, change) => {
    const invalid = Object.assign({}, shipped, change);

    const delegated = capture(() => validateAircraftModelDefinition(invalid));
    const direct = capture(() => validateAircraftModelDefinitionContract(invalid));

    expect(delegated._tag).toBe("BluewaveError");
    expect(delegated.message).toBe(INVALID_AIRCRAFT_MODEL_DEFINITION);
    expect(delegated.context.code).toBe(INVALID_AIRCRAFT_MODEL_DEFINITION);
    expect(delegated.context.field).toBe(field);
    expect(delegated.context.field).toBe(direct.context.field);
    expect(delegated.context.reason).toBe(direct.context.reason);
    expect(delegated.context.issues).toEqual(direct.context.issues);
  });
});
