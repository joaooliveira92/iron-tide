export type {
  EventAnswer,
  EventCounterpartRole,
  EventEffects,
  EventGates,
  EventPrestigeEffect,
  EventStance,
  GameEvent,
} from "./event.js";
export {
  EVENT_COUNTERPART_ROLES,
  EVENT_STANCES,
  EventAnswerSchema,
  EventCounterpartRoleSchema,
  EventEffectsSchema,
  EventGatesSchema,
  EventPrestigeEffectSchema,
  EventSchema,
  EventStanceSchema,
} from "./event.js";
export type { Area } from "./area.js";
export { AreaSchema } from "./area.js";
export type { DesignTemplate } from "./design.js";
export {
  DesignTemplateSchema,
  MainGunsSchema,
  TorpedoMountSchema,
  TORPEDO_MOUNT_TYPE_VALUES,
} from "./design.js";
export type {
  DesignDraft,
  ReferenceDesign,
  ReferenceDesignProvenance,
  ReferenceValueProvenance,
} from "./reference-design.js";
export {
  ACCOMMODATION_STANDARDS,
  ARMOUR_REGION_IDS,
  ARMOUR_SCHEME_IDS,
  MOUNT_SIDES,
  ReferenceDesignProvenanceSchema,
  ReferenceDesignSchema,
  ReferenceValueProvenanceSchema,
  REFERENCE_PROVENANCE_FIELDS,
  REFERENCE_VALUE_STATUSES,
  REFERENCE_VALUE_STATUSES_SCHEMA,
} from "./reference-design.js";
export type {
  CampaignConstruction,
  CampaignDesign,
  CampaignDiplomacy,
  CampaignDivision,
  CampaignEconomy,
  CampaignFleet,
  CampaignResearch,
} from "./campaign.js";
export {
  CAMPAIGN_DIVISION_FORMATIONS,
  CAMPAIGN_DIVISION_ROLES,
  CampaignConstructionSchema,
  CampaignDesignSchema,
  CampaignDiplomacySchema,
  CampaignDivisionSchema,
  CampaignEconomySchema,
  CampaignFleetSchema,
  CampaignResearchSchema,
  FleetShipSchema,
} from "./campaign.js";
export {
  CampaignCollectionsSchema,
  ContentBundleSchema,
  type CampaignCollections,
  type CompiledContentBundle,
} from "./content-bundle.js";
export type { ContentPack, PackManifest, RulesetManifest } from "./manifest.js";
export { PackManifestSchema, RulesetManifestSchema } from "./manifest.js";
export type {
  Ai,
  AiArchetype,
  AiRole,
  ArmyNavyBalance,
  BaseResources,
  CoreAnxiety,
  Doctrine,
  Economy,
  GameplayFeel,
  GdpTier,
  GovernmentType,
  Identity,
  IndustrialBase,
  IndustrializationLevel,
  Military,
  Nation,
  NationId,
  NationRegime,
  NationSlot,
  NationTrait,
  NavalAppropriation,
  NavalBudgetLevel,
  NavalInstitution,
  NavalPurpose,
  PoliticalSystem,
  Presentation,
  RegimeType,
  Seniority,
  ShipDesign,
  StabilityLevel,
  StabilityProfile,
  StrategicObjectives,
} from "./nation.js";
export {
  AiArchetypeSchema,
  AiRoleSchema,
  AiSchema,
  ArmyNavyBalanceSchema,
  BaseResourcesSchema,
  CoreAnxietySchema,
  DoctrineSchema,
  EconomySchema,
  GameplayFeelSchema,
  GdpTierSchema,
  GOVERNMENT_TYPES,
  GovernmentTypeSchema,
  IdentitySchema,
  IndustrialBaseSchema,
  IndustrializationLevelSchema,
  MilitarySchema,
  NATION_IDS,
  NATION_TRAIT_IDS,
  NationIdSchema,
  NationRegimeSchema,
  NationSchema,
  NationSlotSchema,
  NationTraitSchema,
  NavalAppropriationSchema,
  NavalBudgetLevelSchema,
  NavalInstitutionSchema,
  NavalPurposeSchema,
  PoliticalSystemSchema,
  PresentationSchema,
  RegimeTypeSchema,
  SenioritySchema,
  ShipDesignSchema,
  StabilityLevelSchema,
  StabilityProfileSchema,
  StrategicObjectivesSchema,
} from "./nation.js";
export {
  CONTENT_DECODE_OPTIONS,
  decodeStrict,
  decodeStrictResult,
  type ContentSchema,
} from "./decode.js";
export type { Port } from "./port.js";
export { PortSchema } from "./port.js";
export type {
  MapJoin,
  NationCoordinates,
  NationDossier,
  NationFlavor,
  NationPresentationRecord,
  PresentationContent,
  Region,
  RegionGrouping,
} from "./presentation.js";
export {
  MapJoinSchema,
  NationCoordinatesSchema,
  NationDossierSchema,
  NationFlavorSchema,
  NationPresentationRecordSchema,
  PresentationContentSchema,
  RegionGroupingSchema,
  RegionSchema,
} from "./presentation.js";
export { UiCatalogueSchema, type UiCatalogue } from "./ui-catalogue.js";
export { isInternationalizationPath, parseUiCatalogue, type UiCatalogueParse } from "./i18n.js";
export type { Possession } from "./possession.js";
export { PossessionSchema } from "./possession.js";
export type { ResearchFieldId } from "./research-fields.js";
export {
  CANONICAL_RESEARCH_FIELD_IDS,
  MAX_HIGH_PRIORITY_FIELDS,
  RESEARCH_FIELD_PRIORITY_WEIGHTS,
} from "./research-fields.js";
export type { RouteEdge } from "./route.js";
export { RouteEdgeSchema } from "./route.js";
export { validateAgainstSchema } from "./schema-validator.js";
export type { NationNavalProfileData } from "./naval-profile.js";
export { NavalProfileCatalogueSchema, NationNavalProfileSchema } from "./naval-profile.js";
export type { Provenance } from "./provenance.js";
export { DerivationSchema, ProvenanceSchema, SourceReferenceSchema } from "./provenance.js";
export type {
  FleetManagementRules,
  FleetManagementRulesDecoded,
} from "./fleet-management-rules.js";
export {
  FLEET_TRAINING_SUBJECTS,
  FleetManagementRulesSchema,
  decodeFleetManagementRules,
} from "./fleet-management-rules.js";
export type { BattleOfferRules, BattleOfferRulesDecoded } from "./battle-offer-rules.js";
export { BattleOfferRulesSchema, decodeBattleOfferRules } from "./battle-offer-rules.js";
export type { GunneryRules, GunneryRulesDecoded } from "./gunnery-rules.js";
export { GunneryRulesSchema, decodeGunneryRules } from "./gunnery-rules.js";
export type { MissileClassRules, MissilesRules, MissilesRulesDecoded } from "./missiles-rules.js";
export {
  MissileClassRulesSchema,
  MissilesRulesSchema,
  decodeMissilesRules,
} from "./missiles-rules.js";
export type { PresenceRules, PresenceRulesDecoded } from "./presence-rules.js";
export { decodePresenceRules, PresenceRulesSchema } from "./presence-rules.js";
export {
  COMPONENT_ACCESS_STATUSES_SCHEMA,
  CONFIDENCE_LEVELS,
  CONFIDENCE_LEVELS_SCHEMA,
  NAVAL_POSTURES_SCHEMA,
  PROVENANCE_KINDS_SCHEMA,
  SHIP_TYPE_ID_VALUES,
  SOURCE_STATUSES,
  SOURCE_STATUSES_SCHEMA,
} from "./naval-profile-vocab.js";
export type {
  AmmunitionPatternData,
  GunFamilyData,
  GunModelData,
  GunMountData,
} from "./armament.js";
export {
  AmmunitionCatalogueSchema,
  AmmunitionPatternSchema,
  GunFamilyCatalogueSchema,
  GunFamilySchema,
  GunModelCatalogueSchema,
  GunModelSchema,
  GunMountCatalogueSchema,
  GunMountSchema,
} from "./armament.js";
export type { TechnologyPrerequisite } from "./technology.js";
export { TechnologyPrerequisiteChainSchema } from "./technology.js";
export {
  MAX_YAML_ALIAS_COUNT,
  MAX_YAML_BYTES,
  MAX_YAML_NESTING,
  parseYamlSafe,
  type SafeParseResult,
  YAML_POLICY_VERSION,
} from "./yaml-parser.js";
export type { PropulsionPlantData, ShipComponentData, ShipHullFormData } from "./ship-component.js";
export {
  PropulsionPlantCatalogueSchema,
  PropulsionPlantSchema,
  SHIP_COMPONENT_CATEGORIES,
  SHIP_ZONE_IDS,
  ShipComponentCatalogueSchema,
  ShipComponentSchema,
  ShipComponentWithSourceCatalogueSchema,
  ShipComponentWithSourceSchema,
  ShipHullFormCatalogueSchema,
  ShipHullFormSchema,
} from "./ship-component.js";
export type { ShipVisualCatalog } from "./ship-visual.js";
export {
  SHIP_VISUAL_ERAS,
  SHIP_VISUAL_MOUNT_CLASSES,
  SHIP_VISUAL_PLAN_BODIES,
  SHIP_VISUAL_SIZES,
  SHIP_VISUAL_STYLES,
  SHIP_VISUAL_TONES,
  ShipVisualCatalogSchema,
  ShipVisualMastSchema,
  ShipVisualMountSchema,
} from "./ship-visual.js";
export type {
  ApplicationBasis,
  CapabilityData,
  CompiledPartModel,
  DesignHeaderData,
  DesignLoadoutData,
  EngineeringData,
  EngineBehaviourClass,
  PartTag,
  FlattenedPart,
  LegacyExceptionCode,
  LoadoutData,
  LoadoutEntryData,
  NestedLoadoutEntry,
  PartData,
  PartFamily,
  PartIndex,
  PartInterface,
  PlatformData,
  ProductionLine,
  QuantityComponentData,
  QuantityKind,
  ReferenceDesignLoadoutData,
  ResolvedPartRevision,
  ShipTypeRecord,
  ShipTypeRequirement,
  ShipZoneId,
  SlotData,
  SlotTemplateData,
  TorpedoPropulsionType,
  TorpedoTubeHitHazardPolicy,
  TorpedoWarheadType,
} from "./ship-parts.js";
export {
  ACCOUNTING_QUANTITY_KINDS,
  APPLICATION_BASES,
  CAPABILITY_KINDS,
  CapabilitiesSchema,
  CapabilitySchema,
  CompiledPartModelSchema,
  CoolingEngineeringSchema,
  DesignHeaderSchema,
  DesignLoadoutSchema,
  ENGINE_BEHAVIOUR_CLASSES,
  EngineeringSchema,
  FIRE_CONTROL_CLASSES,
  FlammabilityEngineeringSchema,
  GUN_WEAPON_CATEGORIES,
  LengthMmSchema,
  MaintenanceEngineeringSchema,
  PRODUCTION_LINES,
  PART_LOCAL_DATUMS,
  PART_TAGS,
  PartMetadataSchema,
  PhysicalEngineeringSchema,
  PowerComponentSchema,
  PowerEngineeringSchema,
  QUANTITY_KIND_UNITS,
  DEFAULT_MOUNT_COUNT,
  FlattenedPartSchema,
  GUN_MOUNT_TYPES,
  LEGACY_EXCEPTION_CODES,
  LegacyExceptionSchema,
  LoadoutEntrySchema,
  LoadoutSchema,
  MISSILE_CLASSES,
  NestedLoadoutEntrySchema,
  PART_FAMILIES,
  PART_INTERFACES,
  PartIndexSchema,
  PartLifecycleSchema,
  PartLineageSchema,
  PartOriginSchema,
  PartSchema,
  PartVisualSchema,
  PlatformSchema,
  ReferenceDesignLoadoutSchema,
  QUANTITY_KINDS,
  QuantityComponentSchema,
  SHIP_TYPE_DISPLAY_CATEGORIES,
  SHIP_TYPE_ERA_BANDS,
  SHIP_TYPE_HULL_TRAITS,
  SHIP_TYPE_ROLES,
  ShipTypeAvailabilitySchema,
  ShipTypeClassificationSchema,
  ShipTypePresentationSchema,
  ShipTypeRecordSchema,
  ShipTypeRequirementSchema,
  SlotConstraintsSchema,
  SlotSchema,
  SlotTemplateSchema,
  TORPEDO_POLICIES,
  TORPEDO_PROPULSION_TYPES,
  TORPEDO_TUBE_HIT_HAZARD_POLICIES,
  TORPEDO_WARHEAD_TYPES,
  TorpedoSpeedSettingSchema,
  WAIVABLE_CONSTRAINTS,
  resolvePartRevision,
} from "./ship-parts.js";
export type {
  BarrelArrangement,
  DeckRelationship,
  ElevationStyle,
  Enclosure,
  Orientation,
  OverridableTrait,
  PartVisualOverrides,
  PresentationForm,
  SizeClass,
  VisualTrait,
  VisualTraitOwnership,
  VisualTraitPartLike,
  VisualTraitSource,
  VisualTraitValues,
  VisualTraitViolation,
} from "./visual-traits.js";
export {
  BARREL_ARRANGEMENTS,
  COMPILER_DERIVED_TRAITS,
  DECK_RELATIONSHIPS,
  ELEVATION_STYLES,
  ENCLOSURES,
  ORIENTATIONS,
  OVERRIDABLE_TRAITS,
  PRESENTATION_FORMS,
  PartVisualOverridesSchema,
  SIZE_CLASSES,
  VISUAL_TRAITS,
  VISUAL_TRAIT_OWNERSHIP,
  VISUAL_TRAIT_RULESET,
  VISUAL_TRAIT_VALUES,
  VisualTraitOverrideSchema,
  deriveVisualTraits,
  effectiveVisualTraits,
  defaultPresentationForm,
  partVisualTraitViolations,
  sizeClassOf,
  visualTraitSourceOfPart,
  visualTraitViolations,
  wholeInchesOf,
} from "./visual-traits.js";

export {
  isValidNationalCurrencyConfiguration,
  NationalCurrencyConfigurationSchema,
  NationalCurrencyPeriodSchema,
  NationalCurrencyScaleSchema,
  validateNationalCurrencyConfiguration,
} from "./national-currency.js";
export type {
  NationalCurrencyConfiguration,
  NationalCurrencyDiagnostic,
  NationalCurrencyDiagnosticReason,
  NationalCurrencyPeriod,
  NationalCurrencyScale,
} from "./national-currency.js";
