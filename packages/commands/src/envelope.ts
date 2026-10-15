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
  | ReorderDivisionShipsCommand;
export interface BudgetProjectCommand {
  type: "budget_project";
  nationId: string;
  projectId: string;
  budget: SafeInt;
}
/**
 * Orders a class batch of `1..12` ships of one approved compiled design version (DESIGN-23 sections 3-5, SB3-R11..R14;
 * RTW3 manual p. 31 "up to 12 ships of the same class laid down"). The engine applies the whole batch through
 * `placeConstructionBatch`: one authorization, one capacity reservation for the whole batch, deterministic automatic
 * names and one `batchId`/`namedClassId`. A quantity above 12 is refused with `CONSTRUCTION_BATCH_LIMIT_EXCEEDED`; a
 * second batch needs a second command.
 */
export interface OrderConstructionCommand {
  type: "OrderConstruction";
  nationId: string;
  designVersionId: string;
  /** Ship count, an integer in `1..12`. */
  quantity: number;
}
/**
 * Authorizes a twelve-month dock expansion for one possession (DESIGN-16 sections 5-6, SB3-R16; RTW3 manual pp. 32-33).
 * The engine locks the applicable era step at the current campaign month and creates a normal `INFRASTRUCTURE`
 * project; it never raises the dock until the project completes through the ordinary work pipeline.
 */
export interface AuthorizeDockExpansionCommand {
  type: "AuthorizeDockExpansion";
  nationId: string;
  possessionId: string;
}
/**
 * Orders a ship from a foreign builder (DESIGN-16 sections 13.1-13.4, SB3-R20..R22). The body carries only the player's
 * choices: the ordering nation, the compiled design version, the builder nation, the quantity and an optional delivery
 * month. The engine derives the contract `terms` (price from the builder's content-grounded construction cost, a
 * versioned instalment schedule) and the builder `capability` predicates server-side, then applies the whole order
 * through `placeForeignConstructionOrder`. A body that still carries `terms`/`capability` is refused with
 * `FOREIGN_CONTRACT_TERMS_NOT_ACCEPTED` — a fabricated contract is never accepted.
 */
export interface OrderForeignConstructionCommand {
  type: "OrderForeignConstruction";
  nationId: string;
  designVersionId: string;
  builderNationId: string;
  /** Ship count, an integer in `1..12`. */
  quantity: number;
  /** The player's requested delivery month (`YYYY-MM`); the engine derives a default when absent or invalid. */
  plannedDeliveryMonth?: string;
}
/**
 * Halts a dockyard project that is under construction (DESIGN-23 section 7, RTW3 manual pp. 30-31). A halted project
 * receives zero work and zero ordinary work charge and pays the preservation cost (half the mothballed maintenance)
 * each month until it is resumed. The command only names the project; the status change goes through the shared
 * transition table.
 */
export interface HaltConstructionCommand {
  type: "HaltConstruction";
  nationId: string;
  projectId: string;
}
/**
 * Resumes a halted or delayed dockyard project (DESIGN-23 section 7). The project returns to `ACTIVE`, or to
 * `AWAITING_CAPACITY` when the design carries no usable construction capacity.
 */
export interface ResumeConstructionCommand {
  type: "ResumeConstruction";
  nationId: string;
  projectId: string;
}
/**
 * Toggles engine-side construction acceleration for a dockyard project (DESIGN-23 section 8; DESIGN-13 section
 * 11.3; RTW3 manual p. 31: 10% faster, +5% cost). Enabling applies the one-time remaining-work premium exactly once
 * per remaining-work segment; the status only moves `ACTIVE` <-> `ACCELERATED`, through the shared transition table.
 * `accelerated` is explicit rather than a blind toggle so a repeated command is idempotent.
 */
export interface SetAccelerationCommand {
  type: "SetAcceleration";
  nationId: string;
  projectId: string;
  accelerated: boolean;
}
/**
 * Cancels a dockyard project and settles the work already done (DESIGN-23 section 23; DESIGN-11 settlement contract).
 * Cancelling stops future work and releases future capacity; work already completed (and paid) is consumed and is not
 * refunded, and no physical work is silently restored. A `REBUILD`'s target ship is released from its project
 * unavailability (custody resolved), keeping its old compiled design version; no ship is ever spawned. The cancellation
 * record is a `ConstructionProjectCancelled` domain event carrying the explicit consumed/refunded/lost/salvageable
 * settlement. A terminal project, a project that is not the nation's, or a foreign-contract project (whose cancellation
 * is a contract outcome) is refused and changes nothing.
 */
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
  /** Naval appropriation rate in basis points (ADR-0060 bounds). */
  appropriationRateBp: SafeInt;
  /** Standing monthly research budget (ADR-0060 bounds). */
  researchBudget: SafeInt;
}
export interface MoveFleetCommand {
  type: "MoveFleet";
  nationId: string;
  fleetId: string;
  toAreaId: string;
}
/**
 * Submits a component-level ship design (ADR-0066). `draft` is a `@bluewave/ship-design` DesignDraft as JSON; the
 * lifecycle only checks its shape and ids, the authoritative compile happens when the month applies the command.
 */
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
/**
 * Revises a construction project with a changed design (ADR-0070). `draft` is the whole new DesignDraft; the project's
 * current design must carry its source draft. The change is classified from the two drafts and the project's work
 * (spec 15.4) when the month applies the command: a free change or revision swaps the design, a redesign also
 * loses hull progress, and a change past the redesign window is refused (it needs a rebuild project).
 */
export interface ReviseProjectCommand {
  type: "ReviseProject";
  nationId: string;
  projectId: string;
  /** Id of the new design version; the project's family gains this member. */
  newDesignVersionId: string;
  draft: unknown;
}
/**
 * Starts a rebuild of a completed ship with a changed design (ADR-0078, DESIGN-23 sections 17-22). `draft` is the whole new
 * DesignDraft; the ship's current design must carry its source draft. The rebuild is validated against the retained-hull
 * limits when the month applies the command; if it is legal the ship is unavailable for the whole project and `projectId`
 * is the new construction project that does the work. A refused rebuild changes nothing.
 */
export interface StartRebuildCommand {
  type: "StartRebuild";
  nationId: string;
  shipId: string;
  /** Id of the new REBUILD project. */
  projectId: string;
  /** Id of the new design version the ship becomes when the rebuild completes. */
  newDesignVersionId: string;
  /**
   * The rebuild action chosen. `BULGE` is the manual's "add bulges" rebuild (ADR-0130, SB3-R25); it
   * must grow the hull by the blister's mass, else `REBUILD_BULGE_REQUIRED`. Absent for a standard
   * rebuild. The armament-change conditions (SB3-R26) apply to every rebuild that changes guns.
   */
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
/**
 * Permutes a division's canonical ship order without changing the flagship
 * (DESIGN-26 §8/§12). `shipOrder` MUST be a permutation of the current members
 * with the flagship first; the engine applies the `reorderWithoutFlagship`
 * cohesion penalty. Moving a different ship to the lead is a flagship change and
 * belongs to `ChangeDivisionFlagshipCommand`.
 */
export interface ReorderDivisionShipsCommand {
  type: "ReorderDivisionShips";
  nationId: string;
  divisionId: string;
  shipOrder: string[];
}
