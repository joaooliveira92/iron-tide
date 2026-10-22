import type { ShipTypeId } from "./shipTypes.js";

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

export const PROVENANCE_KINDS = [
  "historical_fact",
  "game_conversion",
  "balance_adjustment",
] as const;
export type ProvenanceKind = (typeof PROVENANCE_KINDS)[number];

export interface SourceReference {
  readonly sourceId?: string;
  readonly title: string;
  readonly author?: string;
  readonly year?: number;
  readonly page?: string;
  readonly section?: string;
  readonly archiveOrUrl?: string;
  readonly accessedAt?: string;
}

export interface Derivation {
  readonly sourceValue: string;
  readonly sourceUnit: string;
  readonly conversion: string;
  readonly gameValue: string;
  readonly roundingRule?: string;
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
  readonly note?: string;
}

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
  readonly producer?: string;
  readonly provenance?: Provenance;
}

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

export interface GunModelDef {
  readonly id: string;
  readonly familyId: string;
  readonly designation: string;
  readonly overrides: Readonly<Record<string, string | number | readonly string[]>>;
  readonly mounts: readonly MountType[];
  readonly introductionMonth?: string;
  readonly obsoleteMonth?: string | null;
  readonly provenance: Provenance;
}

export const AMMUNITION_PATTERNS = ["AP", "APC", "CPC", "SAP", "HE", "MELINITE"] as const;
export type AmmunitionPattern = (typeof AMMUNITION_PATTERNS)[number];

export interface AmmunitionPatternDef {
  readonly id: string;
  readonly pattern: AmmunitionPattern;
  readonly penetrationBiasBp: number;
  readonly provenance: Provenance;
}

export interface ComponentVariantDef {
  readonly id: string;
  readonly familyId: string;
  readonly designation: string;
  readonly overrides: Readonly<Record<string, string | number | readonly string[]>>;
  readonly introductionMonth?: string;
  readonly obsoleteMonth?: string | null;
  readonly provenance: Provenance;
}

export interface HardCapabilities {
  readonly maxGunCaliberUm: number;
  readonly maxImportedGunCaliberUm?: number;
  readonly maxArmourThicknessUm: number;
  readonly domesticTorpedoDiameterUm: number;
  readonly hullForms: readonly string[];
  readonly domesticPlants: readonly string[];
  readonly restrictedShipTypes: readonly ShipTypeId[];
  readonly grants: readonly string[];
}

export interface SoftPreferences {
  readonly speedOverArmourBp: number;
  readonly secondaryBatteryWeightBp: number;
  readonly enduranceWeightBp: number;
  readonly riskToleranceBp: number;
  readonly colonialServiceWeightBp: number;
  readonly torpedoOnCruisersBp: number;
  readonly accommodationStandard: "SPARTAN" | "STANDARD" | "GENEROUS";
}

export interface DatedValue {
  readonly fromMonth: string;
  readonly value: number;
}

export interface IndustrialProfile {
  readonly buildTimeMultiplierBp: number;
  readonly costMultiplierBp: number;
  readonly machineryReliabilityBp: number;
  readonly constructionQualityVarianceBp: number;
  readonly maxPracticalDisplacementKg: readonly DatedValue[];
  readonly heavyGunProduction: ComponentAccessStatus;
  readonly armourPlateProduction: ComponentAccessStatus;
  readonly provenance: Provenance;
}

export interface DockDefinition {
  readonly maximumNewConstructionMassKg: number;
  readonly maximumMajorRepairMassKg: number;
  readonly maximumRebuildMassKg: number;
  readonly maximumConversionMassKg: number;
  readonly dimensions?: {
    readonly maxLengthMm: number;
    readonly maxBeamMm: number;
    readonly maxHeaviestComponentKg: number;
  } | null;
  readonly provenance: Provenance;
}

export interface DoctrineProfile {
  readonly engagementRangeM: number;
  readonly hePreferenceBp: number;
  readonly postures: readonly NavalPosture[];
  readonly provenance: Provenance;
}

export interface ResearchPreference {
  readonly field: string;
  readonly priority: number;
}

export interface DesignWeights {
  readonly firepowerBp: number;
  readonly protectionBp: number;
  readonly speedBp: number;
  readonly enduranceBp: number;
  readonly torpedoBp: number;
  readonly reliabilityBp: number;
  readonly colonialBp: number;
  readonly costBp: number;
}

export interface ProcurementPolicy {
  readonly battleLineShareBp: number;
  readonly cruiserShareBp: number;
  readonly torpedoCraftShareBp: number;
  readonly colonialShareBp: number;
  readonly foreignProcurementAppetiteBp: number;
  readonly unprovenTechAppetiteBp: number;
  readonly buildOrder: readonly ShipTypeId[];
}

export interface NamingPolicy {
  readonly stems: Readonly<Partial<Record<ShipTypeId, readonly string[]>>>;
  readonly convention: Readonly<Partial<Record<ShipTypeId, string>>>;
}

export interface NationNavalProfile {
  readonly nationId: string;
  readonly activeFrom: string;
  readonly activeUntil: string | null;
  readonly strategicSituation: string;
  readonly hardCapabilities: HardCapabilities;
  readonly softPreferences: SoftPreferences;
  readonly industrialProfile: IndustrialProfile;
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

export interface ResolvedConstructionModifiers {
  readonly buildTimeMultiplierBp: number;
  readonly costMultiplierBp: number;
  readonly machineryReliabilityBp: number;
  readonly constructionQualityVarianceBp: number;
  readonly maxPracticalDisplacementKg: number;
}

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

export const MODIFIER_MIN_BP = 8500;
export const MODIFIER_MAX_BP = 11500;

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
  readonly release: boolean;
}

const err = (nationId: string, code: string, message: string): ProfileIssue => ({
  nationId,
  code,
  message,
});

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

  for (const r of profile.researchPreferences) {
    if (!ctx.knownResearchFields.has(r.field))
      out.push(err(p, "PROFILE_UNKNOWN_RESEARCH_FIELD", `unknown research field '${r.field}'`));
    if (r.priority < 1 || r.priority > 4)
      out.push(err(p, "PROFILE_VALUE_RANGE", `research priority ${r.priority} outside 1..4`));
  }

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

  for (const [k, v] of Object.entries(profile.procurementPolicy)) {
    if (k === "buildOrder") continue;
    if (typeof v === "number" && v < 0)
      out.push(err(p, "PROFILE_VALUE_RANGE", `procurementPolicy.${k} must be >= 0`));
  }
  for (const t of opening)
    if (!profile.procurementPolicy.buildOrder.includes(t))
      out.push(err(p, "PROFILE_BUILD_ORDER_INCOMPLETE", `procurement buildOrder omits ${t}`));

  out.push(...placeholderIssues(p, "profile", profile.provenance, ctx.release));
  return out;
}

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
