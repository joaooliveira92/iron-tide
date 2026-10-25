import type { SafeInt } from "@bluewave/contracts";
import type { IssuerClass } from "./types.js";
export interface CommandEnvelope<TBody> {
  commandId: string;
  version: string;
  expectedSnapshotHash: string;
  idempotencyKey: string;
  timestamp: string;
  body: TBody;
  signature?: string;
  issuerClass?: IssuerClass;
  issuerParticipantId?: string;
}
export type CommandBody =
  | BudgetProjectCommand
  | OrderConstructionCommand
  | OrderForeignConstructionCommand
  | AuthorizeDockExpansionCommand
  | HaltConstructionCommand
  | ResumeConstructionCommand
  | SetAccelerationCommand
  | CancelConstructionProjectCommand
  | SetResearchPriorityCommand
  | SetBudgetAllocationCommand
  | MoveFleetCommand
  | SubmitDesignCommand
  | ReviseProjectCommand
  | StartRebuildCommand
  | AssignOfficerCommand
  | RelieveOfficerCommand
  | DeclareWarCommand
  | AcceptPeaceCommand
  | FormAllianceCommand
  | BreakAllianceCommand
  | FormNonAggressionPactCommand
  | BreakNonAggressionPactCommand
  | DeclareBlockadeCommand
  | CreateDivisionCommand
  | AddShipToDivisionCommand
  | RemoveShipFromDivisionCommand
  | DissolveDivisionCommand
  | ChangeDivisionFlagshipCommand
  | ReorderDivisionShipsCommand
  | ChangeDivisionDoctrineCommand
  | AssignForeignStationCommand
  | ClearForeignStationCommand
  | SetShipReadinessCommand
  | SetSpecialTrainingCommand;
export interface BudgetProjectCommand {
  type: "budget_project";
  nationId: string;
  projectId: string;
  budget: SafeInt;
}
export interface OrderConstructionCommand {
  type: "OrderConstruction";
  nationId: string;
  designVersionId: string;
  quantity: number;
}
export interface AuthorizeDockExpansionCommand {
  type: "AuthorizeDockExpansion";
  nationId: string;
  possessionId: string;
}
export interface OrderForeignConstructionCommand {
  type: "OrderForeignConstruction";
  nationId: string;
  designVersionId: string;
  builderNationId: string;
  quantity: number;
  plannedDeliveryMonth?: string;
}
export interface HaltConstructionCommand {
  type: "HaltConstruction";
  nationId: string;
  projectId: string;
}
export interface ResumeConstructionCommand {
  type: "ResumeConstruction";
  nationId: string;
  projectId: string;
}
export interface SetAccelerationCommand {
  type: "SetAcceleration";
  nationId: string;
  projectId: string;
  accelerated: boolean;
}
export interface CancelConstructionProjectCommand {
  type: "CancelConstructionProject";
  nationId: string;
  projectId: string;
}
export interface SetResearchPriorityCommand {
  type: "SetResearchPriority";
  nationId: string;
  fieldPriorities: Record<string, SafeInt>;
  exactTechId?: string;
}
export interface SetBudgetAllocationCommand {
  type: "SetBudgetAllocation";
  nationId: string;
  appropriationRateBp: SafeInt;
  researchBudget: SafeInt;
}
export interface MoveFleetCommand {
  type: "MoveFleet";
  nationId: string;
  fleetId: string;
  toAreaId: string;
}
export interface SubmitDesignCommand {
  type: "SubmitDesign";
  nationId: string;
  designVersionId: string;
  designFamilyId: string;
  className: string;
  hullType: string;
  machineryType: string;
  draft: unknown;
}
export interface ReviseProjectCommand {
  type: "ReviseProject";
  nationId: string;
  projectId: string;
  newDesignVersionId: string;
  draft: unknown;
}
export interface StartRebuildCommand {
  type: "StartRebuild";
  nationId: string;
  shipId: string;
  projectId: string;
  newDesignVersionId: string;
  rebuildKind?: "BULGE";
  draft: unknown;
}
export interface AssignOfficerCommand {
  type: "AssignOfficer";
  nationId: string;
  officerId: string;
  divisionId: string;
}
export interface RelieveOfficerCommand {
  type: "RelieveOfficer";
  nationId: string;
  divisionId: string;
}
export interface DeclareWarCommand {
  type: "DeclareWar";
  nationId: string;
  targetNationId: string;
  warGoalsId?: string;
}
export interface AcceptPeaceCommand {
  type: "AcceptPeace";
  nationId: string;
  warId: string;
}
export interface FormAllianceCommand {
  type: "FormAlliance";
  nationId: string;
  partnerNationId: string;
}
export interface BreakAllianceCommand {
  type: "BreakAlliance";
  nationId: string;
  partnerNationId: string;
}
export interface FormNonAggressionPactCommand {
  type: "FormNonAggressionPact";
  nationId: string;
  partnerNationId: string;
}
export interface BreakNonAggressionPactCommand {
  type: "BreakNonAggressionPact";
  nationId: string;
  partnerNationId: string;
}
export interface DeclareBlockadeCommand {
  type: "DeclareBlockade";
  nationId: string;
  targetNationId: string;
  areaId: string;
}
export interface CreateDivisionCommand {
  type: "CreateDivision";
  nationId: string;
  divisionId: string;
  shipOrder: string[];
  divisionRole: string;
  preferredFormation: string;
}
export interface AddShipToDivisionCommand {
  type: "AddShipToDivision";
  nationId: string;
  divisionId: string;
  shipId: string;
}
export interface RemoveShipFromDivisionCommand {
  type: "RemoveShipFromDivision";
  nationId: string;
  divisionId: string;
  shipId: string;
}
export interface DissolveDivisionCommand {
  type: "DissolveDivision";
  nationId: string;
  divisionId: string;
}
export interface ChangeDivisionFlagshipCommand {
  type: "ChangeDivisionFlagship";
  nationId: string;
  divisionId: string;
  newFlagshipShipId: string;
}
export interface ReorderDivisionShipsCommand {
  type: "ReorderDivisionShips";
  nationId: string;
  divisionId: string;
  shipOrder: string[];
}
export interface ChangeDivisionDoctrineCommand {
  type: "ChangeDivisionDoctrine";
  nationId: string;
  divisionId: string;
  divisionRole?: string;
  preferredFormation?: string;
}

export interface AssignForeignStationCommand {
  type: "AssignForeignStation";
  nationId: string;
  shipIds: string[];
}
export interface SetShipReadinessCommand {
  type: "SetShipReadiness";
  nationId: string;
  shipIds: string[];
  readiness: "ACTIVE" | "RESERVE" | "MOTHBALLED";
}
export interface SetSpecialTrainingCommand {
  type: "SetSpecialTraining";
  nationId: string;
  subjects: string[];
}
export interface ClearForeignStationCommand {
  type: "ClearForeignStation";
  nationId: string;
  shipIds: string[];
}
