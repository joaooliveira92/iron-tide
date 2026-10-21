import type { Bp, Money, SafeInt } from "@bluewave/contracts";
import type { PrestigeValueSet } from "./prestige.js";
import type { CompiledArmamentMount, CompiledTorpedo } from "@bluewave/armament";
import type { CanonicalEnvelope } from "@bluewave/deterministic";
import type { PermanentDivision } from "./division.js";
import type { Officer } from "./officers.js";
import type { ConstructionProjectStatus } from "./constructionStatus.js";
import type { ShipReadinessState } from "./readiness.js";
import type { StationAssignment } from "./stationAssignment.js";

/**
 * Operational availability of a ship while a project works on it (DESIGN-23 section 20). Absent means AVAILABLE. An
 * UNAVAILABLE ship must not move, train, hold a foreign station or enter battle generation; DEGRADED is reserved for repair
 * policies that permit limited operation.
 */
export type ShipAvailability = "DEGRADED" | "UNAVAILABLE";

export interface Ship {
  id: string;
  name: string;
  classId: string;
  nationId: string;
  locationAreaId: string;
  designVersionId: string;
  hitPoints: SafeInt;
  maxHitPoints: SafeInt;
  speed: SafeInt;
  firepower: SafeInt;
  armor: SafeInt;
  isUnderConstruction: boolean;
  constructionProgress: SafeInt;
  constructionTotalWork: SafeInt;
  /** Readiness state (S-1 D2): required on every ship, derived at compile, player-settable. */
  readiness: ShipReadinessState;
  /** Worked-up crew quality `0..100` (S-1 D2/D4); ramps toward the state's ceiling. */
  crewQuality: SafeInt;
  /**
   * Remaining repair months while `readiness` is `REPAIR` (manual p.48: "a number
   * means the ship is in repair for that number of months"). Absent on every other
   * state; a laid-up (mothballed) ship keeps it but its countdown halts (p.51).
   */
  repairMonthsRemaining?: SafeInt;
  /**
   * S-5 station assignment (spec #73 R1), orthogonal to `readiness`: a ship with it is ACTIVE. Absent = none. Any
   * readiness change away from ACTIVE clears it through `setShipReadiness`.
   */
  stationAssignment?: StationAssignment;
  /**
   * S-5 (spec #73 R4): the ship's design is fitted for colonial service (manual p.42), copied from its design version when
   * the hull launches and updated by a rebuild. Absent = unfitted. Shown as `c` (manual p.48).
   */
  colonialServiceFitted?: true;
  inBattleId?: string;
  /** Operational availability while a rebuild or conversion works on the ship; absent = available (ADR-0078). */
  availability?: ShipAvailability;
  /** The project that made the ship unavailable, while it is. */
  availabilityProjectId?: string;
}

/**
 * Whether a ship can act in the campaign: commissioned and not made unavailable by a rebuild or conversion. The one test
 * used wherever a ship would move, train or enter battle generation.
 */
export function isShipOperational(
  ship: Pick<Ship, "isUnderConstruction" | "availability">,
): boolean {
  return !ship.isUnderConstruction && ship.availability !== "UNAVAILABLE";
}

export interface FleetState {
  id: string;
  nationId: string;
  name: string;
  ships: Ship[];
  locationAreaId: string;
}

export interface TechnologyProgress {
  techId: string;
  investedPoints: SafeInt;
  completed: boolean;
}

export interface ResearchState {
  nationId: string;
  technologies: TechnologyProgress[];
  currentProjectTechId?: string;
  fieldPriorities: Record<string, SafeInt>;
  researchBudget: SafeInt;
  /** Player-set monthly research budget that refills `researchBudget` each month (ADR-0060). */
  standingResearchBudget?: SafeInt;
  /** The authored annual research allocation the compiler derived the standing monthly spend from (spec #138); display only. */
  annualResearchAllocation?: SafeInt;
  activeCandidates: Map<string, string>;
  discoveredTechs: string[];
}

