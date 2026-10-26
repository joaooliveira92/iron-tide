import { SafeInt } from "@bluewave/contracts";
import { Schema } from "effect";
import { decodeContract } from "../schema-issues.js";
import { safeIntSchema as safeInt } from "../safe-int-schema.js";
import {
  AIRCRAFT_BASING_CLASSES,
  AIRCRAFT_SCORE_MAX,
  AIRCRAFT_SCORE_MIN,
  AIRCRAFT_TYPES,
} from "./constants.js";
import { INVALID_AIRCRAFT_MODEL_DEFINITION } from "./reasonCodes.js";

const nonEmptyString = Schema.String.check(Schema.isMinLength(1));

const score = safeInt.check(
  Schema.isBetween({ minimum: AIRCRAFT_SCORE_MIN, maximum: AIRCRAFT_SCORE_MAX }),
);

export const AircraftModelDefinition_v1 = Schema.Struct({
  aircraftModelId: nonEmptyString,
  aircraftType: Schema.Literals(AIRCRAFT_TYPES),
  ownerOrLicenseHolder: nonEmptyString,
  introductionMonth: nonEmptyString,
  speed: score,
  firepower: score,
  maneuverability: score,
  toughness: score,
  payloadCapacity: safeInt,
  rangeClass: nonEmptyString,
  rangeDistance: safeInt,
  eligibleRoleIds: Schema.Array(nonEmptyString).check(Schema.isMinLength(1)),
  basingRequirementId: Schema.Literals(AIRCRAFT_BASING_CLASSES),
  carrierSuitable: Schema.Boolean,
  deckRequirement: Schema.optional(Schema.String),
  catapultRequirement: Schema.optional(Schema.String),
  technologyPrerequisiteIds: Schema.Array(nonEmptyString),
  productionWork: safeInt,
  unitCost: safeInt,
  maintenanceRequirement: safeInt,
  crewRequirement: safeInt,
  contentVersion: nonEmptyString,
  contentHash: nonEmptyString,
});

export type AircraftModelDefinitionContract = typeof AircraftModelDefinition_v1.Type;

type _AssertSafeInt<T> = T extends SafeInt ? true : never;
const _assertSafeIntLeaves: [
  _AssertSafeInt<AircraftModelDefinitionContract["speed"]>,
  _AssertSafeInt<AircraftModelDefinitionContract["firepower"]>,
  _AssertSafeInt<AircraftModelDefinitionContract["maneuverability"]>,
  _AssertSafeInt<AircraftModelDefinitionContract["toughness"]>,
  _AssertSafeInt<AircraftModelDefinitionContract["payloadCapacity"]>,
  _AssertSafeInt<AircraftModelDefinitionContract["rangeDistance"]>,
  _AssertSafeInt<AircraftModelDefinitionContract["productionWork"]>,
  _AssertSafeInt<AircraftModelDefinitionContract["unitCost"]>,
  _AssertSafeInt<AircraftModelDefinitionContract["maintenanceRequirement"]>,
  _AssertSafeInt<AircraftModelDefinitionContract["crewRequirement"]>,
] = [true, true, true, true, true, true, true, true, true, true];

export function validateAircraftModelDefinitionContract(
  value: unknown,
): AircraftModelDefinitionContract {
  return decodeContract(AircraftModelDefinition_v1, INVALID_AIRCRAFT_MODEL_DEFINITION, value);
}

export function makeValidAircraftModelDefinition_v1(): AircraftModelDefinitionContract {
  return {
    aircraftModelId: "aircraft_model_definition_v1",
    aircraftType: AIRCRAFT_TYPES[0],
    ownerOrLicenseHolder: "contract_witness",
    introductionMonth: "0000-01",
    speed: SafeInt(0),
    firepower: SafeInt(0),
    maneuverability: SafeInt(0),
    toughness: SafeInt(0),
    payloadCapacity: SafeInt(0),
    rangeClass: "contract_witness",
    rangeDistance: SafeInt(0),
    eligibleRoleIds: ["contract_witness"],
    basingRequirementId: AIRCRAFT_BASING_CLASSES[0],
    carrierSuitable: false,
    technologyPrerequisiteIds: [],
    productionWork: SafeInt(0),
    unitCost: SafeInt(0),
    maintenanceRequirement: SafeInt(0),
    crewRequirement: SafeInt(0),
    contentVersion: "aircraft_model_definition_v1",
    contentHash: "contract_witness",
  };
}

export const SHIPPED_AIRCRAFT_CONTRACT = {
  modelDefinition: AircraftModelDefinition_v1,
} as const;
