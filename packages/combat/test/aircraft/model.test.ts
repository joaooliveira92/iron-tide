import { describe, expect, it } from "vite-plus/test";
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import {
  INVALID_AIRCRAFT_MODEL_DEFINITION,
  AIRCRAFT_TYPES,
  AIRCRAFT_BASING_CLASSES,
  type AircraftModelDefinition,
  type AircraftType,
  validateAircraftModelDefinition,
  withAircraftModelDefinitionContentHash,
  verifyAircraftModelDefinitionContentHash,
  validateAircraftModelDefinitionContract,
} from "../../src/aircraft/index.js";

function baseDef(
  overrides: Partial<Omit<AircraftModelDefinition, "contentHash">> = {},
): Omit<AircraftModelDefinition, "contentHash"> {
  return {
    aircraftModelId: "spad_s_xiii_1917",
    aircraftType: "FIGHTER" as AircraftType,
    ownerOrLicenseHolder: "nation_france",
    introductionMonth: "1917-05",
    speed: SafeInt(72),
    firepower: SafeInt(50),
    maneuverability: SafeInt(55),
    toughness: SafeInt(50),
    payloadCapacity: SafeInt(100),
    rangeClass: "SHORT",
    rangeDistance: SafeInt(300),
    eligibleRoleIds: ["CAP", "ESCORT", "INTERCEPTION"],
    basingRequirementId: "LAND_BASED",
    carrierSuitable: false,
    technologyPrerequisiteIds: ["early_aviation", "fighter_design"],
    productionWork: SafeInt(500),
    unitCost: SafeInt(1_200),
    maintenanceRequirement: SafeInt(50),
    crewRequirement: SafeInt(1),
    contentVersion: "aircraft_model_definition_v1",
    ...overrides,
  };
}

function validDef(): AircraftModelDefinition {
  return withAircraftModelDefinitionContentHash(baseDef());
}

function makeDef(
  overrides: Partial<Omit<AircraftModelDefinition, "contentHash">> = {},
): AircraftModelDefinition {
  return withAircraftModelDefinitionContentHash(baseDef(overrides));
}

function expectInvalid(build: () => AircraftModelDefinition, field: string): void {
  let err: BluewaveError | undefined;
  try {
    validateAircraftModelDefinition(build());
  } catch (e) {
    err = e as BluewaveError;
  }
  expect(err).toBeDefined();
  expect(err!.message).toBe(INVALID_AIRCRAFT_MODEL_DEFINITION);
  expect(err!.context.field).toBe(field);
}

describe("AC-1: 12 canonical aircraft types", () => {
  it("declares exactly the 12 canonical types", () => {
    expect([...AIRCRAFT_TYPES]).toEqual([
      "FIGHTER",
      "TORPEDO_BOMBER",
      "DIVE_BOMBER",
      "MEDIUM_BOMBER",
      "PATROL_AIRCRAFT",
      "FLOATPLANE_SCOUT",
      "AIRSHIP",
      "LIGHT_JET_FIGHTER",
      "HEAVY_JET_FIGHTER",
      "JET_ATTACK_AIRCRAFT",
      "HELICOPTER",
      "SPECIAL_SQUADRON",
    ]);
  });
});

describe("AC-2: a valid AircraftModelDefinition with all §2 fields validates", () => {
  it("validates a fighter model with full §2 fields and deterministic content hash", () => {
    const def = validDef();
    expect(() => validateAircraftModelDefinition(def)).not.toThrow();
    expect(def.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyAircraftModelDefinitionContentHash(def)).toBe(true);
  });

  it("passes the Zod contract validation", () => {
    const def = validDef();
    expect(() => validateAircraftModelDefinitionContract(def)).not.toThrow();
  });
});

describe("AC-2: missing or invalid field fails with INVALID_AIRCRAFT_MODEL_DEFINITION", () => {
  it("rejects empty aircraftModelId", () => {
    expectInvalid(() => makeDef({ aircraftModelId: "" }), "aircraftModelId");
  });

  it("rejects invalid aircraftType", () => {
    const def = baseDef({ aircraftType: "INVALID" as AircraftType });
    expectInvalid(() => withAircraftModelDefinitionContentHash(def), "aircraftType");
  });

  it("rejects missing ownerOrLicenseHolder", () => {
    expectInvalid(() => makeDef({ ownerOrLicenseHolder: "" }), "ownerOrLicenseHolder");
  });

  it("rejects missing introductionMonth", () => {
    expectInvalid(() => makeDef({ introductionMonth: "" }), "introductionMonth");
  });

  it("rejects speed < 0", () => {
    expectInvalid(() => makeDef({ speed: SafeInt(-1) }), "speed");
  });

  it("rejects firepower > 100", () => {
    expectInvalid(() => makeDef({ firepower: SafeInt(101) }), "firepower");
  });

  it("rejects empty eligibleRoleIds", () => {
    expectInvalid(() => makeDef({ eligibleRoleIds: [] }), "eligibleRoleIds");
  });

  it("rejects invalid basingRequirementId", () => {
    const def = baseDef({ basingRequirementId: "INVALID" as "LAND_BASED" });
    expectInvalid(() => withAircraftModelDefinitionContentHash(def), "basingRequirementId");
  });

  it("rejects missing contentVersion", () => {
    expectInvalid(() => makeDef({ contentVersion: "" }), "contentVersion");
  });
});

describe("AC-2: content hash determinism", () => {
  it("produces identical hash for identical inputs", () => {
    const a = withAircraftModelDefinitionContentHash(baseDef());
    const b = withAircraftModelDefinitionContentHash(baseDef());
    expect(a.contentHash).toBe(b.contentHash);
  });

  it("produces different hash for different inputs", () => {
    const a = withAircraftModelDefinitionContentHash(baseDef());
    const b = withAircraftModelDefinitionContentHash(baseDef({ speed: SafeInt(73) }));
    expect(a.contentHash).not.toBe(b.contentHash);
  });
});

describe("Basing classes enum", () => {
  it("declares exactly the 6 canonical basing classes", () => {
    expect([...AIRCRAFT_BASING_CLASSES]).toEqual([
      "LAND_BASED",
      "CARRIER_BASED",
      "SEAPLANE_SUPPORTED",
      "AIRSHIP_BASED",
      "HELICOPTER_DECK_BASED",
      "SPECIAL_EXPLICIT",
    ]);
  });
});