export interface CompiledDesignVersion {
  designVersionId: string;
  designFamilyId: string;
  className: string;
  nationId: string;
  hullType: string;
  normalizedDisplacementKg: SafeInt;
  normalizedSpeedUms: SafeInt;
  normalizedArmorUm: SafeInt;
  hitPoints: SafeInt;
  mainGunsCaliber: SafeInt;
  mainGunsCount: SafeInt;
  machineryType: string;
  crewComplement: SafeInt;
  contentVersion: string;
  compiledHash: string;
  /**
   * The immutable compiled armament identity of every installed gun placement (ADR-0093 Step 4). Produced
   * from `ResolvedArmament` at compile time and persisted so combat behaviour cannot change when external
   * armament content is edited later. Absent for legacy/authored designs, which project through the
   * documented compatibility path.
   */
  armament?: readonly CompiledArmamentMount[];
  /** P-1: as-built torpedo mounts (absent = no torpedo armament). */
  torpedoArmament?: readonly CompiledTorpedoMount[];
  /**
   * The ship-design draft this version was compiled from (ADR-0070), as plain JSON. Only designs submitted through
   * `SubmitDesign` carry one; authored pack designs have none. It lets a later revision start from the real design.
   */
  sourceDraft?: Readonly<Record<string, unknown>>;
  /** S-5 (spec #73 R4): fitted for colonial service (manual p.42). Absent = unfitted; written only when fitted. */
  colonialServiceFitted?: true;
  /**
   * S-5 (spec #73 R5): the design has cramped accommodation (manual p.46), so its ships count for less toward presence.
   * Absent = not cramped. Nothing writes it yet: the classification is gated (decision request 0026).
   */
  crampedAccommodation?: true;
  /** S-5 (spec #73 R5): the design has short range (manual p.46). Absent = not short-range; gated like the above. */
  shortRange?: true;
  /**
   * Cost of building this design in treasury units, priced by the ship-design cost model when the design was compiled
   * (ADR-0074). Absent for authored designs, which fall back to the displacement formula `construction_order_v1`.
   */
  constructionCostUnits?: SafeInt;
  /** Work packages, yard and yard capacity for building this design (ADR-0077); absent when no yard can build it. */
  constructionPlan?: ConstructionPlanRecord;
}

/** One package of a design's construction plan, in the design's treasury units (ADR-0077). */
export interface ConstructionPlanShare {
  id: string;
  kind: ConstructionPackageKind;
  line: string;
  totalWork: SafeInt;
  dependsOn: string[];
}

/**
 * How a design is built (ADR-0077): its work packages scaled to `constructionCostUnits`, the yard that builds it and that
 * yard's monthly capacity per production line in the same units. Fixed when the design is compiled, so the engine never
 * needs the design or the content to advance a project.
 */
export interface ConstructionPlanRecord {
  yardId: string;
  packages: ConstructionPlanShare[];
  capacityUnits: Record<string, SafeInt>;
}

export interface CompiledTorpedoMount {
  mountType: string;
  tubeCount: SafeInt;
  torpedoModelId: string;
  /** The neutral compiled torpedo contract, when the compile resolved the parts read path (ticket 13b). */
  compiledTorpedo?: CompiledTorpedo;
}

export interface DesignFamily {
  designFamilyId: string;
  nationId: string;
  rootDesignVersionId: string;
  memberDesignVersionIds: string[];
  familyCreationMonth: string;
}

export interface DiplomaticRelation {
  nationA: string;
  nationB: string;
  relation: "neutral" | "allied" | "at_war" | "trade_agreement";
  tension: number; // 0..10
  nap: boolean; // non-aggression pact active
  since: string;
}

export interface PoliticalState {
  relations: DiplomaticRelation[];
  shells: Record<string, unknown>;
}

export interface BattleInstance {
  id: string;
  phase: "pending" | "resolving" | "resolved";
  attackerId: string;
  defenderId: string;
  areaId: string;
  attackerFleetIds: string[];
  defenderFleetIds: string[];
  manifestHash?: string;
  result?: BattleResult;
}

/** A ship lost in battle, recorded before the engine removes it from its fleet (ADR-0061). */
export interface LostShipRecord {
  shipId: string;
  name: string;
  classId: string;
  nationId: string;
  /** Campaign month the battle resolved in. */
  month: string;
  /** Observational cause from the tactical report (ADR-0052); absent for the legacy path. */
  cause?: string;
}

export interface BattleResult {
  // B-6 INC-3/ADR-0026 §7: a tie / time-limit battle ends with BOTH null
  // (neither side eliminated) — such a battle contributes no war score, no
  // victory class, and no contribution delta, but still records ship damage/
  // loss and the battle result. Decided battles always carry both ids (the M1
  // BattleResolver always decides; the auto-resolution path only records a
  // null pair for a §32 non-decided end).
  winnerId: string | null;
  loserId: string | null;
  attackerLosses: string[];
  defenderLosses: string[];
  damageReport: Record<string, SafeInt>;
  explanation: string[];
  /** Details of every ship lost; absent when none were lost or for pre-ADR-0061 saves. */
  lostShips?: LostShipRecord[];
}

export interface BattleManifestSide {
  sideId: string;
  participantIds: string[];
}

