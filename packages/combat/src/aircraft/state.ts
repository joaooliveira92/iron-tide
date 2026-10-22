import { SafeInt } from "@bluewave/contracts";
import { createEnvelope } from "@bluewave/deterministic";
import {
  AIRCRAFT_RULESET_VERSION,
  type AircraftType,
  type AircraftInventoryState,
  type AircraftProjectStatus,
  type SquadronReequipmentState,
} from "./constants.js";
import type { AircraftModelDefinition } from "./model.js";

export interface AircraftNationState {
  models: Record<string, AircraftModelDefinition>;
  inventory: Record<string, Record<AircraftInventoryState, SafeInt>>;
  developmentProjects: AircraftDevelopmentProject[];
  proposals: AircraftProposal[];
  privateProposals: AircraftProposal[];
  squadrons: SquadronState[];
  basingAllocations: BasingSlot[];
  rulesetVersion: string;
  stateHash: string;
}

export interface AircraftDevelopmentProject {
  developmentProjectId: string;
  requestedRole: AircraftType;
  emphasizedTraits: [string, string];
  basingClass: string;
  startMonth: string;
  requiredDevelopmentMonths: SafeInt;
  completedPaidMonths: SafeInt;
  monthlyCost: SafeInt;
  technologyInputHash: string;
  nationalTraitInputHash: string;
  designStreamKey: string;
  status: AircraftProjectStatus;
  finalProposalId: string | null;
  rulesetVersion: string;
  formulaVersion: string;
  projectHash: string;
}

export interface AircraftProposal {
  proposalId: string;
  sourceProjectId: string;
  proposedModel: AircraftModelDefinition;
  requestedRole: AircraftType;
  emphasizedTraits: [string, string];
  developmentDurationMonths: SafeInt;
  developmentCost: SafeInt;
  productionCost: SafeInt;
  productionWork: SafeInt;
  estimatedPerformance: Record<string, SafeInt>;
  expiryMonth: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRED";
  rulesetVersion: string;
  formulaVersion: string;
  proposalHash: string;
}

export interface SquadronState {
  squadronId: string;
  ownerNationId: string;
  squadronRole: AircraftType;
  assignedModelId: string | null;
  authorizedStrength: SafeInt;
  operationalAircraftCount: SafeInt;
  damagedAircraftCount: SafeInt;
  replacementAircraftReserved: SafeInt;
  pilotCount: SafeInt;
  squadronExperience: SafeInt;
  fatigue: SafeInt;
  trainingState: string;
  baseOrCarrierId: string;
  reequipmentState: SquadronReequipmentState;
  expansionState: string;
  missionAvailability: string[];
  rulesetVersion: string;
  stateHash: string;
}

export interface BasingSlot {
  slotId: string;
  hostId: string;
  aircraftModelId: string;
  squadronId: string | null;
  condition: AircraftInventoryState;
  allocatedAt: string;
}

export interface AircraftInventoryRecord {
  modelId: string;
  conditionCounts: Record<AircraftInventoryState, SafeInt>;
  inventoryHash: string;
}

export function withAircraftInventoryRecordHash(
  record: AircraftInventoryRecord,
): AircraftInventoryRecord {
  const { inventoryHash: _inventoryHash, ...rest } = record;
  const envelope = createEnvelope("aircraft-inventory-record", AIRCRAFT_RULESET_VERSION, rest);
  return { ...record, inventoryHash: envelope.bodyHash };
}

export function verifyAircraftInventoryRecordHash(record: AircraftInventoryRecord): boolean {
  const { inventoryHash, ...rest } = record;
  const envelope = createEnvelope("aircraft-inventory-record", AIRCRAFT_RULESET_VERSION, rest);
  return envelope.bodyHash === inventoryHash;
}
