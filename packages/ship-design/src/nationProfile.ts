/**
 * National naval identity (docs/ships-nation-orientation.md): a platform-independent, date-banded profile that
 * separates **hard capability** (what a nation *can* build: technology, industry, facilities, licences) from
 * **soft doctrine** (what it *prefers*: speed vs armour, endurance, risk appetite). Hard capability may only
 * restrict what the global rules already allow; it can never widen them (ADR-0089). Soft doctrine guides templates,
 * AI design evaluation and procurement, and never blocks a legal design on its own.
 *
 * The model is pure domain data: no React, no Electron, no filesystem. Content authors the values in
 * `content/production/<scenario>/ship-building/naval-profiles/<nation>.yaml`; this module resolves and validates them.
 */
import type { ShipTypeId } from "./shipTypes.js";

// ---------------------------------------------------------------------------------------------------------------
// Provenance (the merchant-liner discipline, applied to national content)
// ---------------------------------------------------------------------------------------------------------------

/** How a value came to be: sourced, derived, an estimate, a pure balance choice, or an unreplaced placeholder. */
export const SOURCE_STATUSES = [
  "VERIFIED",
  "DERIVED",
  "ESTIMATE",
  "BALANCE_TARGET",
  "PLACEHOLDER",
] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];

export const CONFIDENCE_LEVELS = ["HIGH", "MEDIUM", "LOW"] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

/** Whether a number is a sourced fact, an arithmetic game conversion, or a gameplay balance choice. */
export const PROVENANCE_KINDS = [
  "historical_fact",
  "game_conversion",
  "balance_adjustment",
] as const;
export type ProvenanceKind = (typeof PROVENANCE_KINDS)[number];

export interface SourceReference {
  /** Stable source id (e.g. "white-1894"), for cross-referencing research notes. */
  readonly sourceId?: string;
  readonly title: string;
  readonly author?: string;
  readonly year?: number;
  readonly page?: string;
  /** Chapter/section where the page is unavailable. */
  readonly section?: string;
  readonly archiveOrUrl?: string;
  readonly accessedAt?: string;
}

/** The arithmetic that turns a sourced value into a game value (shown so a reviewer can re-do it). */
export interface Derivation {
  readonly sourceValue: string;
  readonly sourceUnit: string;
  readonly conversion: string;
  readonly gameValue: string;
  readonly roundingRule?: string;
  /** Optional explicit original/converted aliases. */
  readonly originalValue?: string;
  readonly originalUnit?: string;
  readonly convertedValue?: string;
  readonly convertedUnit?: string;
}

export interface Provenance {
  readonly sourceStatus: SourceStatus;
  readonly confidence: Confidence;
  readonly kind: ProvenanceKind;
  readonly sources: readonly SourceReference[];
  readonly derivation?: Derivation;
  /** A short explanatory note (why an ESTIMATE/BALANCE_TARGET was chosen). */
  readonly note?: string;
}

// ---------------------------------------------------------------------------------------------------------------
// Doctrine / capability vocabularies
// ---------------------------------------------------------------------------------------------------------------

/** DESIGN-22-style strategic postures. */
export const NAVAL_POSTURES = [
  "battle_fleet_concentration",
  "commerce_defence",
  "commerce_raiding",
  "colonial_presence",
  "coastal_defence",
  "regional_warfare",
  "distant_water_operations",
  "torpedo_warfare",
] as const;
export type NavalPosture = (typeof NAVAL_POSTURES)[number];

/** How a nation obtains a component: domestic, licence-built, imported, studied, or unavailable. */
export const COMPONENT_ACCESS_STATUSES = [
  "DOMESTIC",
  "LICENSE_BUILT",
  "IMPORTED",
  "CAPTURED_OR_STUDIED",
  "UNAVAILABLE",
] as const;
export type ComponentAccessStatus = (typeof COMPONENT_ACCESS_STATUSES)[number];

export interface ComponentAccess {
  readonly status: ComponentAccessStatus;
  /** Domestic manufacturer, or the source/licensor for non-domestic access (e.g. "Elswick", "Canet"). */
  readonly producer?: string;
  readonly provenance?: Provenance;
}

