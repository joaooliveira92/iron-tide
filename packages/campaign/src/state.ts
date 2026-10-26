import type { Bp, Money, SafeInt } from "@bluewave/contracts";
import type {
  AppliedPrestigeRule,
  CareerResult,
  PrestigeBounds,
  PrestigeReasonCode,
  PrestigeValueSet,
} from "./prestige.js";
import type { CompiledArmamentMount, CompiledTorpedo } from "@bluewave/armament";
import type { CanonicalEnvelope } from "@bluewave/deterministic";
import type { BattleAbsence } from "./battleAbsence.js";
import type { FleetExerciseRecord } from "./fleetExercise.js";
import type { TrainingSubjectEntry } from "./specialTraining.js";
import type { DeclineCounterEntry, DeclinedBattleRecord } from "./declineRecords.js";
import type { PermanentDivision } from "./division.js";
import type { Officer } from "./officers.js";
import type { ConstructionProjectStatus } from "./constructionStatus.js";
import type { ShipReadinessState } from "./readiness.js";
import type { StationAssignment } from "./stationAssignment.js";

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
  readiness: ShipReadinessState;
  crewQuality: SafeInt;
  repairMonthsRemaining?: SafeInt;
  stationAssignment?: StationAssignment;
  colonialServiceFitted?: true;
  overBase?: OverBaseFlag;
  inBattleId?: string;
  availability?: ShipAvailability;
  availabilityProjectId?: string;
}

export interface OverBaseFlag {
  maintenanceAdderBp: SafeInt;
}

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
  standingResearchBudget?: SafeInt;
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
  armament?: readonly CompiledArmamentMount[];
  torpedoArmament?: readonly CompiledTorpedoMount[];
  sourceDraft?: Readonly<Record<string, unknown>>;
  colonialServiceFitted?: true;
  crampedAccommodation?: true;
  shortRange?: true;
  constructionCostUnits?: SafeInt;
  constructionPlan?: ConstructionPlanRecord;
}

export interface ConstructionPlanShare {
  id: string;
  kind: ConstructionPackageKind;
  line: string;
  totalWork: SafeInt;
  dependsOn: string[];
}

export interface ConstructionPlanRecord {
  yardId: string;
  packages: ConstructionPlanShare[];
  capacityUnits: Record<string, SafeInt>;
}

export interface CompiledTorpedoMount {
  mountType: string;
  tubeCount: SafeInt;
  torpedoModelId: string;
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
  tension: number;
  nap: boolean;
  since: string;
}

export interface PoliticalState {
  relations: DiplomaticRelation[];
  shells: Record<string, unknown>;
}

export interface BattleInstance {
  id: string;
  phase: "pending" | "resolving" | "resolved" | "declined";
  attackerId: string;
  defenderId: string;
  areaId: string;
  attackerFleetIds: string[];
  defenderFleetIds: string[];
  manifestHash?: string;
  result?: BattleResult;
  absences?: BattleAbsence[];
}

export interface LostShipRecord {
  shipId: string;
  name: string;
  classId: string;
  nationId: string;
  month: string;
  cause?: string;
}

export interface BattleResult {
  winnerId: string | null;
  loserId: string | null;
  attackerLosses: string[];
  defenderLosses: string[];
  damageReport: Record<string, SafeInt>;
  explanation: string[];
  lostShips?: LostShipRecord[];
}

export interface BattleManifestSide {
  sideId: string;
  participantIds: string[];
}

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
  declinedBattles?: DeclinedBattleRecord[];
  declineCounters?: DeclineCounterEntry[];
}

