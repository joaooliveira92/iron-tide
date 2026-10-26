import type { SafeInt } from "@bluewave/contracts";
import { createEnvelope } from "@bluewave/deterministic";
import type { AircraftBasingClass, AircraftType } from "./constants.js";
import { validateAircraftModelDefinitionContract } from "./contracts.js";

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
  validateAircraftModelDefinitionContract(def);
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