// Canonical battle manifest stored on the snapshot (populated by the
// battle_generation phase). Structurally defined here so campaign stays
// dependency-free; @bluewave/combat produces it via generation/manifest.ts.
export interface BattleManifest {
  battleId: string;
  opportunityId: string;
  warId: string;
  areaId: string;
  missionType: string;
  attackerId: string;
  defenderId: string;
  acceptanceClass: string;
  missionObjectives: string[];
  sides: BattleManifestSide[];
  persistentAssets: string[];
  temporaryAssets: string[];
  permanentDivisionIds: string[];
  tacticalDivisions: unknown[];
  commanders: string[];
  weather: string;
  seaState: string;
  visibility: string;
  environment: string;
  sourceStateHashes: Record<string, string>;
  reservations: string[];
  autoResolutionProof: string;
  provenanceRecords: string[];
  battleSeed: string;
  rulesetVersion: string;
  formulaVersion: string;
  aiPolicyVersion: string;
  rngVersion: string;
  contentVersion: string;
  manifestHash: string;
}

export interface WarState {
  wars: WarDeclaration[];
  battles: BattleInstance[];
  participantMemberships: WarParticipantMembership[];
  blockadeState: BlockadeState[];
  battleManifests: BattleManifest[];
}

export interface WarDeclaration {
  id: string;
  attackerSideId: string;
  defenderSideId: string;
  attackerSideMembers: string[]; // nation ids, includes attackerId first
  defenderSideMembers: string[]; // includes defenderId
  attackerWarScore: number; // -100..100
  defenderWarScore: number;
  attackerId: string; // root primary attacker
  defenderId: string; // root primary defender
  startDate: string;
  status: "DECLARED_NOT_ACTIVE" | "ACTIVE" | "ENDED";
  endDate?: string;
}

export interface WarParticipantMembership {
  warId: string;
  nationId: string;
  sideId: string;
  entryMonth: string;
  exitMonth?: string;
  status: "ACTIVE" | "EXITED";
  nationalContributionPoints: number;
}

export interface BlockadeState {
  blockaderId: string;
  blockadedNationId: string;
  areaId: string;
  establishedMonth: string;
}

/**
 * A nation's dock limits (DESIGN-16 section 4, ADR-0135): the four mass ceilings, materialised from the naval profile
 * when a campaign starts and mutated by dock expansion. Plain numbers keep campaign state free of ship-design types.
 */
export interface NationDockState {
  maximumNewConstructionMassKg: number;
  maximumMajorRepairMassKg: number;
  maximumRebuildMassKg: number;
  maximumConversionMassKg: number;
}

/** One explicit monthly dock-utilisation record (DESIGN-16 section 6; SB3-R17), in basis points `0..10_000`. */
export interface DockUtilizationMonth {
  /** Campaign month id (`YYYY-MM`). */
  month: string;
  utilizationBp: number;
}

/**
 * DESIGN-16 section 6 (SB3-R17): one possession's explicit eligibility for the private dock-expansion event. A
 * possession with no entry — or one marked `eligible: false` — receives no inferred private development. The
 * utilisation history is authored/recorded explicitly, never derived from ship names or UI categories.
 */
export interface PossessionDockExpansionEligibility {
  possessionId: string;
  eligible: boolean;
  /** Ascending monthly utilisation records; the trailing-12-month window is read from these. */
  utilization: DockUtilizationMonth[];
}

/**
 * The private dock-expansion event state DESIGN-16 section 6 requires a nation to carry: explicit per-possession
 * eligibility and the month of the last opportunity event (for the `60`-month cooldown). "At most one active event per
 * nation" is enforced by the engine against the nation's in-flight expansion projects, so it is not duplicated here.
 */
export interface NationDockExpansionState {
  possessions: PossessionDockExpansionEligibility[];
  /** Campaign month id of the last fired private opportunity, or absent when none has fired. */
  lastOpportunityMonth?: string;
}

/**
 * DESIGN-16 section 13.4: one scheduled instalment of a foreign construction contract, in the contract's currency
 * unit. `workShareBp` is the share of total work the instalment unlocks (basis points `0..10_000`); the shipped
 * schedule splits work evenly across instalments, but the type does not require it.
 */
export interface ForeignContractPaymentInstallment {
  /** Campaign month id (`YYYY-MM`) the instalment is due. */
  dueMonth: string;
  /** Instalment amount in the contract's currency unit. */
  amountUnits: Money;
  /** Fraction of the contract's total work this instalment unlocks, basis points `0..10_000`. */
  workShareBp: Bp;
}

/**
 * DESIGN-16 section 13.3: one reservation a foreign contract makes against the BUILDER's construction capacity. The
 * shipped schedule places the contract's whole reservation in one entry at the authorization month; the type allows a
 * genuine per-month schedule.
 */
export interface ForeignContractCapacityReservation {
  /** Campaign month id (`YYYY-MM`) the reservation begins. */
  month: string;
  /** Reserved displacement in kilograms. */
  reservedMassKg: number;
  /** The construction pool the reservation competes in (`NEW_CONSTRUCTION`). */
  pool: string;
}

