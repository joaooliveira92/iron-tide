import { Schema } from "effect";

import { ProvenanceSchema } from "./provenance.js";

// ══════════════════════════════════════════════════════════════════════
// Nation IDs — 24 canonical nations, January 1880
// ══════════════════════════════════════════════════════════════════════

/** Canonical 24-nation id list (January 1880). Exported so consumers/tests have a stable tuple. */
export const NATION_IDS = [
  "uk",
  "germany",
  "usa",
  "japan",
  "france",
  "italy",
  "russia",
  "austria_hungary",
  "spain",
  "qing",
  "ottoman_empire",
  "egypt",
  "netherlands",
  "belgium",
  "denmark",
  "sweden_norway",
  "portugal",
  "greece",
  "brazil",
  "chile",
  "argentina",
  "korea",
  "persia",
  "siam",
] as const;

export const NationIdSchema = Schema.Literals(NATION_IDS);
export type NationId = typeof NationIdSchema.Type;

// ══════════════════════════════════════════════════════════════════════
// Regime enums — 1880-accurate
// ══════════════════════════════════════════════════════════════════════

export const RegimeTypeSchema = Schema.Literals(["monarchy", "republic"]);
export type RegimeType = typeof RegimeTypeSchema.Type;

/** Specific political systems that existed in January 1880 */
export const PoliticalSystemSchema = Schema.Literals([
  "constitutional_monarchy",
  "federal_constitutional_monarchy",
  "dual_monarchy",
  "autocratic_monarchy",
  "absolute_monarchy",
  "parliamentary_republic",
  "presidential_republic",
  "meiji_constitutional_monarchy",
  "khedivate_autonomous",
  "union_monarchy",
]);
export type PoliticalSystem = typeof PoliticalSystemSchema.Type;

export const StabilityLevelSchema = Schema.Literals([
  "very_high",
  "high",
  "moderate",
  "brittle",
  "fragile",
  "unstable",
]);
export type StabilityLevel = typeof StabilityLevelSchema.Type;

// ══════════════════════════════════════════════════════════════════════
// Canon sub-model enums
// ══════════════════════════════════════════════════════════════════════

export const NavalPurposeSchema = Schema.Literals([
  "sustain_global_empire",
  "gain_world_power_status",
  "defend_hemisphere_expand",
  "secure_sovereignty_ascent",
  "restore_status_offset_rivals",
  "gain_mediterranean_credibility",
  "escape_geographic_confinement",
  "deny_adriatic_control",
  "preserve_colonies_honor",
  "defend_sovereignty_modernize",
  "guard_straits_survive",
  "control_canal_survive",
  "sustain_colonial_network",
  "guard_baltic_entrance",
  "maintain_union_neutrality",
  "defend_coast_colonies",
  "survive_as_buffer",
  "contest_southern_cone",
]);
export type NavalPurpose = typeof NavalPurposeSchema.Type;

export const IndustrialBaseSchema = Schema.Literals([
  "mature_global",
  "rising_dynamic",
  "latent_giant",
  "constrained_regional",
  "uneven",
  "fragmented",
  "vast_unintegrated",
  "agrarian_colonial",
  "resource_export",
]);
export type IndustrialBase = typeof IndustrialBaseSchema.Type;

export const SenioritySchema = Schema.Literals([
  "senior_service",
  "junior_to_army",
  "prestige_service",
  "fragmented",
  "coastal_only",
]);
export type Seniority = typeof SenioritySchema.Type;

export const AiArchetypeSchema = Schema.Literals([
  "status_quo_maritime_hegemon",
  "restless_industrial_challenger",
  "cautious_industrial_giant_awakening",
  "urgent_regional_modernizer",
  "restless_revanchist_innovator",
  "prestige_seeking_mediterranean_opportunist",
  "fragmented_continental_giant",
  "defensive_adriatic_strategist",
  "defensive_declining_empire",
  "vast_conservative_modernizer",
  "besieged_strait_guardian",
  "canal_guardian_in_debt",
  "wealthy_neutral_colonial",
  "small_strait_guardian",
  "neutral_archipelago_defender",
  "small_colonial_survivor",
  "irredentist_small_power",
  "south_american_giant",
  "battle_tested_pacific_power",
  "growing_plate_power",
  "hermit_kingdom_flashpoint",
  "skillful_buffer_kingdom",
  "neutral_industrial_minor",
  "great_game_buffer",
]);
export type AiArchetype = typeof AiArchetypeSchema.Type;

