export { type Candidate, generateCandidates } from "./ai.js";
export { aluminiumAvailable, type AluminiumBalance } from "./aluminium.js";
export {
  antiAircraftAvailable,
  type AntiAircraftBalance,
  type AntiAircraftFit,
  MAX_AA_DIRECTORS,
} from "./antiAircraft.js";
export {
  APPROVED_DIFFS_SCHEMA,
  checkWithApprovedDiffs,
  decodeApprovedDiffs,
  readsAsBroadApproval,
} from "./approvedDiffs.js";
export { type AuthoredArmamentContent, nationHasArmamentContent } from "./armamentContent.js";
export {
  allOrNothingRegions,
  ARMOUR_REGIONS,
  type ArmourBalance,
  type ArmourMaterialOption,
  armourMaterialOptions,
  type ArmourRegion,
  type ArmourRegionId,
  newArmourRegion,
  type RegionSizing,
} from "./armour.js";
export {
  applyArmourScheme,
  ARMOUR_SCHEMES,
  armourSchemeAvailable,
  type ArmourSchemeDef,
  type ArmourSchemeId,
} from "./armourSchemes.js";
export { ZONE_IDS, type ZoneId } from "./arrangement.js";
export { type BatteryRole, type BatteryRow, batterySummary, mountNames } from "./batteries.js";
export { CLASSIFICATION_REJECTION_IDS } from "./classification.js";
export { DESIGN_22_EARLY } from "./classificationRules.js";
export { compileDesign } from "./compile.js";
export {
  compileDraftFromParts,
  type DraftCompileContent,
  type DraftCompileResult,
  draftToLoadout,
  type DraftTranslationIssue,
  type LegacyCompileView,
  toLegacyCompileView,
} from "./compileDraft.js";
export {
  type CompiledDesign,
  type ComponentSummary,
  type DesignDraft,
  type DesignRequirement,
  type PlacementSpec,
  type ShipContext,
} from "./compileShared.js";
export {
  compileTorpedo,
  type CompileTorpedoFailure,
  type CompileTorpedoFailureCode,
  type CompileTorpedoResult,
} from "./compileTorpedo.js";
export { COMPONENT_CATEGORIES, type ComponentCategory, type ComponentDef } from "./component.js";
export {
  advanceConstructionMonth,
  type ConstructionBalance,
  type ConstructionPlan,
  LINE_IDS,
  type LineId,
  PACKAGE_ORDER,
  type PackageKind,
  type PackageProgress,
  preservationCostPerMonthMicro,
  simulateConstruction,
  type WorkPackage,
} from "./construction.js";
export {
  type ConstructionCapacityBalance,
  type ConstructionCapacityExemptionDefinition,
  constructionPoolForProjectKind,
  INSUFFICIENT_PROJECT_CAPACITY,
  maxConcurrentConstructionMassKg,
  reservedNewConstructionMassKg,
  shippedConstructionCapacityExemptions,
} from "./constructionCapacity.js";
export { buildProgressOf } from "./constructionProgress.js";
export { type HullFormRecord, shipBalanceFromRecord } from "./contextBuilder.js";
export { computeCost, type CostBalance, type CostContext, treasuryCostUnits } from "./cost.js";
export {
  type DockRecord,
  dockRecordFor,
  dockRecordFromDefinition,
  newConstructionDockEligibility,
} from "./dock.js";
export {
  DOCK_EXPANSION_BASE_DURATION_MONTHS,
  DOCK_EXPANSION_NEUTRAL_DURATION_MULTIPLIER_BP,
  dockExpansionEraStepForMonth,
  dockExpansionFinalDurationMonths,
  type DockMassLimits,
  raiseDockLimitsByStep,
} from "./dockExpansion.js";
export { applyEdit, type DraftEdit, EditError } from "./edits.js";
export { type EngineAdapterOptions, toEngineDesign } from "./engineAdapter.js";
export {
  type ExplanationPart,
  type ExplanationText,
  type ExplanationUnit,
  type ExplanationValue,
  quantity,
} from "./explanation.js";
export {
  type Finding,
  findingKey,
  type FindingTarget,
  type SettingGroup,
  type Severity,
  SEVERITY_ORDER,
} from "./findings.js";
export {
  assessFleet,
  chooseProcurementRole,
  computeFleetDeficits,
  type FleetShipView,
  planProcurementDecision,
  type RoleGroup,
  roleGroupOf,
  shipTypeForHullType,
} from "./fleetProcurement.js";
export {
  capabilityFailureCode,
  FOREIGN_BUILDER_CAPABILITY_INSUFFICIENT,
  FOREIGN_BUILDER_CAPACITY_UNAVAILABLE,
  FOREIGN_BUILDER_NATION_INVALID,
  FOREIGN_CONSTRUCTION_CONTRACT_REQUIRED,
  FOREIGN_CONTRACT_PAYMENT_DEFAULT,
  FOREIGN_PAYMENT_DEFAULT_DELAYED,
  FOREIGN_PAYMENT_GRACE_MONTHS,
  type ForeignBuilderCapabilityCheck,
  type ForeignBuilderCapabilityInput,
  validateForeignBuilderCapability,
} from "./foreignConstruction.js";
export { type PropulsionPlant } from "./machinery.js";
export { allocateShipNames, PLACEHOLDER_NAME_POOL_ID, type ShipNameAllocation } from "./naming.js";
export {
  type NationNavalProfile,
  nationProfileBrief,
  type NationProfileBrief,
  resolveNavalProfile,
} from "./nationProfile.js";
export { resolveNationalConstruction } from "./nationalConstruction.js";
export { researchPriorityAllocation } from "./nationalResearch.js";
export { buildPartCatalogue, PART_SOURCE_FIELDS, type SourceCatalogue } from "./partCatalogue.js";
export {
  buildPartCatalogueView,
  legacyCatalogueView,
  type PartCatalogueEntry,
} from "./partCatalogueView.js";
export { buildCompatibilitySlots } from "./partCompatibility.js";
export { lifecycleStatus, shiftMonth } from "./partLifecycle.js";
export { partCatalogue } from "./partQueries.js";
export {
  canRedo,
  canUndo,
  currentDraft,
  decodeDesignFile,
  decodeLog,
  DESIGN_SCHEMA_VERSION,
  type EditLog,
  encodeDesignFile,
  encodeLog,
  newLog,
  PersistenceError,
  pushEdit,
  redo,
  undo,
  validateDraftShape,
} from "./persistence.js";
export {
  type RebuildBalance,
  rebuildFactsOf,
  rebuildPackages,
  validateRebuild,
} from "./rebuild.js";
export { armamentChangeFindings, type GunChange } from "./refit.js";
export {
  type BuildProgress,
  type ChangeKind,
  changeKindsOf,
  classifyRevision,
  inPlaceRevisionFindings,
  type RevisionBalance,
  type RevisionDecision,
  revisionFactsOf,
} from "./revision.js";
export { draftChangeKinds, progressFromWork } from "./revisionDiff.js";
export { seededConstructionPlan } from "./seededPlan.js";
export {
  buildShipBuildingContent,
  type RawReferenceDesign,
  type ReferenceDesignProvenance,
  referenceDesignsFromLoadouts,
  type ShipBuildingContent,
  type ShipBuildingData,
  unlockedTechIds,
} from "./shipBuildingContent.js";
export {
  type AvailabilityReason,
  evaluateAmcFleetLimit,
  evaluateShipTypeAvailability,
} from "./shipTypeAvailability.js";
export { type Range } from "./shipTypeEnvelope.js";
export { buildShipTypeRoster, type RosterEntry, type StarterDesign } from "./shipTypeRoster.js";
export {
  HULL_TYPE_FOR_SHIP_TYPE,
  isShipTypeId,
  SHIP_TYPE_CATEGORIES,
  SHIP_TYPE_LIST,
  SHIP_TYPES,
  type ShipTypeCategory,
  type ShipTypeId,
  UNSIMULATED_ROLES,
} from "./shipTypes.js";
export { assessSimilarity, similarityProfile, studyTerms } from "./study.js";
export { type SuggestedFix, suggestFixes } from "./suggest.js";
export { TOPSIDE_WARN_BP, topsideLoad, type TopsideStatus } from "./topside.js";
export { type TorpedoModelSource } from "./torpedoPartBuilder.js";
export { bp, kg, mm, UM_PER_INCH } from "./units.js";
export { type MountSide } from "./weapons.js";
export {
  buildWorkshopView,
  type Metric,
  type WorkshopEnvironment,
  type WorkshopView,
  type YardOption,
} from "./workshop.js";
export { constructionOrderPlan, yardDemandOf } from "./yardChoice.js";
export { type Yard, type YardDemand, type YardLimit } from "./yards.js";
