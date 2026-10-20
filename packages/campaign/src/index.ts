export * from "./campaignConfiguration.js";
// DESIGN-03 session state + preconditions (renamed type to avoid clashing with
// the compiled-world CampaignState from ./state.js)
export {
  advanceCampaignMonth,
  assertCampaignStateImmutability,
  type CampaignSessionState,
  canAdvanceCampaign,
  createInitialCampaignState,
  hashConfiguration,
  validateCampaignPreconditions,
  verifyCampaignTechnologyManifest,
} from "./campaignSession.js";
export * from "./continuity.js";
// DESIGN-23 section 2: the dockyard-project status vocabulary and its legal transition table (ADR-0129).
export * from "./constructionStatus.js";
// DESIGN-26 divisions (types + constants + aggregate commands).
export * from "./division.js";
// ADR-0037: compiled design-unit conversions (mm/knots authoring -> µm/µm·s⁻¹).
export * from "./designUnits.js";
export * from "./fleetSize.js";
export * from "./researchSpeed.js";
// DESIGN-03 Campaign Configuration surface
export * from "./scenario.js";
export type {
  BattleInstance,
  BattleManifest,
  BattleManifestSide,
  BattleResult,
  LostShipRecord,
  BlockadeState,
  CampaignSlot,
  CampaignSnapshot,
  CampaignState,
  CampaignWeatherState,
  CompiledDesignVersion,
  CompiledTorpedoMount,
  ConstructionPackage,
  ConstructionMonthUsage,
  ConstructionPackageKind,
  ConstructionPlanRecord,
  ConstructionPlanShare,
  ConstructionProject,
  DesignFamily,
  DiplomaticRelation,
  DockUtilizationMonth,
  FleetState,
  ForeignConstructionContract,
  ForeignContractCapacityReservation,
  ForeignContractPaymentInstallment,
  ForeignContractPaymentRecord,
  ForeignContractImpoundmentRecord,
  ForeignInsightAwardRecord,
  IntelligenceState,
  DesignStudy,
  NationDockExpansionState,
  NationDockState,
  NationState,
  PossessionData,
  PossessionDockExpansionEligibility,
  ProcurementIntent,
  ProcurementIntentStatus,
  PersistenceManifest,
  PoliticalState,
  ResearchState,
  Ship,
  ShipAvailability,
  TechnologyProgress,
  TechnologyDefinitionData,
  WarDeclaration,
  WarParticipantMembership,
  WarState,
  WorldState,
} from "./state.js";
export { isShipOperational } from "./state.js";
export { presenceAreaIds } from "./presence.js";
// S-5: foreign-station assignment rules (value-free; spec #73 R1/R2).
export * from "./stationAssignment.js";
export * from "./technologyVariation.js";
export * from "./technologyMaterialization.js";
export * from "./timeline.js";
export * from "./warConstants.js";
export * from "./budgetConstants.js";
export * from "./movement.js";
export * from "./officers.js";
// S-1: per-ship readiness vocabulary, crew band and compile-boundary seeding.
export * from "./readiness.js";
// S-2: the value-free prestige rule layer (spec #74 R1); it carries no prestige value.
export * from "./prestige.js";
// S-1: the single per-ship maintenance formula and readiness-state multipliers.
export * from "./maintenance.js";
export * from "./researchEligibility.js";
export * from "./economyOutlook.js";
// Economy spec #138: the shared revenue / research / outflow-settlement calculators.
export * from "./economy.js";