/**
 * DESIGN-16 section 13.1: the immutable contract every foreign construction order MUST create. Plain values only, so
 * campaign state keeps no dependency on the ship-design package; the contract hash binds every field and is computed
 * once, at order time, through `@bluewave/deterministic` (phase-engine's `buildForeignConstructionContract`).
 */
export interface ForeignConstructionContract {
  contractId: string;
  /** The nation that ordered and pays for the ship. */
  orderingNationId: string;
  /** The nation whose yard builds the ship; its capacity is consumed (section 13.3). */
  builderNationId: string;
  builderShipyardId: string;
  /** The compiled design version being built. */
  designVersionId: string;
  quantity: number;
  /** Total work per unit, in the project's work micro-units. */
  totalWorkPerUnit: number;
  /** Total price across all units, in `currencyUnit`. */
  totalPriceUnits: Money;
  currencyUnit: string;
  paymentSchedule: ForeignContractPaymentInstallment[];
  capacityReservationSchedule: ForeignContractCapacityReservation[];
  authorizationMonth: string;
  plannedKeelMonth: string;
  plannedDeliveryMonth: string;
  /** Hash of the builder-capability snapshot the contract was accepted against (section 13.2). */
  builderCapabilitySnapshotHash: string;
  /** `foreign_construction_insight_v1` or `NONE` (section 13.5; INC-11 implements the effect). */
  technologyTransferPolicyId: string;
  /** `foreign_contract_war_policy_v1` (section 13.6; INC-10 implements the outcomes). */
  warDelayPolicyId: string;
  /** Impoundment policy identifier (section 13.7; INC-10). */
  impoundmentPolicyId: string;
  /** Delivery-guarantee clause identifier, or `NONE` (section 14; INC-10). */
  deliveryGuaranteeClauseId: string;
  /** Occupation/destruction policy identifier (section 13.2/13.6). */
  occupationDestructionPolicyId: string;
  /** Cancellation and refund policy identifier (section 13.4). */
  cancellationRefundPolicyId: string;
  governingTreatyIds: string[];
  rulesetVersion: string;
  formulaVersion: string;
  /** sha256 of the canonical serialization of every other field. */
  contractHash: string;
}

/**
 * DESIGN-16 section 13.4: the payment ledger state the engine keeps for one foreign contract — the campaign months
 * (`YYYY-MM`) of its instalments already paid. It is what lets a payment one month clear an earlier default and stops
 * the schedule being charged twice. Plain values only; absent until an instalment is paid, so the field never perturbs
 * existing save hashes.
 */
export interface ForeignContractPaymentRecord {
  contractId: string;
  /** Due months paid so far, ascending. Matched exactly against the contract's schedule. */
  paidDueMonths: string[];
}

/**
 * DESIGN-16 section 13.5 / SB3-R24: the insight a foreign construction contract has already transferred to the
 * ordering nation. It is what stops a milestone being awarded twice and what enforces the per-family and
 * per-contract `3_000` micro-point cap. Plain values only; absent until the first award, so the field never
 * perturbs an existing save hash.
 */
export interface ForeignInsightAwardRecord {
  contractId: string;
  /** Milestones already awarded, in canonical milestone order (`DESIGN_STUDY`, `CONSTRUCTION_OBSERVATION`, `DELIVERY`). */
  milestones: string[];
  /** Total research micro-points awarded per technology family, ascending by family id. */
  awardedByFamily: Record<string, number>;
}

/**
 * DESIGN-16 sections 13.6-13.7 / SB3-R23: the causal record of one authorised foreign-contract impoundment. A valid
 * impoundment transfers custody of the incomplete or completed asset to the builder or controlling authority, and MUST
 * record the authorizing predicate, custody, legal title, paid and unpaid amounts, compensation or forfeiture, the
 * project status, and whether the hull remains eligible for future delivery. Plain values only; absent until the first
 * impoundment, so the field never perturbs an existing save hash.
 */
export interface ForeignContractImpoundmentRecord {
  contractId: string;
  /** The authorizing policy predicate (`foreign_contract_war_policy_v1:<OUTCOME>`). */
  authorizingPredicate: string;
  /** The nation holding custody of the asset after impoundment. */
  custodyNationId: string;
  /** Who holds legal title after impoundment (impoundment does not silently transfer title). */
  legalTitle: "ORDERING_NATION" | "BUILDER" | "CONTROLLING_AUTHORITY";
  paidAmountUnits: number;
  unpaidAmountUnits: number;
  compensationOrForfeiture: "COMPENSATION" | "FORFEITURE" | "NONE";
  /** The project status the impoundment set (`IMPOUNDED`). */
  projectStatus: string;
  /** Whether the hull remains eligible for delivery to the ordering nation if the dispute resolves. */
  futureDeliveryEligible: boolean;
  /** The campaign month the impoundment was recorded (`YYYY-MM`). */
  month: string;
}