/** The hierarchy of a gun's installation, kept separate from the gun model itself. */
export const MOUNT_TYPES = [
  "TURRET",
  "BARBETTE",
  "CASEMATE",
  "DECK_SHIELDED",
  "DECK_OPEN",
  "BROADSIDE_BATTERY",
  "SUBMERGED_TUBE",
  "ABOVE_WATER_TUBE",
] as const;
export type MountType = (typeof MOUNT_TYPES)[number];

/** A national gun model overlaying a shared family (components.yaml id). */
export interface GunModelDef {
  readonly id: string;
  /** The shared catalogue component id this model overlays. */
  readonly familyId: string;
  readonly designation: string;
  /** Field overrides applied to the base `ComponentDef` (e.g. weightKg, attributes.shellMassG). */
  readonly overrides: Readonly<Record<string, string | number | readonly string[]>>;
  /** Mount types this model may be installed in (a compatibility view; the compile still reads the merged def). */
  readonly mounts: readonly MountType[];
  readonly introductionMonth?: string;
  readonly obsoleteMonth?: string | null;
  readonly provenance: Provenance;
}

/** AP vs HE family; doctrine picks the preference, the pattern carries the effect. */
export const AMMUNITION_PATTERNS = ["AP", "APC", "CPC", "SAP", "HE", "MELINITE"] as const;
export type AmmunitionPattern = (typeof AMMUNITION_PATTERNS)[number];

export interface AmmunitionPatternDef {
  readonly id: string;
  readonly pattern: AmmunitionPattern;
  /** Armour-piercing bias 0..10000: 10000 = pure AP, 0 = pure HE. */
  readonly penetrationBiasBp: number;
  readonly provenance: Provenance;
}

/** A generic (non-gun) component variant: a national model overlaying a shared family. */
export interface ComponentVariantDef {
  readonly id: string;
  readonly familyId: string;
  readonly designation: string;
  readonly overrides: Readonly<Record<string, string | number | readonly string[]>>;
  readonly introductionMonth?: string;
  readonly obsoleteMonth?: string | null;
  readonly provenance: Provenance;
}

// ---------------------------------------------------------------------------------------------------------------
// Hard capability (restrictive only) and soft preference (guiding only)
// ---------------------------------------------------------------------------------------------------------------

/**
 * Hard capabilities. Each field is a *ceiling* or *allow-list*: the effective capability is the intersection of
 * the profile's value with the global catalogue. A profile can only ever remove options (ADR-0089).
 */
export interface HardCapabilities {
  /** Largest gun calibre the domestic industry can produce, µm. */
  readonly maxGunCaliberUm: number;
  /**
   * Largest obtainable *imported* gun calibre, µm, when it exceeds the domestic ceiling (ADR-0114).
   * Absent means imports are capped at `maxGunCaliberUm`. It can only ever admit an IMPORTED/LICENSED
   * family above the domestic ceiling; it never raises the domestic ceiling itself.
   */
  readonly maxImportedGunCaliberUm?: number;
  /** Thickest armour plate the domestic industry can roll, µm. */
  readonly maxArmourThicknessUm: number;
  /** Domestic torpedo bore, µm (a variant family may still import a different bore). */
  readonly domesticTorpedoDiameterUm: number;
  /** Hull-form ids the nation may lay down. */
  readonly hullForms: readonly string[];
  /** Plant ids the nation may install domestically. */
  readonly domesticPlants: readonly string[];
  /** Ship types the nation forbids outright (a restrict-only list; never grants). */
  readonly restrictedShipTypes: readonly ShipTypeId[];
  /** Capability ids granted to the nation (checked against a type's `requiresCapability`). */
  readonly grants: readonly string[];
}

/** Soft preferences. Never blocks a legal design; steers templates, AI scoring and procurement. */
export interface SoftPreferences {
  /** Speed vs armour: > 5000 favours speed, < 5000 favours protection (5000 = neutral). */
  readonly speedOverArmourBp: number;
  /** Secondary-battery emphasis relative to a neutral design (10000 = neutral). */
  readonly secondaryBatteryWeightBp: number;
  /** Endurance emphasis for station work (10000 = neutral). */
  readonly enduranceWeightBp: number;
  /** Risk appetite: willingness to adopt unproven components (10000 = neutral). */
  readonly riskToleranceBp: number;
  /** Value placed on colonial-service capability for KE/AMC (10000 = neutral). */
  readonly colonialServiceWeightBp: number;
  /** Preference for torpedo armament on cruisers (10000 = neutral). */
  readonly torpedoOnCruisersBp: number;
  readonly accommodationStandard: "SPARTAN" | "STANDARD" | "GENEROUS";
}

