import { BluewaveError } from "@bluewave/contracts";
import type { SafeInt } from "@bluewave/contracts";
import { Result, Schema } from "effect";
import { formatContractIssues } from "../schema-issues.js";
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
  const result = Schema.decodeUnknownResult(AircraftModelDefinition_v1)(value);
  if (Result.isFailure(result)) {
    const first = formatContractIssues(result.failure)[0];
    throw new BluewaveError(INVALID_AIRCRAFT_MODEL_DEFINITION, {
      code: INVALID_AIRCRAFT_MODEL_DEFINITION,
      field: first?.path ?? "unknown",
      reason: first?.message ?? "contract validation failed",
      value,
    });
  }
  return result.success;
}

export const SHIPPED_AIRCRAFT_CONTRACT = {
  modelDefinition: AircraftModelDefinition_v1,
} as const;