export interface NationState {
  id: string;
  name: string;
  tag: string;
  treasury: SafeInt;
  income: SafeInt;
  expenses: SafeInt;
  baseResources: SafeInt;
  navalAppropriationRateBp: SafeInt;
  maintenanceCost: SafeInt;
  /**
   * The nation's prestige (S-2, ADR-0239): a plain integer within the ruleset's declared bounds,
   * seeded per nation from authored content with no default. Required, never optional or derived.
   */
  prestige: SafeInt;
  /**
   * The nation's home area (S-5, spec #73 R3): authoritative content, validated against the area set. Absent in
   * saves from earlier builds.
   */
  homeAreaId?: string;
  fleets: FleetState[];
  divisions: PermanentDivision[];
  /** The nation's officer corps (ADR-0065); absent in saves from earlier builds. */
  officers?: Officer[];
  research: ResearchState;
  constructionProjects: ConstructionProject[];
  /**
   * The nation's dock limits (DESIGN-16 section 4, ADR-0135). Absent until materialised; once present it overrides
   * the content-derived dock, and dock expansion mutates it. Kept as plain numbers so campaign state has no
   * dependency on the ship-design package.
   */
  dock?: NationDockState;
  /**
   * The private dock-expansion event state (DESIGN-16 section 6, SB3-R17). Absent until content explicitly declares
   * eligibility, so an un-authored nation receives no inferred private development and the field never perturbs
   * existing save hashes.
   */
  dockExpansion?: NationDockExpansionState;
  /** Design studies (DESIGN-21 section 3, ADR-0085); absent until the nation submits its first design. */
  designStudies?: DesignStudy[];
  /** The nation's persisted AI procurement lifecycle (ADR-0091); absent until an AI nation plans its first order. */
  procurementIntents?: ProcurementIntent[];
  /**
   * The foreign construction contracts this nation has ORDERED (DESIGN-16 section 13.1). Such a contract consumes the
   * BUILDER's capacity, not this nation's, but is stored here so the ordering player's state carries its obligations.
   * Absent until the nation places its first foreign order, so the field never perturbs existing save hashes.
   */
  foreignContracts?: ForeignConstructionContract[];
  /**
   * The paid instalments the engine has resolved for those foreign contracts (DESIGN-16 section 13.4). Absent until an
   * instalment is paid, so it never perturbs an existing save hash; the monthly phase reads and extends it.
   */
  foreignContractPayments?: ForeignContractPaymentRecord[];
  /**
   * The technology-insight milestones a foreign contract has transferred (DESIGN-16 section 13.5). Absent until the
   * first award, so it never perturbs an existing save hash; the monthly step reads and extends it.
   */
  foreignInsightAwards?: ForeignInsightAwardRecord[];
  /**
   * The causal records of this nation's AUTHORISED foreign-contract impoundments (DESIGN-16 sections 13.6-13.7;
   * SB3-R23). One entry per impounded contract. Absent until the first impoundment, so the field never perturbs an
   * existing save hash.
   */
  foreignContractImpoundments?: ForeignContractImpoundmentRecord[];
  aircraft?: Record<string, unknown>;
  carrierOperations?: Record<string, unknown>;
  isPlayable: boolean;
  isAI: boolean;
}

/** Explicit states of an AI procurement lifecycle record (ADR-0091). */
export type ProcurementIntentStatus =
  | "PLANNED"
  | "STUDY_SUBMITTED"
  | "STUDY_IN_PROGRESS"
  | "APPROVED"
  | "ORDER_PLACED"
  | "REJECTED"
  | "CANCELLED"
  | "EXPIRED";

/**
 * A minimal, platform-independent record of one AI procurement attempt (ADR-0091): the decision, the submitted design
 * and its study, and the construction project once ordered. It is the correlation record that makes the lifecycle
 * idempotent and replayable; the authoritative design/study/project state still lives in `designs`, `designStudies`
 * and `constructionProjects`. Stable ids only — never class names or display text.
 */
export interface ProcurementIntent {
  procurementDecisionId: string;
  nationId: string;
  /** DESIGN-22 role/type the decision targets (e.g. "CL"); `roleGroup` is derived, not stored. */
  role: string;
  shipType: string;
  candidateDesignId: string;
  submittedDesignId: string | null;
  designStudyId: string | null;
  constructionProjectId: string | null;
  status: ProcurementIntentStatus;
  attemptNumber: number;
  createdAtMonth: string;
  lastUpdatedAtMonth: string;
  budgetCeiling: SafeInt;
  /** Dock the chosen candidate needs, or null when no candidate was chosen. */
  dockRequirement: { lengthMm: number; beamMm: number; displacementKg: number } | null;
  /** Deterministic seed that produced the candidate, kept so the decision replays exactly. */
  decisionSeed: string;
  /** Structured rejection/cancellation/deferral/expiry reason code, or null while healthy. */
  reason: string | null;
}