export const AiRoleSchema = Schema.Literals([
  "strait_guardian",
  "colonial_power",
  "regional_balancer",
  "buffer_state",
  "southern_cone_rival",
  "crisis_flashpoint",
]);
export type AiRole = typeof AiRoleSchema.Type;

/** 24 distinct canonical anxieties (one per nation) */
export const CoreAnxietySchema = Schema.Literals([
  "loss_of_sea_control_overstretch",
  "encirclement_insufficient_recognition",
  "foreign_interference_americas",
  "domination_before_ready",
  "germany_land_britain_sea",
  "french_pressure_austrian_ambiguity",
  "warm_water_failure_fragmentation",
  "italian_hostility_adriatic_vulnerability",
  "colonial_collapse_humiliation",
  "foreign_encroachment_failed_modernization",
  "russian_breakthrough_and_partition",
  "foreign_occupation_and_loss_of_autonomy",
  "loss_of_east_indies",
  "great_power_pressure_over_straits",
  "union_dissolution_and_great_power_pressure",
  "loss_of_angola_mozambique",
  "ottoman_retention_of_greek_lands",
  "argentine_chilean_challenge",
  "argentine_intervention_and_loss_of_nitrates",
  "brazilian_chilean_encirclement",
  "loss_of_sovereignty_to_qing_japan_or_russia",
  "russian_british_partition",
  "partition_between_britain_and_france",
  "great_power_violation_of_neutrality",
]);
export type CoreAnxiety = typeof CoreAnxietySchema.Type;

/** Canonical gameplay feels, one per nation (not all values distinct) */
export const GameplayFeelSchema = Schema.Literals([
  "manage_supremacy",
  "build_concentrated_relevance",
  "awaken_latent_power",
  "modernize_under_pressure",
  "forge_coherence",
  "gamble_intelligently",
  "integrate_disconnected_theaters",
  "defend_narrow_sea",
  "prevent_imperial_collapse",
  "transform_vast_potential",
  "guard_the_gate",
  "survive_between_empires",
  "defend_far_flung_empire_as_small_power",
  "leverage_geography_as_small_power",
  "defend_long_coast_as_neutral",
  "survive_as_small_colonial",
  "irredentist_gamble",
  "dominate_south_atlantic",
  "win_pacific_war_and_control_magellan",
  "grow_between_giants",
  "survive_between_empires",
  "survive_great_game",
  "survive_as_buffer_via_diplomacy",
  "survive_as_neutral_industrial",
]);
export type GameplayFeel = typeof GameplayFeelSchema.Type;

export const GdpTierSchema = Schema.Literals([
  "global_hegemon",
  "great_power",
  "regional_power",
  "minor_power",
  "small_power",
]);
export type GdpTier = typeof GdpTierSchema.Type;

export const IndustrializationLevelSchema = Schema.Literals([
  "world_leading",
  "industrial",
  "developing_industrial",
  "agrarian",
  "pre_industrial",
]);
export type IndustrializationLevel = typeof IndustrializationLevelSchema.Type;

export const NavalBudgetLevelSchema = Schema.Literals([
  "very_low",
  "low",
  "moderate",
  "high",
  "very_high",
  "crisis",
]);
export type NavalBudgetLevel = typeof NavalBudgetLevelSchema.Type;

export const ArmyNavyBalanceSchema = Schema.Literals([
  "army_dominant",
  "army_heavy",
  "balanced",
  "navy_prestige",
  "navy_focused",
]);
export type ArmyNavyBalance = typeof ArmyNavyBalanceSchema.Type;

// ══════════════════════════════════════════════════════════════════════
// Primitives
// ══════════════════════════════════════════════════════════════════════

