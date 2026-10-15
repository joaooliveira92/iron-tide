//packages/combat/src/aircraft/model.ts
// DESIGN-43 §§1-2 aircraft type enum and AircraftModelDefinition.
// INC-1: model types, score guard, basic definition construction.
// Pure/deterministic: no I/O/clock/random.
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { createEnvelope } from "@bluewave/deterministic";
import {
  AIRCRAFT_BASING_CLASSES,
  AIRCRAFT_SCORE_MAX,
  AIRCRAFT_SCORE_MIN,
  AIRCRAFT_TYPES,
  type AircraftBasingClass,
  type AircraftType,
} from "./constants.js";
import { INVALID_AIRCRAFT_MODEL_DEFINITION } from "./reasonCodes.js";

function invalidModel(field: string, reason: string, value: unknown): never {
  throw new BluewaveError(INVALID_AIRCRAFT_MODEL_DEFINITION, {
    code: INVALID_AIRCRAFT_MODEL_DEFINITION,
    field,
    reason,
    value,
  });
}

function isString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

function isSafeInt(v: unknown): v is SafeInt {
  return SafeInt.isSafeInt(v as number);
}

function isScore(v: unknown): v is SafeInt {
  return isSafeInt(v) && Number(v) >= AIRCRAFT_SCORE_MIN && Number(v) <= AIRCRAFT_SCORE_MAX;
}

export interface AircraftModelDefinition {
  aircraftModelId: string;
  aircraftType: AircraftType;
  ownerOrLicenseHolder: string;
  introductionMonth: string;
  speed: SafeInt;
  firepower: SafeInt;
  maneuverability: SafeInt;
  toughness: SafeInt;
  payloadCapacity: SafeInt;
  rangeClass: string;
  rangeDistance: SafeInt;
  eligibleRoleIds: readonly string[];
  basingRequirementId: AircraftBasingClass;
  carrierSuitable: boolean;
  deckRequirement?: string;
  catapultRequirement?: string;
  technologyPrerequisiteIds: readonly string[];
  productionWork: SafeInt;
  unitCost: SafeInt;
  maintenanceRequirement: SafeInt;
  crewRequirement: SafeInt;
  contentVersion: string;
  contentHash: string;
}

export function validateAircraftModelDefinition(def: AircraftModelDefinition): void {
  if (!isString(def.aircraftModelId)) {
    invalidModel("aircraftModelId", "missing or empty", def.aircraftModelId);
  }
  if (!AIRCRAFT_TYPES.includes(def.aircraftType)) {
    invalidModel("aircraftType", "invalid type", def.aircraftType);
  }
  if (!isString(def.ownerOrLicenseHolder)) {
    invalidModel("ownerOrLicenseHolder", "missing or empty", def.ownerOrLicenseHolder);
  }
  if (!isString(def.introductionMonth)) {
    invalidModel("introductionMonth", "missing or empty", def.introductionMonth);
  }
  for (const field of ["speed", "firepower", "maneuverability", "toughness"] as const) {
    const v = def[field];
    if (!isScore(v)) {
      invalidModel(field, `out of range ${AIRCRAFT_SCORE_MIN}..${AIRCRAFT_SCORE_MAX}`, v);
    }
  }
  if (!isSafeInt(def.payloadCapacity)) {
    invalidModel("payloadCapacity", "not a SafeInt", def.payloadCapacity);
  }
  if (!isString(def.rangeClass)) {
    invalidModel("rangeClass", "missing or empty", def.rangeClass);
  }
  if (!isSafeInt(def.rangeDistance)) {
    invalidModel("rangeDistance", "not a SafeInt", def.rangeDistance);
  }
  if (!Array.isArray(def.eligibleRoleIds) || def.eligibleRoleIds.length === 0) {
    invalidModel("eligibleRoleIds", "missing or empty", def.eligibleRoleIds);
  }
  if (!AIRCRAFT_BASING_CLASSES.includes(def.basingRequirementId)) {
    invalidModel("basingRequirementId", "invalid basing class", def.basingRequirementId);
  }
  if (typeof def.carrierSuitable !== "boolean") {
    invalidModel("carrierSuitable", "not a boolean", def.carrierSuitable);
  }
  if (!Array.isArray(def.technologyPrerequisiteIds)) {
    invalidModel("technologyPrerequisiteIds", "not an array", def.technologyPrerequisiteIds);
  }
  if (!isSafeInt(def.productionWork)) {
    invalidModel("productionWork", "not a SafeInt", def.productionWork);
  }
  if (!isSafeInt(def.unitCost)) {
    invalidModel("unitCost", "not a SafeInt", def.unitCost);
  }
  if (!isSafeInt(def.maintenanceRequirement)) {
    invalidModel("maintenanceRequirement", "not a SafeInt", def.maintenanceRequirement);
  }
  if (!isSafeInt(def.crewRequirement)) {
    invalidModel("crewRequirement", "not a SafeInt", def.crewRequirement);
  }
  if (!isString(def.contentVersion)) {
    invalidModel("contentVersion", "missing or empty", def.contentVersion);
  }
  if (!isString(def.contentHash)) {
    invalidModel("contentHash", "missing or empty", def.contentHash);
  }
}

export function withAircraftModelDefinitionContentHash(
  def: Omit<AircraftModelDefinition, "contentHash">,
): AircraftModelDefinition {
  const { contentVersion, ...rest } = def;
  const envelope = createEnvelope("aircraft-model-definition", contentVersion, rest);
  return { ...def, contentHash: envelope.bodyHash };
}

export function verifyAircraftModelDefinitionContentHash(def: AircraftModelDefinition): boolean {
  const { contentHash, contentVersion, ...rest } = def;
  const envelope = createEnvelope("aircraft-model-definition", contentVersion, rest);
  return envelope.bodyHash === contentHash;
}