/**
 * A design study (DESIGN-21 section 3, ADR-0085): the paid design-office work that approves one submitted design. It holds
 * the compiled version it approves, which enters `designs` (with its family) in the month the study completes. Work is in
 * months, cost in treasury units; a month that cannot be paid makes no progress.
 */
export interface DesignStudy {
  designStudyId: string;
  nationId: string;
  /** Intended builder context: the nation's own design office (licensed design rights do not exist yet). */
  builderContext: "NATIONAL";
  /** The approved design it was derived from, or "NONE" for a new design. */
  baselineDesignVersionId: string;
  designFamilyId: string;
  /** Whether the family is created when the study completes (a new design, or a derived one that was not similar). */
  newFamily: boolean;
  /** Similarity result (sections 9-17): failed criterion codes in the fixed order; empty when derived. */
  derived: boolean;
  failedCriteria: string[];
  baseStudyWork: number;
  baseStudyCost: Money;
  discountBp: Bp;
  finalStudyWork: number;
  finalStudyCost: Money;
  workDone: number;
  costPaid: Money;
  status: "IN_PROGRESS" | "COMPLETED";
  startMonth: string;
  completionMonth: string | null;
  rulesetVersion: string;
  formulaVersion: "design_study_v1";
  /** sha256 of the study's identity and terms, fixed when it starts. */
  projectHash: string;
  design: CompiledDesignVersion;
}

/** The package kinds of a new-construction plan (ship-design `PackageKind`); stored as plain strings so the state stays data. */
export type ConstructionPackageKind =
  | "HULL"
  | "ARMOUR"
  | "ORDNANCE"
  | "MACHINERY"
  | "LAUNCH"
  | "FIT_OUT"
  | "TRIALS"
  | "ACCEPTANCE";

/**
 * One work package of a project (ADR-0077): the plan is stored on the project so the engine never needs the design or the
 * content to advance it. Work is in the same units as the project's `totalWork`.
 */
export interface ConstructionPackage {
  id: string;
  kind: ConstructionPackageKind;
  /** Production line that supplies its capacity (ship-design `LineId`). */
  line: string;
  totalWork: SafeInt;
  doneWork: SafeInt;
  /** Package ids that must be complete before this one starts. */
  dependsOn: string[];
}

/**
 * What a project's funding has already used in one month (ADR-0077): the work applied per production line and the progress
 * the month started from. Funding can reach a project several times in a month (a budget command, then the appropriation
 * phase); this keeps a line's monthly capacity from being spent twice and keeps dependencies judged at the month's start.
 */
export interface ConstructionMonthUsage {
  month: string;
  used: Record<string, SafeInt>;
  startDone: Record<string, SafeInt>;
}