const HexColorSchema = Schema.String.check(Schema.isPattern(/^#[0-9A-Fa-f]{6}$/)).annotate({
  description: "CSS hex color, e.g. #C8102E",
});

// ══════════════════════════════════════════════════════════════════════
// Sub-objects
// ══════════════════════════════════════════════════════════════════════

export const PresentationSchema = Schema.Struct({
  colorBg: HexColorSchema,
  colorFg: HexColorSchema,
}).annotate({ description: "Nation flag/presentation colors" });

export const NationSlotSchema = Schema.Struct({
  id: Schema.String,
  order: Schema.Finite,
  participation: Schema.Literals(["active", "inactive", "conditional"]),
});

export const StabilityProfileSchema = Schema.Struct({
  level: StabilityLevelSchema,
  factors: Schema.Array(Schema.String),
}).annotate({ description: "Domestic stability level and contributing factors" });

// ══════════════════════════════════════════════════════════════════════
// Phase 1 additive fields — spec-driven
// ══════════════════════════════════════════════════════════════════════

export const StrategicObjectivesSchema = Schema.Struct({
  primary: Schema.String,
  secondary: Schema.String,
}).annotate({ description: "Primary and secondary strategic objectives per scenario era" });

export const BaseResourcesSchema = Schema.Struct({
  gdpTier: GdpTierSchema,
  gdpDescription: Schema.String.annotate({
    description: "Free-text elaboration on GDP tier, e.g. 'largest in Europe, #1 globally'",
  }),
  population: Schema.String.annotate({
    description: "Population as free-text string, e.g. '~35M (UK proper); ~300M (empire)'",
  }),
  industrialization: IndustrializationLevelSchema,
  industrializationDescription: Schema.String.annotate({
    description: "Free-text elaboration on industrial level",
  }),
}).annotate({ description: "Base resource indicators, January 1880" });

export const NavalAppropriationSchema = Schema.Struct({
  budgetLevel: NavalBudgetLevelSchema,
  justification: Schema.String.annotate({
    description: "Narrative justification for the naval budget level",
  }),
}).annotate({ description: "Naval budget appropriation for the scenario era" });

// ══════════════════════════════════════════════════════════════════════
// Regime — 1880-accurate political system
// ══════════════════════════════════════════════════════════════════════

export const NationRegimeSchema = Schema.Struct({
  type: RegimeTypeSchema,
  politicalSystem: PoliticalSystemSchema.annotate({
    description: "Specific 1880 political system",
  }),
  governmentForm: Schema.optional(Schema.String).annotate({
    description: "Deprecated — prefer politicalSystem",
  }),
  headOfState: Schema.String,
  headOfGovernment: Schema.String,
  leaderTitle: Schema.String,
  navalPolicyActors: Schema.Array(Schema.String),
  governmentModifiers: Schema.Array(Schema.String).annotate({
    description: "Tags e.g. federal_structure, fragmented_legislature",
  }),
  navyMinister: Schema.optional(
    Schema.Struct({
      name: Schema.String,
      title: Schema.String,
      traits: Schema.optional(Schema.String),
    }),
  ),
  stabilityProfile: StabilityProfileSchema,
  description: Schema.String,
}).annotate({ description: "Political regime, January 1880" });

// ══════════════════════════════════════════════════════════════════════
// Domain sub-models
// ══════════════════════════════════════════════════════════════════════

export const IdentitySchema = Schema.Struct({
  oneSentence: Schema.String.annotate({ description: "Phase 1 canonical one-sentence identity" }),
  fullIdentity: Schema.String.annotate({ description: "Phase 1 full national identity" }),
  strategicProblem: Schema.String.annotate({
    description: "Core strategic problem the nation faces",
  }),
});

export const EconomySchema = Schema.Struct({
  description: Schema.String,
  character: Schema.String,
  strengths: Schema.Array(Schema.String),
  weaknesses: Schema.Array(Schema.String),
  industrialBase: IndustrialBaseSchema,
});