// ---------------------------------------------------------------------------------------------------------------
// Industrial / construction
// ---------------------------------------------------------------------------------------------------------------

/** A date-banded ceiling (e.g. max practical displacement per era). */
export interface DatedValue {
  readonly fromMonth: string;
  readonly value: number;
}

export interface IndustrialProfile {
  /** Relative build speed (10000 = the 1894 baseline; < 10000 builds faster). Within ±15% (ADR-0089). */
  readonly buildTimeMultiplierBp: number;
  /** Relative hull cost (10000 = baseline). Within ±15%. */
  readonly costMultiplierBp: number;
  /** Machinery reliability for the nation's plants (bp; 10000 = fully reliable). */
  readonly machineryReliabilityBp: number;
  /** Spread of construction quality outcomes (bp std-dev proxy; larger = more variance). */
  readonly constructionQualityVarianceBp: number;
  /** Max practical displacement by era (date-banded). */
  readonly maxPracticalDisplacementKg: readonly DatedValue[];
  readonly heavyGunProduction: ComponentAccessStatus;
  readonly armourPlateProduction: ComponentAccessStatus;
  readonly provenance: Provenance;
}

/**
 * The nation's dock (DESIGN-16 section 4): the largest hull it can build, repair, rebuild and convert. Distinct from
 * `IndustrialProfile.maxPracticalDisplacementKg`, which is a production/throughput figure and must not be used as a
 * dock limit (ADR-0135). Every limit is authored explicitly; a missing one fails rather than being copied.
 */
export interface DockDefinition {
  readonly maximumNewConstructionMassKg: number;
  readonly maximumMajorRepairMassKg: number;
  readonly maximumRebuildMassKg: number;
  readonly maximumConversionMassKg: number;
  /** Optional extra national dimension bound beyond the per-yard fit; absent = none. */
  readonly dimensions?: {
    readonly maxLengthMm: number;
    readonly maxBeamMm: number;
    readonly maxHeaviestComponentKg: number;
  } | null;
  readonly provenance: Provenance;
}

export interface DoctrineProfile {
  /** Preferred battle range, metres. */
  readonly engagementRangeM: number;
  /** AP vs HE bias 0..10000 (10000 = pure AP). */
  readonly hePreferenceBp: number;
  readonly postures: readonly NavalPosture[];
  readonly provenance: Provenance;
}

export interface ResearchPreference {
  /** Canonical research field id (content-schema research-fields.ts). */
  readonly field: string;
  /** Priority 1..4 (HIGH = 4). */
  readonly priority: number;
}

/** Role-specific AI weights. Each is a bp multiplier around a neutral 10000. */
export interface DesignWeights {
  readonly firepowerBp: number;
  readonly protectionBp: number;
  readonly speedBp: number;
  readonly enduranceBp: number;
  readonly torpedoBp: number;
  readonly reliabilityBp: number;
  readonly colonialBp: number;
  /** Cost penalty weight (10000 = neutral). */
  readonly costBp: number;
}

export interface ProcurementPolicy {
  readonly battleLineShareBp: number;
  readonly cruiserShareBp: number;
  readonly torpedoCraftShareBp: number;
  readonly colonialShareBp: number;
  readonly foreignProcurementAppetiteBp: number;
  readonly unprovenTechAppetiteBp: number;
  /** Preference order the AI orders new ships in when budget is unconstrained. */
  readonly buildOrder: readonly ShipTypeId[];
}

export interface NamingPolicy {
  /** Authored name stems by type (published ship names are historical facts). */
  readonly stems: Readonly<Partial<Record<ShipTypeId, readonly string[]>>>;
  /** One-line naming convention per type, for the player-facing explanation. */
  readonly convention: Readonly<Partial<Record<ShipTypeId, string>>>;
}

// ---------------------------------------------------------------------------------------------------------------
// The profile
// ---------------------------------------------------------------------------------------------------------------

