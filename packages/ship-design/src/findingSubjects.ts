import {
  shipTarget,
  type Finding,
  type FindingSubject,
  type FindingTarget,
  type SettingGroup,
} from "./findings.js";

interface RuleMeta {
  readonly settings: SettingGroup;
  readonly ship?: boolean;
  readonly bound?: "min" | "max" | "violated";
  readonly unit?: string;
}

const BY_FORMULA: Readonly<Record<string, Readonly<Record<string, Partial<RuleMeta>>>>> = {
  STABILITY_MARGIN_THIN: {
    "F-S5": { bound: "max", unit: "bp" },
    "F-S6": { bound: "max", unit: "bp" },
  },
  HULL_PROPORTIONS: {
    "F-H2": { bound: "violated", unit: "L/B x100" },
    "F-H5": { bound: "max", unit: "kg" },
  },
  "ARR-OVERLAP": {
    "ARR-VOL": { bound: "max", unit: "L" },
    "ARR-DECK": { bound: "max", unit: "mm²" },
  },
};

const RULES: Readonly<Record<string, RuleMeta>> = {
  "ARR-DUPLICATE-INSTANCE": { settings: "arrangement" },
  "ARR-STATION-OUT-OF-ZONE": { settings: "arrangement", unit: "‰" },
  "ARR-ZONE-NOT-ALLOWED": { settings: "arrangement" },
  "ARR-OVERLAP": { settings: "arrangement" },
  "ARR-TURRET-ON-MACHINERY": { settings: "arrangement" },
  "ARR-MAG-VOLUME": { settings: "arrangement", bound: "max", unit: "L" },
  "ARR-MAG-DIST": { settings: "arrangement", bound: "max", unit: "‰" },
  "ARR-CRITICAL-CONC": { settings: "arrangement", bound: "max", unit: "bp" },
  ARC_OBSTRUCTED: { settings: "arrangement", bound: "max", unit: "°" },
  DIRECTOR_INTERFERENCE: { settings: "arrangement", bound: "min", unit: "‰" },
  FC_INCOMPATIBLE: { settings: "arrangement", bound: "max", unit: "guns" },
  COMPONENT_UNKNOWN: { settings: "arrangement" },
  COMPONENT_OBSOLETE: { settings: "arrangement" },
  PARAM_RANGE: { settings: "arrangement" },
  TECH_UNAVAILABLE: { settings: "arrangement" },
  MAGAZINE_UNPROTECTED: { settings: "armour", bound: "min", unit: "bp" },
  POWER_SHORTFALL: { settings: "arrangement", ship: true, bound: "max", unit: "kW" },
  COOLING_SHORTFALL: { settings: "arrangement", ship: true, bound: "max", unit: "kW" },
  ACCOMMODATION_SHORT: { settings: "arrangement", ship: true, bound: "max", unit: "crew" },
  HULL_DIMENSION_RANGE: { settings: "hull", ship: true, bound: "violated", unit: "mm" },
  HULL_GEOMETRY_INVALID: { settings: "hull", ship: true, bound: "min", unit: "mm" },
  HULL_PROPORTIONS: { settings: "hull", ship: true },
  HULL_BUOYANCY_MISMATCH: { settings: "hull", ship: true, bound: "min", unit: "kg" },
  LOW_RESERVE_BUOYANCY: { settings: "hull", ship: true, bound: "min", unit: "bp" },
  OVERWEIGHT_LIMIT: { settings: "hull", ship: true },
  OVERWEIGHT_UNRECOVERABLE: { settings: "hull", ship: true },
  STABILITY_CAPSIZE: { settings: "hull", ship: true, bound: "min", unit: "mm" },
  STABILITY_LOW: { settings: "hull", ship: true, bound: "min", unit: "mm" },
  STABILITY_STIFF: { settings: "hull", ship: true, bound: "max", unit: "mm" },
  STABILITY_MARGIN_THIN: { settings: "hull", ship: true, bound: "min", unit: "mm" },
  TRIM_BOW_HEAVY: { settings: "arrangement", ship: true },
  TRIM_STERN_HEAVY: { settings: "arrangement", ship: true },
  STRUCTURAL_OVERSTRESS: { settings: "hull", ship: true },
  STRUCTURAL_FAILURE_RISK: { settings: "hull", ship: true },
  SPEED_OUT_OF_RANGE: { settings: "machinery", ship: true, bound: "violated", unit: "kn/1000" },
  PLANT_INSUFFICIENT: { settings: "machinery", ship: true, bound: "min", unit: "kn/1000" },
  RANGE_BELOW_REQUIREMENT: { settings: "machinery", ship: true, bound: "min", unit: "nm" },
  HULL_DRIVEN_BEYOND_FORM: { settings: "machinery", ship: true, bound: "max" },
  CITADEL_INCOMPLETE: { settings: "armour", ship: true, bound: "min", unit: "bp" },
  ARMOUR_INEFFECTIVE_VS_ADVERSARY: { settings: "armour", ship: true },
  ARMOUR_TECH_UNAVAILABLE: { settings: "armour", ship: true },
  ARMOUR_MATERIAL_OBSOLETE: { settings: "armour", ship: true },
  ARMOUR_THICKNESS_UNAVAILABLE: { settings: "armour", ship: true },
  INTENDED_CLASSIFICATION_ILLEGAL: { settings: "brief", ship: true },
  NATURAL_CLASSIFICATION_MISMATCH: { settings: "brief", ship: true },
  NO_NATURAL_CLASSIFICATION_MATCH: { settings: "brief", ship: true },
  NO_FACILITY_FITS: { settings: "hull", ship: true },
  MODERNIZATION_MARGIN_LOW: { settings: "hull", ship: true },
  TREATY_LIMIT_DISPLACEMENT: { settings: "hull", ship: true },
  TREATY_LIMIT_CALIBRE: { settings: "arrangement", ship: true },
  TREATY_LIMIT_CATEGORY: { settings: "brief", ship: true },
  ARMAMENT_ID_INVALID: { settings: "arrangement" },
  ARMAMENT_ID_DUPLICATE: { settings: "arrangement" },
  ARMAMENT_MONTH_INVALID: { settings: "arrangement" },
  ARMAMENT_DATE_ORDER: { settings: "arrangement" },
  ARMAMENT_GUN_FAMILY_MISMATCH: { settings: "arrangement" },
  ARMAMENT_MOUNT_NOT_SUPPORTED: { settings: "arrangement" },
  ARMAMENT_AMMUNITION_INCOMPATIBLE: { settings: "arrangement" },
  ARMAMENT_BEFORE_INTRODUCTION: { settings: "arrangement" },
  ARMAMENT_AFTER_RETIREMENT: { settings: "arrangement" },
  ARMAMENT_TECHNOLOGY_MISSING: { settings: "arrangement" },
  ARMAMENT_ACCESS_UNAVAILABLE: { settings: "arrangement" },
  ARMAMENT_ACCESS_FOREIGN: { settings: "arrangement" },
  ARMAMENT_ACCESS_CONTRADICTION: { settings: "arrangement" },
  ARMAMENT_VALUE_OUT_OF_RANGE: { settings: "arrangement" },
  ARMAMENT_ARITHMETIC_OVERFLOW: { settings: "arrangement" },
  ARMAMENT_PROVENANCE_PLACEHOLDER: { settings: "arrangement" },
  ARMAMENT_PROVENANCE_MISSING: { settings: "arrangement" },
  ARMAMENT_PROVENANCE_INCONSISTENT: { settings: "arrangement" },
  ARMAMENT_REFERENCE_MISSING: { settings: "arrangement" },
  ARMAMENT_DUPLICATE_CONTRADICTORY: { settings: "arrangement" },
  ARMAMENT_NATION_UNKNOWN: { settings: "arrangement" },
  ARMAMENT_COMPAT_DRIFT: { settings: "arrangement" },
};

export const KNOWN_RULES: readonly string[] = Object.keys(RULES);

export function withRuleSubject(f: Finding): Finding {
  const base = RULES[f.id];
  if (!base) return f;
  const meta: RuleMeta = { ...base, ...BY_FORMULA[f.id]?.[f.evidence.formulaId] };
  const targets: readonly FindingTarget[] =
    f.subject && f.subject.targets.length > 0 ? f.subject.targets : meta.ship ? [shipTarget] : [];
  const bound =
    meta.bound === "violated"
      ? f.evidence.value < f.evidence.threshold
        ? "min"
        : "max"
      : meta.bound;
  const subject: FindingSubject = {
    targets,
    settings: f.subject?.settings ?? meta.settings,
    ...(bound !== undefined && { bound }),
    ...(meta.unit !== undefined && { unit: meta.unit }),
  };
  return { ...f, subject };
}