export const NavalInstitutionSchema = Schema.Struct({
  description: Schema.String,
  character: Schema.Array(Schema.String),
  seniority: SenioritySchema,
  cruiserRole: Schema.optional(Schema.String),
  formativeExperience: Schema.optional(Schema.String),
});

export const DoctrineSchema = Schema.Struct({
  summary: Schema.String,
  schools: Schema.Array(Schema.String),
  isFragmented: Schema.optional(Schema.Boolean),
  isTheaterSpecific: Schema.optional(Schema.Boolean),
});

export const ShipDesignSchema = Schema.Struct({
  summary: Schema.String,
  principles: Schema.Array(Schema.String),
  favoredTypes: Schema.Array(Schema.String),
  tradeOffs: Schema.optional(Schema.String),
  exemplarClass: Schema.optional(Schema.String),
});

export const AiSchema = Schema.Struct({
  archetype: AiArchetypeSchema,
  behavior: Schema.Array(Schema.String),
  aiRole: Schema.optional(AiRoleSchema),
  triggers: Schema.optional(Schema.Array(Schema.String)),
});

// ══════════════════════════════════════════════════════════════════════
// Military — Phase 1 Nations
// ══════════════════════════════════════════════════════════════════════

export const MilitarySchema = Schema.Struct({
  description: Schema.String.annotate({ description: "Army/military profile overview" }),
  size: Schema.optional(Schema.String).annotate({
    description: "Free-text army size, e.g. 'peacetime ~900,000'",
  }),
  character: Schema.optional(Schema.Array(Schema.String)),
  armyNavyBalance: Schema.optional(ArmyNavyBalanceSchema),
}).annotate({ description: "Army/military profile for the scenario era" });

// ══════════════════════════════════════════════════════════════════════
// Nation entity — single source of truth for the canon
// ══════════════════════════════════════════════════════════════════════

export const NationSchema = Schema.Struct({
  id: NationIdSchema,
  tag: Schema.String.check(Schema.isPattern(/^[A-Z]{3}$/)).annotate({
    description: "Uppercase 3-letter code, e.g. GBR",
  }),
  name: Schema.String,
  displayNameKey: Schema.String,
  isPlayable: Schema.Boolean,
  slot: Schema.NullOr(NationSlotSchema),
  presentation: PresentationSchema,
  identity: IdentitySchema,
  regime: NationRegimeSchema,
  strategicObjectives: StrategicObjectivesSchema,
  baseResources: BaseResourcesSchema,
  navalAppropriation: NavalAppropriationSchema,
  economy: EconomySchema,
  navalInstitution: NavalInstitutionSchema,
  doctrine: DoctrineSchema,
  shipDesign: ShipDesignSchema,
  ai: AiSchema,
  military: Schema.optional(MilitarySchema),
  navalPurpose: NavalPurposeSchema,
  coreAnxiety: CoreAnxietySchema,
  gameplayFeel: GameplayFeelSchema,
  historicalAssumptions: Schema.Array(Schema.String),
  provenance: Schema.optional(ProvenanceSchema),
}).annotate({ description: "Canonical nation definition, January 1880" });

// ══════════════════════════════════════════════════════════════════════
// Inferred types
// ══════════════════════════════════════════════════════════════════════

export type NationRegime = typeof NationRegimeSchema.Type;
export type Nation = typeof NationSchema.Type;
export type NationSlot = typeof NationSlotSchema.Type;
export type StabilityProfile = typeof StabilityProfileSchema.Type;
export type Presentation = typeof PresentationSchema.Type;
export type Identity = typeof IdentitySchema.Type;
export type Economy = typeof EconomySchema.Type;
export type NavalInstitution = typeof NavalInstitutionSchema.Type;
export type Doctrine = typeof DoctrineSchema.Type;
export type ShipDesign = typeof ShipDesignSchema.Type;
export type Ai = typeof AiSchema.Type;
export type Military = typeof MilitarySchema.Type;
export type StrategicObjectives = typeof StrategicObjectivesSchema.Type;
export type BaseResources = typeof BaseResourcesSchema.Type;
export type NavalAppropriation = typeof NavalAppropriationSchema.Type;