export interface NationNavalProfile {
  readonly nationId: string;
  /** First month the profile is active (YYYY-MM); profiles are date-banded so a nation can change over time. */
  readonly activeFrom: string;
  /** Last month the profile is active, inclusive, or null for "until further notice". */
  readonly activeUntil: string | null;
  readonly strategicSituation: string;
  readonly hardCapabilities: HardCapabilities;
  readonly softPreferences: SoftPreferences;
  readonly industrialProfile: IndustrialProfile;
  /** The nation's dock limits (DESIGN-16 section 4, ADR-0135). Authored, distinct from the production ceiling. */
  readonly dock: DockDefinition;
  readonly doctrineProfile: DoctrineProfile;
  readonly researchPreferences: readonly ResearchPreference[];
  readonly componentAccess: Readonly<Record<string, ComponentAccess>>;
  readonly gunModels: readonly GunModelDef[];
  readonly ammunitionPatterns: readonly AmmunitionPatternDef[];
  readonly componentVariants: readonly ComponentVariantDef[];
  readonly designWeights: Readonly<Record<ShipTypeId, DesignWeights>>;
  readonly procurementPolicy: ProcurementPolicy;
  readonly namingPolicy: NamingPolicy;
  readonly sourceReferences: readonly SourceReference[];
  readonly provenance: Provenance;
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const ID_RE = /^[a-z][a-z0-9_]*$/;

export const isMonthId = (s: string): boolean => MONTH_RE.test(s);

const monthIndex = (m: string): number => Number(m.slice(0, 4)) * 12 + (Number(m.slice(5, 7)) - 1);

/** The profile active for a nation at a month: the newest `activeFrom` at or before it, else null. */
export function resolveNavalProfile(
  profiles: readonly NationNavalProfile[],
  nationId: string,
  month: string,
): NationNavalProfile | null {
  const active = profiles
    .filter(
      (p) =>
        p.nationId === nationId &&
        monthIndex(p.activeFrom) <= monthIndex(month) &&
        (p.activeUntil === null || monthIndex(month) <= monthIndex(p.activeUntil)),
    )
    .sort(
      (a, b) =>
        monthIndex(a.activeFrom) - monthIndex(b.activeFrom) || (a.nationId < b.nationId ? -1 : 1),
    );
  return active.length === 0 ? null : active[active.length - 1]!;
}

/** The effective (date-resolved) industrial modifiers at a month. */
export interface ResolvedConstructionModifiers {
  readonly buildTimeMultiplierBp: number;
  readonly costMultiplierBp: number;
  readonly machineryReliabilityBp: number;
  readonly constructionQualityVarianceBp: number;
  readonly maxPracticalDisplacementKg: number;
}

/** Compose the construction modifiers for a month; a dated ceiling falls back to the earliest entry. */
export function resolveConstructionModifiers(
  profile: NationNavalProfile,
  month: string,
): ResolvedConstructionModifiers {
  const i = profile.industrialProfile;
  const picks = i.maxPracticalDisplacementKg
    .filter((d) => monthIndex(d.fromMonth) <= monthIndex(month))
    .sort((a, b) => monthIndex(a.fromMonth) - monthIndex(b.fromMonth));
  const maxKg =
    picks.length > 0
      ? picks[picks.length - 1]!.value
      : i.maxPracticalDisplacementKg.length > 0
        ? i.maxPracticalDisplacementKg[0]!.value
        : 0;
  return {
    buildTimeMultiplierBp: i.buildTimeMultiplierBp,
    costMultiplierBp: i.costMultiplierBp,
    machineryReliabilityBp: i.machineryReliabilityBp,
    constructionQualityVarianceBp: i.constructionQualityVarianceBp,
    maxPracticalDisplacementKg: maxKg,
  };
}

/** Industrial multipliers must stay restrained (the brief: ±5–15%); ADR-0089 fixes the band at ±15%. */
export const MODIFIER_MIN_BP = 8500;
export const MODIFIER_MAX_BP = 11500;

// ---------------------------------------------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------------------------------------------

export interface ProfileIssue {
  readonly nationId: string;
  readonly code: string;
  readonly message: string;
}

export interface NavalProfileValidationContext {
  readonly knownNationIds: ReadonlySet<string>;
  readonly knownComponentIds: ReadonlySet<string>;
  readonly knownPlantIds: ReadonlySet<string>;
  readonly knownHullFormIds: ReadonlySet<string>;
  readonly knownResearchFields: ReadonlySet<string>;
  /** When true, a PLACEHOLDER provenance is a release blocker (the release gate). */
  readonly release: boolean;
}

const err = (nationId: string, code: string, message: string): ProfileIssue => ({
  nationId,
  code,
  message,
});

/** Content lint for one profile. Deterministic; never throws on content errors. */
export function validateNavalProfile(
  profile: NationNavalProfile,
  ctx: NavalProfileValidationContext,
): ProfileIssue[] {
  const out: ProfileIssue[] = [];
  const p = profile.nationId;

  if (!ctx.knownNationIds.has(p))
    out.push(err(p, "PROFILE_UNKNOWN_NATION", `unknown nation '${p}'`));
  if (!MONTH_RE.test(profile.activeFrom))
    out.push(err(p, "PROFILE_BAD_MONTH", `activeFrom '${profile.activeFrom}' is not YYYY-MM`));
  if (profile.activeUntil !== null && !MONTH_RE.test(profile.activeUntil))
    out.push(err(p, "PROFILE_BAD_MONTH", `activeUntil '${profile.activeUntil}' is not YYYY-MM`));
  if (
    profile.activeUntil !== null &&
    monthIndex(profile.activeUntil) < monthIndex(profile.activeFrom)
  )
    out.push(err(p, "PROFILE_DATE_RANGE", "activeUntil precedes activeFrom"));
  if (profile.strategicSituation.trim() === "")
    out.push(err(p, "PROFILE_TEXT_EMPTY", "strategicSituation is empty"));
  if (profile.doctrineProfile.postures.length === 0)
    out.push(err(p, "PROFILE_TEXT_EMPTY", "doctrineProfile.postures is empty"));

  // Industrial multipliers within ±15%.
  for (const [k, v] of [
    ["buildTimeMultiplierBp", profile.industrialProfile.buildTimeMultiplierBp],
    ["costMultiplierBp", profile.industrialProfile.costMultiplierBp],
  ] as const) {
    if (v < MODIFIER_MIN_BP || v > MODIFIER_MAX_BP)
      out.push(
        err(
          p,
          "PROFILE_MODIFIER_OUT_OF_BOUNDS",
          `${k} ${v} is outside ${MODIFIER_MIN_BP}..${MODIFIER_MAX_BP}`,
        ),
      );
  }
  if (
    profile.industrialProfile.machineryReliabilityBp < 0 ||
    profile.industrialProfile.machineryReliabilityBp > 10000
  )
    out.push(err(p, "PROFILE_VALUE_RANGE", "machineryReliabilityBp must be 0..10000"));

  // Dock limits (DESIGN-16 section 4, ADR-0135): every limit authored, positive and distinct from the production ceiling.
  for (const [k, v] of [
    ["maximumNewConstructionMassKg", profile.dock.maximumNewConstructionMassKg],
    ["maximumMajorRepairMassKg", profile.dock.maximumMajorRepairMassKg],
    ["maximumRebuildMassKg", profile.dock.maximumRebuildMassKg],
    ["maximumConversionMassKg", profile.dock.maximumConversionMassKg],
  ] as const)
    if (!Number.isSafeInteger(v) || v <= 0)
      out.push(
        err(p, "PROFILE_DOCK_LIMIT_INVALID", `dock.${k} = ${v} must be a positive safe integer`),
      );
  if (profile.dock.dimensions != null) {
    for (const [k, v] of [
      ["maxLengthMm", profile.dock.dimensions.maxLengthMm],
      ["maxBeamMm", profile.dock.dimensions.maxBeamMm],
      ["maxHeaviestComponentKg", profile.dock.dimensions.maxHeaviestComponentKg],
    ] as const)
      if (!Number.isSafeInteger(v) || v <= 0)
        out.push(
          err(p, "PROFILE_DOCK_LIMIT_INVALID", `dock.dimensions.${k} = ${v} must be positive`),
        );
  }
  out.push(...placeholderIssues(p, "dock", profile.dock.provenance, ctx.release));

  // Hard capability references.
  for (const id of profile.hardCapabilities.hullForms)
    if (!ctx.knownHullFormIds.has(id))
      out.push(
        err(p, "PROFILE_UNKNOWN_HULL_FORM", `hard capability names unknown hull form '${id}'`),
      );
  for (const id of profile.hardCapabilities.domesticPlants)
    if (!ctx.knownPlantIds.has(id))
      out.push(err(p, "PROFILE_UNKNOWN_PLANT", `hard capability names unknown plant '${id}'`));
  if (profile.hardCapabilities.maxGunCaliberUm <= 0)
    out.push(err(p, "PROFILE_VALUE_RANGE", "maxGunCaliberUm must be positive"));
  if (profile.hardCapabilities.maxImportedGunCaliberUm !== undefined) {
    if (profile.hardCapabilities.maxImportedGunCaliberUm <= 0)
      out.push(err(p, "PROFILE_VALUE_RANGE", "maxImportedGunCaliberUm must be positive"));
    // The import ceiling only ever *widens* what may be obtained from abroad; it must not be set below the
    // domestic ceiling, which would silently restrict domestic production instead of admitting imports.
    else if (
      profile.hardCapabilities.maxImportedGunCaliberUm < profile.hardCapabilities.maxGunCaliberUm
    )
      out.push(
        err(
          p,
          "PROFILE_VALUE_RANGE",
          `maxImportedGunCaliberUm ${profile.hardCapabilities.maxImportedGunCaliberUm} is below maxGunCaliberUm ${profile.hardCapabilities.maxGunCaliberUm}`,
        ),
      );
  }

  // Research fields.
  for (const r of profile.researchPreferences) {
    if (!ctx.knownResearchFields.has(r.field))
      out.push(err(p, "PROFILE_UNKNOWN_RESEARCH_FIELD", `unknown research field '${r.field}'`));
    if (r.priority < 1 || r.priority > 4)
      out.push(err(p, "PROFILE_VALUE_RANGE", `research priority ${r.priority} outside 1..4`));
  }

  // Component access + variants reference real families.
  for (const [familyId, access] of Object.entries(profile.componentAccess)) {
    if (!ctx.knownComponentIds.has(familyId))
      out.push(
        err(p, "PROFILE_UNKNOWN_COMPONENT", `componentAccess names unknown family '${familyId}'`),
      );
    if (access.provenance !== undefined)
      out.push(
        ...placeholderIssues(p, `componentAccess.${familyId}`, access.provenance, ctx.release),
      );
  }
  const visitVariant = (
    v: {
      id: string;
      familyId: string;
      introductionMonth?: string;
      obsoleteMonth?: string | null;
      provenance: Provenance;
    },
    kind: string,
  ) => {
    if (!ID_RE.test(v.id))
      out.push(err(p, "PROFILE_VARIANT_BAD_ID", `${kind} id '${v.id}' is not lower snake_case`));
    if (!ctx.knownComponentIds.has(v.familyId))
      out.push(
        err(
          p,
          "PROFILE_UNKNOWN_COMPONENT",
          `${kind} '${v.id}' overlays unknown family '${v.familyId}'`,
        ),
      );
    if (v.introductionMonth !== undefined && !MONTH_RE.test(v.introductionMonth))
      out.push(err(p, "PROFILE_BAD_MONTH", `${kind} '${v.id}' introductionMonth is not YYYY-MM`));
    if (v.obsoleteMonth != null && !MONTH_RE.test(v.obsoleteMonth))
      out.push(err(p, "PROFILE_BAD_MONTH", `${kind} '${v.id}' obsoleteMonth is not YYYY-MM`));
    if (
      v.introductionMonth !== undefined &&
      v.obsoleteMonth != null &&
      monthIndex(v.obsoleteMonth) < monthIndex(v.introductionMonth)
    )
      out.push(
        err(
          p,
          "PROFILE_VARIANT_DATE_RANGE",
          `${kind} '${v.id}' obsoleteMonth precedes introductionMonth`,
        ),
      );
    out.push(...placeholderIssues(p, `${kind}.${v.id}`, v.provenance, ctx.release));
  };
  for (const g of profile.gunModels) visitVariant(g, "gunModel");
  for (const v of profile.componentVariants) visitVariant(v, "componentVariant");
  for (const a of profile.ammunitionPatterns)
    out.push(...placeholderIssues(p, `ammunition.${a.id}`, a.provenance, ctx.release));

  // Design weights must cover every opening type and stay positive.
  const opening: ShipTypeId[] = ["B", "CA", "CL", "DD", "KE", "AMC"];
  for (const t of opening) {
    const w = profile.designWeights[t];
    if (w === undefined) {
      out.push(err(p, "PROFILE_DESIGN_WEIGHTS_MISSING", `no design weights for opening type ${t}`));
      continue;
    }
    for (const [k, v] of Object.entries(w))
      if (v <= 0)
        out.push(err(p, "PROFILE_DESIGN_WEIGHT_INVALID", `${t}.${k} = ${v} must be positive`));
  }

  // Procurement shares non-negative; build order covers the opening types.
  for (const [k, v] of Object.entries(profile.procurementPolicy)) {
    if (k === "buildOrder") continue;
    if (typeof v === "number" && v < 0)
      out.push(err(p, "PROFILE_VALUE_RANGE", `procurementPolicy.${k} must be >= 0`));
  }
  for (const t of opening)
    if (!profile.procurementPolicy.buildOrder.includes(t))
      out.push(err(p, "PROFILE_BUILD_ORDER_INCOMPLETE", `procurement buildOrder omits ${t}`));

  // Profile-level provenance.
  out.push(...placeholderIssues(p, "profile", profile.provenance, ctx.release));
  return out;
}

/**
 * The single source of truth for the provenance release rules, shared by the profile lint and the national
 * completeness gate (ADR-0092): a PLACEHOLDER blocks at release, and any non-PLACEHOLDER status must cite at
 * least one source. `subject` names the provenance-bearing field for the message. Never rejects ESTIMATE or
 * BALANCE_TARGET on its own. Deterministic; never throws.
 */
export function placeholderIssues(
  nationId: string,
  subject: string,
  prov: Provenance,
  release: boolean,
): ProfileIssue[] {
  const out: ProfileIssue[] = [];
  if (release && prov.sourceStatus === "PLACEHOLDER")
    out.push(
      err(nationId, "PROFILE_PLACEHOLDER", `${subject} has a PLACEHOLDER provenance at release`),
    );
  if (prov.sources.length === 0 && prov.sourceStatus !== "PLACEHOLDER")
    out.push(err(nationId, "PROFILE_PROVENANCE_MISSING", `${subject} has no source references`));
  return out;
}

/** Validate every profile, plus cross-profile rules (unique nation+activeFrom). */
export function validateNavalProfiles(
  profiles: readonly NationNavalProfile[],
  ctx: NavalProfileValidationContext,
): ProfileIssue[] {
  const out: ProfileIssue[] = [];
  const seen = new Set<string>();
  for (const profile of profiles) {
    out.push(...validateNavalProfile(profile, ctx));
    const key = `${profile.nationId}@${profile.activeFrom}`;
    if (seen.has(key))
      out.push(err(profile.nationId, "PROFILE_DUPLICATE", `duplicate profile for ${key}`));
    seen.add(key);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Comparative differentiation
// ---------------------------------------------------------------------------------------------------------------

/**
 * A short, stable fingerprint of the axes that should make two nations recognisably different. Used by the
 * comparative test and the player-facing explanation; every field is a grounded or balance-target differentiator.
 */
export interface ProfileFingerprint {
  readonly nationId: string;
  readonly postures: readonly string[];
  readonly buildTimeMultiplierBp: number;
  readonly costMultiplierBp: number;
  readonly engagementRangeM: number;
  readonly hePreferenceBp: number;
  readonly riskToleranceBp: number;
  readonly torpedoOnCruisersBp: number;
  readonly enduranceWeightBp: number;
  readonly variantCount: number;
}

export function profileFingerprint(profile: NationNavalProfile): ProfileFingerprint {
  return {
    nationId: profile.nationId,
    postures: [...profile.doctrineProfile.postures].sort(),
    buildTimeMultiplierBp: profile.industrialProfile.buildTimeMultiplierBp,
    costMultiplierBp: profile.industrialProfile.costMultiplierBp,
    engagementRangeM: profile.doctrineProfile.engagementRangeM,
    hePreferenceBp: profile.doctrineProfile.hePreferenceBp,
    riskToleranceBp: profile.softPreferences.riskToleranceBp,
    torpedoOnCruisersBp: profile.softPreferences.torpedoOnCruisersBp,
    enduranceWeightBp: profile.softPreferences.enduranceWeightBp,
    variantCount: profile.gunModels.length + profile.componentVariants.length,
  };
}

/** How many of the fingerprint's axes differ between two profiles (0 = identical character). */
export function fingerprintDistance(a: ProfileFingerprint, b: ProfileFingerprint): number {
  let d = 0;
  if (a.postures.join(",") !== b.postures.join(",")) d++;
  for (const k of [
    "buildTimeMultiplierBp",
    "costMultiplierBp",
    "engagementRangeM",
    "hePreferenceBp",
    "riskToleranceBp",
    "torpedoOnCruisersBp",
    "enduranceWeightBp",
  ] as const)
    if (a[k] !== b[k]) d++;
  return d;
}

// ---------------------------------------------------------------------------------------------------------------
// Player-facing explanation (docs/ships-nation-orientation.md §10)
// ---------------------------------------------------------------------------------------------------------------

/** A plain-language brief a screen can render; every string is derived from the profile, never hard-coded per nation. */
export interface NationProfileBrief {
  readonly nationId: string;
  readonly doctrineSummary: string;
  readonly postures: readonly string[];
  readonly industrialStrengths: readonly string[];
  readonly industrialLimitations: readonly string[];
  readonly preferredComponents: readonly string[];
  readonly importedOrLicensed: readonly string[];
  readonly globalObligations: readonly string[];
  readonly starterPhilosophy: string;
  readonly namingConvention: readonly string[];
}

const pctFaster = (bp: number) => `${Math.round((10_000 - bp) / 100)}%`;
const pctCostlier = (bp: number) => `${Math.round((bp - 10_000) / 100)}%`;

/** Compose the player-facing brief for a profile (deterministic; no UI state). */
export function nationProfileBrief(profile: NationNavalProfile): NationProfileBrief {
  const i = profile.industrialProfile;
  const s = profile.softPreferences;
  const strengths: string[] = [];
  const limitations: string[] = [];
  (i.buildTimeMultiplierBp < 10_000 ? strengths : limitations).push(
    `Shipbuilding runs ${i.buildTimeMultiplierBp < 10_000 ? pctFaster(i.buildTimeMultiplierBp) + " faster" : pctCostlier(i.buildTimeMultiplierBp) + " slower"} than the 1894 norm.`,
  );
  (i.costMultiplierBp <= 10_000 ? strengths : limitations).push(
    `Hulls cost about the standard rate (${i.costMultiplierBp / 100}%).`,
  );
  if (i.heavyGunProduction === "DOMESTIC") strengths.push("Heavy guns are made at home.");
  else limitations.push("Heavy guns depend on foreign supply.");
  if (i.armourPlateProduction === "DOMESTIC")
    strengths.push("Armour plate is rolled domestically.");
  else limitations.push("Armour plate must be imported or licensed.");
  if (i.machineryReliabilityBp >= 9000) strengths.push("Machinery is reliable and standardised.");
  else limitations.push("Machinery is experimental; faults and delays are accepted.");
  if (i.constructionQualityVarianceBp >= 3500)
    limitations.push("Construction quality varies; ships may run overweight.");

  const access = Object.entries(profile.componentAccess);
  const preferred = [
    ...profile.gunModels.map((g) => g.designation),
    ...access.filter(([, a]) => a.status === "DOMESTIC").map(([id]) => id),
  ];
  const imported = access
    .filter(
      ([, a]) =>
        a.status === "LICENSE_BUILT" ||
        a.status === "IMPORTED" ||
        a.status === "CAPTURED_OR_STUDIED",
    )
    .map(([id, a]) => `${id} (${a.status.toLowerCase().replaceAll("_", " ")})`);

  const obligations: string[] = [];
  if (
    profile.doctrineProfile.postures.includes("colonial_presence") ||
    profile.doctrineProfile.postures.includes("distant_water_operations")
  )
    obligations.push("Wide foreign-station and coaling-station commitments.");
  if (s.enduranceWeightBp > 11_000) obligations.push("Long cruising radius is weighted heavily.");
  if (s.enduranceWeightBp < 9_000)
    obligations.push("Regional operations; long endurance is not the priority.");
  if (s.colonialServiceWeightBp > 11_000)
    obligations.push("Colonial service capability is prized.");

  const order = profile.procurementPolicy.buildOrder.join(", ");
  const starterPhilosophy =
    `The AI lays down new ships in the order ${order}, led by ` +
    `${profile.procurementPolicy.cruiserShareBp >= profile.procurementPolicy.torpedoCraftShareBp ? "cruisers" : "torpedo craft"}.`;

  return {
    nationId: profile.nationId,
    doctrineSummary: profile.strategicSituation,
    postures: [...profile.doctrineProfile.postures],
    industrialStrengths: strengths,
    industrialLimitations: limitations,
    preferredComponents: preferred,
    importedOrLicensed: imported,
    globalObligations: obligations,
    starterPhilosophy,
    namingConvention: Object.values(profile.namingPolicy.convention),
  };
}