export interface WarDeclaration {
  id: string;
  attackerSideId: string;
  defenderSideId: string;
  attackerSideMembers: string[];
  defenderSideMembers: string[];
  attackerWarScore: number;
  defenderWarScore: number;
  attackerId: string;
  defenderId: string;
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

export interface NationDockState {
  maximumNewConstructionMassKg: number;
  maximumMajorRepairMassKg: number;
  maximumRebuildMassKg: number;
  maximumConversionMassKg: number;
}

export interface DockUtilizationMonth {
  month: string;
  utilizationBp: number;
}

export interface PossessionDockExpansionEligibility {
  possessionId: string;
  eligible: boolean;
  utilization: DockUtilizationMonth[];
}

export interface NationDockExpansionState {
  possessions: PossessionDockExpansionEligibility[];
  lastOpportunityMonth?: string;
}

export interface ForeignContractPaymentInstallment {
  dueMonth: string;
  amountUnits: Money;
  workShareBp: Bp;
}

export interface ForeignContractCapacityReservation {
  month: string;
  reservedMassKg: number;
  pool: string;
}

export interface ForeignConstructionContract {
  contractId: string;
  orderingNationId: string;
  builderNationId: string;
  builderShipyardId: string;
  designVersionId: string;
  quantity: number;
  totalWorkPerUnit: number;
  totalPriceUnits: Money;
  currencyUnit: string;
  paymentSchedule: ForeignContractPaymentInstallment[];
  capacityReservationSchedule: ForeignContractCapacityReservation[];
  authorizationMonth: string;
  plannedKeelMonth: string;
  plannedDeliveryMonth: string;
  builderCapabilitySnapshotHash: string;
  technologyTransferPolicyId: string;
  warDelayPolicyId: string;
  impoundmentPolicyId: string;
  deliveryGuaranteeClauseId: string;
  occupationDestructionPolicyId: string;
  cancellationRefundPolicyId: string;
  governingTreatyIds: string[];
  rulesetVersion: string;
  formulaVersion: string;
  contractHash: string;
}

export interface ForeignContractPaymentRecord {
  contractId: string;
  paidDueMonths: string[];
}

export interface ForeignInsightAwardRecord {
  contractId: string;
  milestones: string[];
  awardedByFamily: Record<string, number>;
}

export interface ForeignContractImpoundmentRecord {
  contractId: string;
  authorizingPredicate: string;
  custodyNationId: string;
  legalTitle: "ORDERING_NATION" | "BUILDER" | "CONTROLLING_AUTHORITY";
  paidAmountUnits: number;
  unpaidAmountUnits: number;
  compensationOrForfeiture: "COMPENSATION" | "FORFEITURE" | "NONE";
  projectStatus: string;
  futureDeliveryEligible: boolean;
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
  prestige: SafeInt;
  prestigeLastChange?: PrestigeLastChange;
  homeAreaId?: string;
  fleets: FleetState[];
  divisions: PermanentDivision[];
  officers?: Officer[];
  research: ResearchState;
  constructionProjects: ConstructionProject[];
  dock?: NationDockState;
  dockExpansion?: NationDockExpansionState;
  designStudies?: DesignStudy[];
  procurementIntents?: ProcurementIntent[];
  foreignContracts?: ForeignConstructionContract[];
  foreignContractPayments?: ForeignContractPaymentRecord[];
  foreignInsightAwards?: ForeignInsightAwardRecord[];
  foreignContractImpoundments?: ForeignContractImpoundmentRecord[];
  aircraft?: Record<string, unknown>;
  carrierOperations?: Record<string, unknown>;
  specialTraining?: TrainingSubjectEntry[];
  fleetExercise?: FleetExerciseRecord;
  isPlayable: boolean;
  isAI: boolean;
}

export type ProcurementIntentStatus =
  | "PLANNED"
  | "STUDY_SUBMITTED"
  | "STUDY_IN_PROGRESS"
  | "APPROVED"
  | "ORDER_PLACED"
  | "REJECTED"
  | "CANCELLED"
  | "EXPIRED";

export interface ProcurementIntent {
  procurementDecisionId: string;
  nationId: string;
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
  dockRequirement: { lengthMm: number; beamMm: number; displacementKg: number } | null;
  decisionSeed: string;
  reason: string | null;
}

export interface DesignStudy {
  designStudyId: string;
  nationId: string;
  builderContext: "NATIONAL";
  baselineDesignVersionId: string;
  designFamilyId: string;
  newFamily: boolean;
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
  projectHash: string;
  design: CompiledDesignVersion;
}

export type ConstructionPackageKind =
  | "HULL"
  | "ARMOUR"
  | "ORDNANCE"
  | "MACHINERY"
  | "LAUNCH"
  | "FIT_OUT"
  | "TRIALS"
  | "ACCEPTANCE";

export interface ConstructionPackage {
  id: string;
  kind: ConstructionPackageKind;
  line: string;
  totalWork: SafeInt;
  doneWork: SafeInt;
  dependsOn: string[];
}

export interface ConstructionMonthUsage {
  month: string;
  used: Record<string, SafeInt>;
  startDone: Record<string, SafeInt>;
}

export interface ConstructionProject {
  id: string;
  type: "ship" | "building" | "technology";
  projectType: "NEW_CONSTRUCTION" | "REBUILD" | "INFRASTRUCTURE";
  targetShipId?: string;
  targetId: string;
  designVersionId: string;
  totalWork: SafeInt;
  completedWork: SafeInt;
  paidWork: SafeInt;
  status: ConstructionProjectStatus;
  startedAt: string;
  holdUntilMonth?: string;
  packages?: ConstructionPackage[];
  yardId?: string;
  capacityUnits?: Record<string, SafeInt>;
  nationalProfileId?: string;
  costMultiplierBp?: number;
  buildTimeMultiplierBp?: number;
  newConstructionReservedMassKg?: number;
  shipName?: string;
  batchId?: string;
  namedClassId?: string;
  batchOrdinal?: number;
  namePoolId?: string;
  namePoolOrdinal?: number;
  monthUsage?: ConstructionMonthUsage;
  accelerationPremiumAppliedAtWorkPosition?: SafeInt;
  elapsedActiveMonths?: number;
  dockExpansionDurationMonths?: number;
  dockExpansionStepKg?: number;
  foreignContractId?: string;
  foreignBuilderNationId?: string;
  delayReasonCode?: string;
}

export interface WorldState {
  areas: AreaData[];
  routes: RouteData[];
  ports: PortData[];
  technologies?: TechnologyDefinitionData[];
  possessions?: PossessionData[];
}

export interface PossessionData {
  id: string;
  nationId: string;
  areaId: string;
}

export interface TechnologyDefinitionData {
  techId: string;
  researchFieldId: string;
  cost: SafeInt;
  discoveryWeight: SafeInt;
  prerequisites: string[];
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

export interface CampaignWeatherState {
  areaId: string;
  month: string;
  climateProfileId: string;
  seasonId: string;
  persistentWeatherStateId: string;
  seaState: number;
  windDirectionDeg: number;
  windSpeedUmPerSec: number;
  precipitationType: "NONE" | "RAIN" | "SNOW";
  precipitationIntensityBp: number;
  fogMistDensityBp: number;
  cloudCoverBp: number;
  daylightProfileId: string;
  glareEligible: boolean;
  baseVisibilityUm: number;
  generatedAtPhase: string;
  rulesetVersion: string;
  climateVersion: string;
  formulaVersion: string;
  rngVersion: string;
  stateHash: string;
}

export interface PrestigeLastChange {
  reasonCode: PrestigeReasonCode;
  before: SafeInt;
  after: SafeInt;
  delta: SafeInt;
  month: string;
  appliedRule?: AppliedPrestigeRule;
  unclampedAfter?: SafeInt;
  bounds?: PrestigeBounds;
}

export interface CampaignSnapshot {
  version: string;
  turnNumber: SafeInt;
  campaignId: string;
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
  strategicWeather: CampaignWeatherState[];
  prestigeRules: PrestigeValueSet;
  careerResult?: CareerResult;
  rulesetVersion: string;
  compatibilityVersion: string;
}

export interface CampaignState {
  snapshot: CampaignSnapshot;
  envelope: CanonicalEnvelope;
  rawHash: string;
}