export interface ConstructionProject {
  id: string;
  type: "ship" | "building" | "technology";
  /**
   * NEW_CONSTRUCTION builds a new ship; REBUILD works on an existing, completed ship, which is unavailable for the whole
   * project (DESIGN-23 sections 20-22, ADR-0078). INFRASTRUCTURE is a dock-expansion project (DESIGN-16 section 5): its
   * completion requires both elapsed active months and paid work, and it raises the nation's dock limits (SB3-R16).
   */
  projectType: "NEW_CONSTRUCTION" | "REBUILD" | "INFRASTRUCTURE";
  /** For a REBUILD: the ship being rebuilt. Absent for new construction. */
  targetShipId?: string;
  targetId: string;
  designVersionId: string;
  totalWork: SafeInt;
  completedWork: SafeInt;
  paidWork: SafeInt;
  status: ConstructionProjectStatus;
  startedAt: string;
  /**
   * First month (YYYY-MM) the project may be funded again after a revision (ADR-0070). Absent when never held; an
   * earlier month than the campaign month means the hold has ended.
   */
  holdUntilMonth?: string;
  /**
   * Per-package progress (ADR-0077). Absent for authored projects and for projects made before per-package progress, which
   * keep the single `completedWork` figure. When present, `completedWork` is the sum of the packages' `doneWork` and
   * `totalWork` the sum of their `totalWork`.
   */
  packages?: ConstructionPackage[];
  /** Id of the yard building the ship (ADR-0077); absent when no yard was chosen. */
  yardId?: string;
  /**
   * The project's own monthly throughput per production line, in its treasury units (spec #138 slice 4). Set on a project
   * the campaign starts with on the slips, whose authored design carries no construction plan; the project's own value
   * wins over the design's when both exist. Absent for ordered projects, which use their design's plan.
   */
  capacityUnits?: Record<string, SafeInt>;
  /**
   * National naval profile that priced this project at order time (ADR-0090); absent for nation-neutral orders.
   * The resolved cost and build-time multipliers are persisted here so a replay reuses the price the order was
   * placed at, even if the profile content changes afterwards.
   */
  nationalProfileId?: string;
  costMultiplierBp?: number;
  buildTimeMultiplierBp?: number;
  /**
   * Displacement reserved against the national concurrency cap at order time (SB3-R18), in kilograms: the design's
   * non-exempt share under the AMC/small-corvette exemption (DESIGN-16 section 9). Absent on projects made before the
   * cap existed, in which case the cap is recomputed from the design. Kept as a plain number so campaign state has no
   * dependency on the ship-design package.
   */
  newConstructionReservedMassKg?: number;
  /**
   * Class-order batch (DESIGN-23 section 4, SB3-R11): the canonical ship name allocated at order time by the naming
   * policy. `buildCompletedShip` uses it when the hull is launched; absent on single orders and authored projects, which
   * keep the `Ship <class>` fallback. Plain text so campaign state has no dependency on the ship-design package.
   */
  shipName?: string;
  /** Stable id of the class-order batch all ships of one `OrderConstructionCommand` share (SB3-R11). */
  batchId?: string;
  /** The batch's named-class id, shared by every ship of the batch (SB3-R13). */
  namedClassId?: string;
  /** 1-based position of this ship within its batch, used for canonical ordering (SB3-R11). */
  batchOrdinal?: number;
  /**
   * Naming provenance (SB3-R13): the id of the authored name pool the ship's name was drawn from, and the 1-based
   * position of the chosen stem in that pool (`0` for a placeholder name). Plain values, so campaign state keeps no
   * dependency on the ship-design package. Absent on single orders and authored projects.
   */
  namePoolId?: string;
  namePoolOrdinal?: number;
  /** Capacity and starting progress of the month last funded; only on projects with `packages`. */
  monthUsage?: ConstructionMonthUsage;
  /**
   * The `completedWork` position at which the one-time acceleration premium was last applied (DESIGN-13 section
   * 11.3.1). Optional so saves written before engine-side acceleration stay valid; once set, re-enabling
   * acceleration without progressing work must not charge the premium again for the same remaining-work segment.
   */
  accelerationPremiumAppliedAtWorkPosition?: SafeInt;
  /**
   * Dock-expansion projects only (DESIGN-16 section 5, SB3-R16). `dockExpansionStepKg` is the era step locked in at
   * authorization; `dockExpansionDurationMonths` is the clamped final duration; `elapsedActiveMonths` counts months the
   * project was actually ACTIVE (a halted or delayed month contributes zero). A completed step requires BOTH elapsed
   * months reaching the duration AND paid work reaching total work. Absent on every non-expansion project, so the
   * field never perturbs existing save hashes.
   */
  elapsedActiveMonths?: number;
  dockExpansionDurationMonths?: number;
  dockExpansionStepKg?: number;
  /**
   * Foreign construction (DESIGN-16 section 13): the contract this project fulfils, and the nation whose yard builds
   * it. Present only on foreign orders. The reservation is stored as `0` because a foreign contract consumes the
   * BUILDER's capacity (section 13.3) and must leave the ordering nation's pool provably untouched. Plain values, so
   * campaign state keeps no dependency on the ship-design package.
   */
  foreignContractId?: string;
  foreignBuilderNationId?: string;
  /**
   * The stable reason a delayed month carries (e.g. `PAYMENT_DEFAULT_DELAYED`, DESIGN-16 section 13.4), when the
   * delay is not the ordinary one-month capacity delay. Absent on every other project, so the field never perturbs
   * existing save hashes. It lets a foreign payment default hold the project in `DELAYED` until payment/termination.
   */
  delayReasonCode?: string;
}

export interface WorldState {
  areas: AreaData[];
  routes: RouteData[];
  ports: PortData[];
  /**
   * The pack's research catalogue, materialised at compile time (#138 slice 3). The research phase reads
   * costs, fields, prerequisites and availability from here; an absent or empty catalogue leaves every
   * field without an eligible technology.
   */
  technologies?: TechnologyDefinitionData[];
  /**
   * The possessions and their current owners, ordered by id (S-5, spec #73 R3). A possession that changes hands
   * is updated here; a nation's presence areas are derived from it. Absent in saves from earlier builds.
   */
  possessions?: PossessionData[];
}

/** One owned possession: the nation that holds it and the area it lies in. */
export interface PossessionData {
  id: string;
  nationId: string;
  areaId: string;
}

/** One technology of the compiled research catalogue, ordered by id in `WorldState.technologies`. */
export interface TechnologyDefinitionData {
  techId: string;
  researchFieldId: string;
  /** Research points (treasury units) needed to discover the technology. */
  cost: SafeInt;
  discoveryWeight: SafeInt;
  prerequisites: string[];
  /** First campaign month (0 = the start month) in which the technology can be researched. */
  availabilityMonth: SafeInt;
}

export interface AreaData {
  id: string;
  name: string;
  type: "land" | "sea" | "coastal";
  controller?: string;
}

export interface RouteData {
  id: string;
  from: string;
  to: string;
  type: "land" | "sea" | "rail";
  distance: SafeInt;
}

export interface PortData {
  id: string;
  name: string;
  areaId: string;
  nationId: string;
  level: SafeInt;
}

export interface IntelligenceState {
  shells: Record<string, unknown>;
}

export interface PersistenceManifest {
  version: string;
  campaignId: string;
  turnNumber: SafeInt;
  snapshotHash: string;
  contentArtifactHash: string;
  rulesetVersion: string;
  compatibilityVersion: string;
  createdAt: string;
}

export interface CampaignSlot {
  nationId: string;
  type: "playable" | "ai";
}

// Canonical current-month per-area strategic weather state (DESIGN-42 §1, B-6
// INC-1/ADR-0025). Structurally defined here so campaign stays dependency-free
// (the same precedent as BattleManifest above); @bluewave/combat's
// `generateStrategicWeather` produces it via the structurally-identical
// `StrategicWeatherState`. Every numeric field is integer fixed-point with the
// bounds enforced by @bluewave/combat's `assertFixedPointStrategicWeather`.
export interface CampaignWeatherState {
  /** Stable strategic-area identifier. */
  areaId: string;
  /** Campaign month identifier (e.g. "1880-02" — `campaignMonthId` derives it). */
  month: string;
  /** Climate-profile identifier the state was generated from. */
  climateProfileId: string;
  /** Season identifier resolved from the calendar month (climate profile). */
  seasonId: string;
  /** Identifier of the prior persistent weather state ("" when none). */
  persistentWeatherStateId: string;
  /** Sea state, integer 0..9. */
  seaState: number;
  /** Wind direction in canonical angular units (integer degrees 0..359). */
  windDirectionDeg: number;
  /** Wind speed in integer micrometres per second. */
  windSpeedUmPerSec: number;
  /** Precipitation type (NONE | RAIN | SNOW). */
  precipitationType: "NONE" | "RAIN" | "SNOW";
  /** Precipitation intensity in basis points 0..10_000. */
  precipitationIntensityBp: number;
  /** Fog or mist density in basis points 0..10_000. */
  fogMistDensityBp: number;
  /** Cloud cover in basis points 0..10_000. */
  cloudCoverBp: number;
  /** Daylight-profile identifier. */
  daylightProfileId: string;
  /** Whether the area is eligible for directional glare effects. */
  glareEligible: boolean;
  /** Base visibility distance in integer micrometres. */
  baseVisibilityUm: number;
  /** Phase id the state was generated in ("weather_generation"). */
  generatedAtPhase: string;
  /** Ruleset version. */
  rulesetVersion: string;
  /** Climate-profile version. */
  climateVersion: string;
  /** Formula version. */
  formulaVersion: string;
  /** RNG version. */
  rngVersion: string;
  /** Authoritative state hash (deterministic). */
  stateHash: string;
}

export interface CampaignSnapshot {
  version: string;
  turnNumber: SafeInt;
  campaignId: string;
  // The campaign's start calendar date (DESIGN-03 §2 timeline anchor, B-6
  // ADR-0025). The compiled snapshot derives it from the scenario /
  // `campaignStart` input; the phase engine derives every campaign month id
  // from it via `campaignMonthId` (never wall-clock/env/locale).
  startYear: number;
  startMonth: number;
  slots: CampaignSlot[];
  world: WorldState;
  nations: Map<string, NationState>;
  wars: WarState;
  politics: PoliticalState;
  intelligence: IntelligenceState;
  designs: Map<string, CompiledDesignVersion>;
  designFamilies: Map<string, DesignFamily>;
  // Current-month per-area StrategicWeatherState collection (DESIGN-42 §1 /
  // ADR-0025). Canonically ordered by areaId (stable serializer order; only the
  // CURRENT campaign month is stored — no unbounded growth). Empty at compile.
  strategicWeather: CampaignWeatherState[];
  /**
   * The prestige value set the campaign runs on (S-2, ADR-0239): bounds, sacking threshold and
   * probability, and each source's rule, decoded strictly from the ruleset at compile. Required,
   * with no default; later S-2 phases read it from here rather than from any constant.
   */
  prestigeRules: PrestigeValueSet;
  rulesetVersion: string;
  compatibilityVersion: string;
}

export interface CampaignState {
  snapshot: CampaignSnapshot;
  envelope: CanonicalEnvelope;
  rawHash: string;
}
