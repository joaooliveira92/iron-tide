import type {
  CapabilityData,
  EngineeringData,
  FlattenedPart,
  QuantityComponentData,
} from "@bluewave/content-schema";
import { compareCodePoints } from "@bluewave/deterministic";
import { ZONE_IDS } from "./arrangement.js";
import type { ArmourBalance } from "./armour.js";
import { LINE_IDS } from "./construction.js";
import type { PropulsionPlant } from "./machinery.js";
import { armamentMountFor, type AuthoredArmamentContent } from "./armamentContent.js";
import { buildAmmunitionPartModel } from "./ammunitionPartAdapter.js";
import { buildArmourPartModel } from "./armourPartAdapter.js";
import type { ComponentDef } from "./component.js";
import { LEGACY_COMPONENT_SOURCE } from "./component.js";
import { applyComponentOverrides, applyGunModel } from "./componentVariants.js";
import { buildFittingPartModel } from "./fittingPartAdapter.js";
import {
  buildGunMountPart,
  buildGunPartModel,
  isGunMountType,
  isSingleGunMount,
  type FlattenedGunMountPart,
  type FlattenedGunPart,
  type GunMountType,
} from "./gunPartAdapter.js";
import type { NationNavalProfile } from "./nationProfile.js";
import { buildPlantPartModel } from "./plantPartAdapter.js";
import { isAffineIssue, readAffine } from "./partCatalogueFormulas.js";
import { navalProfileFile, buildLauncherPartModel } from "./torpedoPartAdapter.js";
import { buildTorpedoPartModel, type TorpedoModelSource } from "./torpedoPartBuilder.js";
import { num } from "./compileShared.js";

export const GUN_CATEGORIES = [
  "MAIN_GUN",
  "SECONDARY_GUN",
  "DUAL_PURPOSE_GUN",
  "AA_WEAPON",
] as const;

export const LEGACY_COUNT_PARAMETER = {
  gun: "barrels",
  torpedo_launcher: "tubes",
  accommodation: "blocks",
} as const;

export const LEGACY_ROUNDS_PARAMETER = "rounds";

export const ROUNDS_PARAMETER = "rounds";

export type PartCatalogueFailureCode =
  | "PARTCAT_UNMAPPED_FIELD"
  | "PARTCAT_UNKNOWN_TAG"
  | "PARTCAT_UNKNOWN_ATTRIBUTE"
  | "PARTCAT_ATTRIBUTE_NOT_CONSTANT"
  | "PARTCAT_INVALID_VALUE"
  | "PARTCAT_UNSUPPORTED_PARAMETER"
  | "PARTCAT_UNSUPPORTED_OBSOLETE"
  | "PARTCAT_PHYSICAL_INCOMPLETE"
  | "PARTCAT_UNREFERENCED_CONSTANT"
  | "PARTCAT_NO_INTERFACE"
  | "PARTCAT_NO_MOUNT"
  | "PARTCAT_NO_GUN_MODEL"
  | "PARTCAT_UNKNOWN_MOUNT_TYPE"
  | "PARTCAT_CONFLICT"
  | "PARTCAT_DUPLICATE_ID"
  | "PARTCAT_UNKNOWN_UPGRADE_TARGET"
  | "PARTCAT_FORMULA_UNREADABLE"
  | "PARTCAT_FORMULA_PARAMETER_DEPENDENT"
  | "PARTCAT_FORMULA_NONLINEAR"
  | "PARTCAT_FORMULA_INVALID_TERM"
  | "PARTCAT_SOURCE_NOT_READ";

export interface PartCatalogueFailure {
  readonly code: PartCatalogueFailureCode;
  readonly path: string;
  readonly message: string;
}

export interface SourceFieldDestination {
  readonly record: string;
  readonly field: string;
  readonly destination: string;
}

export const PART_SOURCE_FIELDS: readonly SourceFieldDestination[] = [
  { record: "component", field: "id", destination: "part.id | spec.gunFamily" },
  { record: "component", field: "displayName", destination: "part.name | metadata.displayName" },
  {
    record: "component",
    field: "category",
    destination: "part.family + part.provides | spec.weaponCategory",
  },
  {
    record: "component",
    field: "introduction",
    destination: "lifecycle.availableFrom/availableUntil",
  },
  { record: "component", field: "requires", destination: "lifecycle.requires" },
  { record: "component", field: "parameters", destination: "entryUnits | parameters.rounds" },
  { record: "component", field: "constants", destination: "quantities (folded into formulas)" },
  { record: "component", field: "weightKg", destination: "quantities[massKg]" },
  { record: "component", field: "volumeLitre", destination: "quantities[volumeLitre]" },
  { record: "component", field: "costMicro", destination: "quantities[costMicro]" },
  { record: "component", field: "crew", destination: "quantities[crew]" },
  { record: "component", field: "powerKw", destination: "engineering.power.consumption" },
  { record: "component", field: "upgradePath", destination: "successor.lifecycle.supersedes" },
  { record: "component", field: "tags", destination: "metadata.tags" },
  { record: "component", field: "deckFootprintMm2", destination: "quantities[deckFootprintMm2]" },
  { record: "component", field: "heightMm", destination: "engineering.physical.envelopeHeightMm" },
  { record: "component", field: "zCgMm", destination: "engineering.physical.centreOfGravity.zMm" },
  { record: "component", field: "coolingKw", destination: "engineering.cooling.demand" },
  {
    record: "component",
    field: "attributes",
    destination: "spec | capabilities | engineering (per name)",
  },
  { record: "component", field: "allowedZones", destination: "allowedZones" },
  {
    record: "component",
    field: "forbidsCoLocation",
    destination: "(none)",
  },
  { record: "component", field: "critical", destination: "spec.critical" },
  { record: "component", field: "fcClass", destination: "capabilities[fire_control_class]" },
  { record: "component", field: "fcClasses", destination: "capabilities[fire_control_support]" },
  {
    record: "component",
    field: "torpedoMount",
    destination: "spec.launchType + spec.loadsTorpedo",
  },
  {
    record: "component",
    field: "maintenanceMonthlyBp",
    destination: "engineering.maintenance.monthlyBpOfCost",
  },
  { record: "component", field: "buildWorkMicro", destination: "buildWorkMicro" },
  { record: "component", field: "productionLine", destination: "productionLine" },
  { record: "component", field: "provenance", destination: "provenance" },
  { record: "attribute", field: "caliberUm", destination: "spec.calibreUm" },
  { record: "attribute", field: "shellMassG", destination: "spec.shellMassG" },
  { record: "attribute", field: "chargeBp", destination: "spec.propellantChargeBp" },
  { record: "attribute", field: "roundVolumeMl", destination: "spec.roundVolumeMl" },
  {
    record: "attribute",
    field: "rofBaseX100",
    destination: "spec.mechanicalRateOfFireRoundsPerMinuteX100",
  },
  { record: "attribute", field: "beamArcDeg", destination: "spec.beamArcDeg" },
  { record: "attribute", field: "maxFeedPermille", destination: "capabilities[ammunition_feed]" },
  { record: "attribute", field: "magazineLitre", destination: "spec.magazineLitre" },
  { record: "attribute", field: "flashProtectionBp", destination: "spec.flashProtectionBp" },
  { record: "attribute", field: "accuracyBonusBp", destination: "spec.accuracyBonusBp" },
  { record: "attribute", field: "capacity", destination: "spec.gunCapacity" },
  { record: "attribute", field: "genKw", destination: "engineering.power.generation" },
  { record: "attribute", field: "coolingSupplyKw", destination: "engineering.cooling.supply" },
  {
    record: "attribute",
    field: "arcBlockedDeg",
    destination: "capabilities[arc_obstruction].blockedDeg",
  },
  {
    record: "attribute",
    field: "arcReachPermille",
    destination: "capabilities[arc_obstruction].reachPermille",
  },
  { record: "attribute", field: "damageControlBp", destination: "capabilities[damage_control]" },
  {
    record: "attribute",
    field: "flammableBp",
    destination: "engineering.flammability.indexBp",
  },
  { record: "gunFamily", field: "id", destination: "spec.gunFamily" },
  { record: "gunFamily", field: "designation", destination: "part.name (standard model)" },
  { record: "gunFamily", field: "category", destination: "spec.weaponCategory" },
  {
    record: "gunFamily",
    field: "defaultMountType",
    destination: "spec.supportedMountTypes (standard model)",
  },
  { record: "gunFamily", field: "provenance", destination: "provenance (standard model)" },
  { record: "gunModel", field: "id", destination: "part.id" },
  { record: "gunModel", field: "familyId", destination: "spec.gunFamily" },
  { record: "gunModel", field: "nationId", destination: "part.nation" },
  { record: "gunModel", field: "designation", destination: "part.name" },
  { record: "gunModel", field: "supportedMountTypes", destination: "spec.supportedMountTypes" },
  { record: "gunModel", field: "requiredTechnologyIds", destination: "lifecycle.requires" },
  { record: "gunMount", field: "id", destination: "part.id | spec.compiledMountId" },
  { record: "gunMount", field: "compatibleGunFamilies", destination: "spec.compatibleGunFamilies" },
  { record: "gunMount", field: "gunCount", destination: "spec.gunsPerMount (per generated part)" },
  { record: "gunMount", field: "hullSpaceUsageLitre", destination: "spec.hullSpaceUsageLitre" },
  {
    record: "ammunition",
    field: "compatibleGunFamilies",
    destination: "spec.compatibleGunFamilies",
  },
  { record: "ammunition", field: "compatibleGunModelIds", destination: "spec.compatibleGunModels" },
  { record: "ammunition", field: "ammunitionCostMicro", destination: "quantities[round_cost]" },
  {
    record: "profileGunModel",
    field: "overrides.displayName",
    destination: "metadata.displayName",
  },
  {
    record: "profileGunModel",
    field: "overrides.attributes.shellMassG",
    destination: "spec.shellMassG",
  },
  { record: "profileGunModel", field: "mounts", destination: "spec.supportedMountTypes" },
  { record: "profileGunModel", field: "introductionMonth", destination: "lifecycle.availableFrom" },
  { record: "profileGunModel", field: "obsoleteMonth", destination: "lifecycle.availableUntil" },
  {
    record: "profileComponentVariant",
    field: "overrides",
    destination: "variant part (any ComponentDef field)",
  },
];

export interface SourceCatalogue {
  readonly components: readonly ComponentDef[];
  readonly plants: readonly PropulsionPlant[];
  readonly armour: Pick<ArmourBalance, "materialEffBp" | "materialAvailability">;
  readonly armament: AuthoredArmamentContent;
  readonly profiles: readonly NationNavalProfile[];
  readonly tagVocabulary: readonly string[];
  readonly torpedoDiameterUm: (torpedoModelId: string) => number | undefined;
  readonly torpedoModels: readonly TorpedoModelSource[];
}

export interface PartCatalogueInventory {
  readonly parts: number;
  readonly byFamily: Readonly<Record<string, number>>;
  readonly gunModels: {
    readonly standard: number;
    readonly firstClass: number;
    readonly catalogueOnly: number;
    readonly merged: number;
  };
  readonly mounts: {
    readonly total: number;
    readonly authoredRecords: number;
    readonly derivedRecords: number;
    readonly centralBatteries: number;
  };
  readonly launchers: { readonly bases: number; readonly variants: number };
  readonly unmappedFieldsFound: number;
  readonly lifecycleUnifications: readonly string[];
}

export interface BuiltPartCatalogue {
  readonly parts: readonly FlattenedPart[];
  readonly failures: readonly PartCatalogueFailure[];
  readonly inventory: PartCatalogueInventory;
}

const SPEC_ATTRIBUTES = new Set([
  "caliberUm",
  "shellMassG",
  "chargeBp",
  "roundVolumeMl",
  "rofBaseX100",
  "beamArcDeg",
  "magazineLitre",
  "flashProtectionBp",
  "accuracyBonusBp",
  "capacity",
]);
const AFFINE_ATTRIBUTES = new Set(["genKw", "coolingSupplyKw"]);
const ENGINEERING_ATTRIBUTES = new Set(["flammableBp"]);
const CAPABILITY_ATTRIBUTES = new Set([
  "maxFeedPermille",
  "arcBlockedDeg",
  "arcReachPermille",
  "damageControlBp",
]);

type Role = "gun" | "torpedo_launcher" | "fitting";

interface ComponentBlocks {
  readonly entryUnits?: { readonly min: number; readonly max: number; readonly step: number };
  readonly parameters?: Readonly<Record<string, { min: number; max: number; step: number }>>;
  readonly engineering?: EngineeringData;
  readonly capabilities?: readonly CapabilityData[];
  readonly allowedZones?: readonly string[];
  readonly buildWorkMicro?: number;
  readonly productionLine?: string;
  readonly tags: readonly string[];
}

interface BlockResult {
  readonly blocks: ComponentBlocks;
  readonly failures: PartCatalogueFailure[];
}

const isInt = (v: number): boolean => Number.isInteger(v);
const nonNegInt = (v: number): boolean => isInt(v) && v >= 0;

function constantAttribute(
  def: ComponentDef,
  name: string,
  fail: (code: PartCatalogueFailureCode, field: string, message: string) => void,
): number | undefined {
  const src = def.attributes?.[name];
  if (src === undefined) return undefined;
  try {
    return num(src, { ...def.constants });
  } catch {
    fail(
      "PARTCAT_ATTRIBUTE_NOT_CONSTANT",
      `attributes.${name}`,
      `'${src}' is not a constant of the component's constants; the part carries a fixed value.`,
    );
    return undefined;
  }
}

function powerComponents(
  stem: string,
  terms: { readonly fixed: number; readonly perUnit: number },
): { id: string; kind: "powerKw"; value: number; basis: "PER_LOADOUT_ENTRY" | "PER_PART_UNIT" }[] {
  return [
    ...(terms.fixed !== 0
      ? [
          {
            id: `${stem}_fixed`,
            kind: "powerKw" as const,
            value: terms.fixed,
            basis: "PER_LOADOUT_ENTRY" as const,
          },
        ]
      : []),
    { id: stem, kind: "powerKw" as const, value: terms.perUnit, basis: "PER_PART_UNIT" as const },
  ];
}

function componentBlocks(
  def: ComponentDef,
  role: Role,
  countParameter: string | null,
  knownTags: ReadonlySet<string>,
): BlockResult {
  const failures: PartCatalogueFailure[] = [];
  const fail = (code: PartCatalogueFailureCode, field: string, message: string) =>
    failures.push({
      code,
      path: `components.${def.id}${field === "" ? "" : `.${field}`}`,
      message,
    });

  let entryUnits: ComponentBlocks["entryUnits"];
  const parameters: Record<string, { min: number; max: number; step: number }> = {};
  for (const [name, range] of Object.entries(def.parameters)) {
    if (!(isInt(range.min) && isInt(range.max) && isInt(range.step))) {
      fail(
        "PARTCAT_INVALID_VALUE",
        `parameters.${name}`,
        "a parameter range must be whole numbers.",
      );
      continue;
    }
    if (name === countParameter) {
      if (range.min < 1 || range.step < 1) {
        fail("PARTCAT_INVALID_VALUE", `parameters.${name}`, "a unit count starts at 1 or more.");
        continue;
      }
      entryUnits = { min: range.min, max: range.max, step: range.step };
    } else if (role === "gun" && name === LEGACY_ROUNDS_PARAMETER) {
      parameters[ROUNDS_PARAMETER] = { min: range.min, max: range.max, step: range.step };
    } else {
      fail(
        "PARTCAT_UNSUPPORTED_PARAMETER",
        `parameters.${name}`,
        `parameter '${name}' has no destination for a ${role} component.`,
      );
    }
  }

  for (const name of Object.keys(def.attributes ?? {})) {
    if (
      !(
        SPEC_ATTRIBUTES.has(name) ||
        AFFINE_ATTRIBUTES.has(name) ||
        ENGINEERING_ATTRIBUTES.has(name) ||
        CAPABILITY_ATTRIBUTES.has(name)
      )
    ) {
      fail(
        "PARTCAT_UNKNOWN_ATTRIBUTE",
        `attributes.${name}`,
        `attribute '${name}' has no destination in the part schema.`,
      );
    }
  }
  let allowedZones: ComponentBlocks["allowedZones"];
  if (def.allowedZones !== undefined) {
    const zones = def.allowedZones.filter((z): z is (typeof ZONE_IDS)[number] =>
      (ZONE_IDS as readonly string[]).includes(z),
    );
    if (zones.length !== def.allowedZones.length || new Set(zones).size !== zones.length) {
      fail(
        "PARTCAT_INVALID_VALUE",
        "allowedZones",
        "allowedZones must be unique zone ids from the closed set.",
      );
    } else if (zones.length === 0) {
      fail("PARTCAT_INVALID_VALUE", "allowedZones", "an empty zone list has no destination.");
    } else {
      allowedZones = zones;
    }
  }
  let buildWorkMicro: ComponentBlocks["buildWorkMicro"];
  if (def.buildWorkMicro !== undefined) {
    try {
      const value = num(def.buildWorkMicro, { ...def.constants });
      if (!nonNegInt(value)) {
        fail(
          "PARTCAT_INVALID_VALUE",
          "buildWorkMicro",
          `'${def.buildWorkMicro}' evaluates to ${value}, not a whole work amount.`,
        );
      } else {
        buildWorkMicro = value;
      }
    } catch {
      fail(
        "PARTCAT_FORMULA_PARAMETER_DEPENDENT",
        "buildWorkMicro",
        `'${def.buildWorkMicro}' reads a parameter; authored build work is fixed.`,
      );
    }
  }
  let productionLine: ComponentBlocks["productionLine"];
  if (def.productionLine !== undefined) {
    if (
      def.productionLine === "fit_out" ||
      (LINE_IDS as readonly string[]).includes(def.productionLine)
    ) {
      productionLine = def.productionLine;
    } else {
      fail(
        "PARTCAT_INVALID_VALUE",
        "productionLine",
        `'${def.productionLine}' is not a production line.`,
      );
    }
  }
  if (def.forbidsCoLocation !== undefined) {
    fail(
      "PARTCAT_UNMAPPED_FIELD",
      "forbidsCoLocation",
      "a legacy category list has no faithful interface-equivalent destination; not authored.",
    );
  }

  const tags = [...new Set(def.tags)].sort(compareCodePoints);
  for (const tag of tags) {
    if (!knownTags.has(tag)) {
      fail("PARTCAT_UNKNOWN_TAG", "tags", `tag '${tag}' is outside the closed tag vocabulary.`);
    }
  }

  const affine = (field: string, src: string) => {
    const terms = readAffine(def, field, src, countParameter);
    if (isAffineIssue(terms)) {
      fail(terms.code, field, terms.message);
      return undefined;
    }
    return terms;
  };
  let engineering: { -readonly [K in keyof EngineeringData]: EngineeringData[K] } = {};
  const constants: Record<string, number> = { ...def.constants };
  const physicalAt = (field: "heightMm" | "zCgMm"): number | undefined => {
    const src = def[field];
    if (src === undefined) return undefined;
    try {
      const value = num(src, constants);
      if (!nonNegInt(value)) {
        fail("PARTCAT_INVALID_VALUE", field, `'${src}' evaluates to ${value}, not a whole length.`);
        return undefined;
      }
      return value;
    } catch {
      fail(
        "PARTCAT_FORMULA_PARAMETER_DEPENDENT",
        field,
        `'${src}' reads a parameter; a length is fixed.`,
      );
      return undefined;
    }
  };
  const height = physicalAt("heightMm");
  const zCg = physicalAt("zCgMm");
  if ((height === undefined) !== (zCg === undefined) && failures.length === 0) {
    fail(
      "PARTCAT_PHYSICAL_INCOMPLETE",
      def.heightMm === undefined ? "heightMm" : "zCgMm",
      "height and centre of gravity are authored together.",
    );
  }
  if (height !== undefined && zCg !== undefined) {
    engineering = {
      ...engineering,
      physical: {
        envelopeHeightMm: height,
        centreOfGravity: { zMm: zCg, datum: "PART_BASE" },
      },
    };
  }
  const consumption = affine("powerKw", def.powerKw);
  const generationSrc = def.attributes?.["genKw"];
  const generation =
    generationSrc === undefined ? undefined : affine("attributes.genKw", generationSrc);
  if (consumption !== undefined || generation !== undefined) {
    engineering = {
      ...engineering,
      power: {
        ...(consumption !== undefined
          ? { consumption: powerComponents("power", consumption) }
          : {}),
        ...(generation !== undefined
          ? { generation: powerComponents("generation", generation) }
          : {}),
      },
    };
  }
  const demand = def.coolingKw === undefined ? undefined : affine("coolingKw", def.coolingKw);
  const supplySrc = def.attributes?.["coolingSupplyKw"];
  const supply =
    supplySrc === undefined ? undefined : affine("attributes.coolingSupplyKw", supplySrc);
  if (demand !== undefined || supply !== undefined) {
    engineering = {
      ...engineering,
      cooling: {
        ...(demand !== undefined ? { demand: powerComponents("cooling", demand) } : {}),
        ...(supply !== undefined ? { supply: powerComponents("cooling_supply", supply) } : {}),
      },
    };
  }
  if (def.maintenanceMonthlyBp !== undefined) {
    if (!(nonNegInt(def.maintenanceMonthlyBp) && def.maintenanceMonthlyBp <= 10_000)) {
      fail("PARTCAT_INVALID_VALUE", "maintenanceMonthlyBp", "must be 0..10000 basis points.");
    } else {
      engineering = {
        ...engineering,
        maintenance: { monthlyBpOfCost: def.maintenanceMonthlyBp },
      };
    }
  }
  const flammability = constantAttribute(def, "flammableBp", fail);
  if (flammability !== undefined) {
    if (nonNegInt(flammability) && flammability <= 10_000) {
      engineering = { ...engineering, flammability: { indexBp: flammability } };
    } else {
      fail(
        "PARTCAT_INVALID_VALUE",
        "attributes.flammableBp",
        `${flammability} is not 0..10000 bp.`,
      );
    }
  }

  const capabilities: CapabilityData[] = [];
  const classes = ["heavy", "medium", "light"] as const;
  const asClass = (value: string, field: string) => {
    const found = classes.find((c) => c === value);
    if (found === undefined) {
      fail("PARTCAT_INVALID_VALUE", field, `'${value}' is not a fire-control class.`);
    }
    return found;
  };
  if (def.fcClass !== undefined) {
    const c = asClass(def.fcClass, "fcClass");
    if (c !== undefined) capabilities.push({ kind: "fire_control_class", class: c });
  }
  if (def.fcClasses !== undefined) {
    const list = def.fcClasses.map((v, i) => asClass(v, `fcClasses.${i}`));
    const ok = list.filter((c): c is (typeof classes)[number] => c !== undefined);
    if (ok.length === list.length && ok.length > 0) {
      capabilities.push({ kind: "fire_control_support", classes: ok });
    } else if (list.length === 0) {
      fail("PARTCAT_INVALID_VALUE", "fcClasses", "an empty class list has no destination.");
    }
  }
  const feed = constantAttribute(def, "maxFeedPermille", fail);
  if (feed !== undefined) {
    if (nonNegInt(feed) && feed <= 1000)
      capabilities.push({ kind: "ammunition_feed", maxFeedPermille: feed });
    else fail("PARTCAT_INVALID_VALUE", "attributes.maxFeedPermille", `${feed} is not 0..1000.`);
  }
  const blocked = constantAttribute(def, "arcBlockedDeg", fail);
  const reach = constantAttribute(def, "arcReachPermille", fail);
  if (blocked !== undefined || reach !== undefined) {
    if (blocked === undefined) {
      fail(
        "PARTCAT_UNMAPPED_FIELD",
        "attributes.arcReachPermille",
        "a reach without a blocked sector has no destination.",
      );
    } else if (!(isInt(blocked) && blocked >= 0 && blocked <= 360)) {
      fail(
        "PARTCAT_INVALID_VALUE",
        "attributes.arcBlockedDeg",
        `${blocked} is not 0..360 degrees.`,
      );
    } else if (reach !== undefined && !(nonNegInt(reach) && reach <= 1000)) {
      fail("PARTCAT_INVALID_VALUE", "attributes.arcReachPermille", `${reach} is not 0..1000.`);
    } else if (blocked > 0) {
      capabilities.push({
        kind: "arc_obstruction",
        blockedDeg: blocked,
        reachPermille: reach ?? 0,
      });
    } else if (reach !== undefined) {
      fail(
        "PARTCAT_UNMAPPED_FIELD",
        "attributes.arcReachPermille",
        "a reach with a zero blocked sector has no destination.",
      );
    } else {
      fail(
        "PARTCAT_UNMAPPED_FIELD",
        "attributes.arcBlockedDeg",
        "a zero blocked sector has no destination (it obstructs nothing).",
      );
    }
  }
  const dc = constantAttribute(def, "damageControlBp", fail);
  if (dc !== undefined) {
    if (nonNegInt(dc) && dc <= 10_000) capabilities.push({ kind: "damage_control", effectBp: dc });
    else fail("PARTCAT_INVALID_VALUE", "attributes.damageControlBp", `${dc} is not 0..10000 bp.`);
  }
  capabilities.sort((a, b) => compareCodePoints(a.kind, b.kind));

  return {
    failures,
    blocks: {
      ...(entryUnits !== undefined ? { entryUnits } : {}),
      ...(Object.keys(parameters).length > 0 ? { parameters } : {}),
      ...(Object.keys(engineering).length > 0 ? { engineering } : {}),
      ...(capabilities.length > 0 ? { capabilities } : {}),
      ...(allowedZones !== undefined ? { allowedZones } : {}),
      ...(buildWorkMicro !== undefined ? { buildWorkMicro } : {}),
      ...(productionLine !== undefined ? { productionLine } : {}),
      tags,
    },
  };
}

function withBlocks<T extends FlattenedPart>(
  part: T,
  blocks: ComponentBlocks,
  displayName: string | undefined,
): T {
  return {
    ...part,
    ...(blocks.entryUnits !== undefined ? { entryUnits: blocks.entryUnits } : {}),
    ...(blocks.parameters !== undefined ? { parameters: blocks.parameters } : {}),
    ...(blocks.engineering !== undefined ? { engineering: blocks.engineering } : {}),
    ...(blocks.capabilities !== undefined ? { capabilities: [...blocks.capabilities] } : {}),
    ...(blocks.allowedZones !== undefined ? { allowedZones: [...blocks.allowedZones] } : {}),
    ...(blocks.buildWorkMicro !== undefined ? { buildWorkMicro: blocks.buildWorkMicro } : {}),
    ...(blocks.productionLine !== undefined ? { productionLine: blocks.productionLine } : {}),
    metadata: {
      ...(displayName !== undefined ? { displayName } : {}),
      ...(blocks.tags.length > 0 ? { tags: blocks.tags as never } : {}),
    },
  };
}

const isGunCategory = (c: string): boolean => (GUN_CATEGORIES as readonly string[]).includes(c);

function weaponCategoryOf(c: string): FlattenedGunPart["spec"]["weaponCategory"] {
  return GUN_CATEGORIES.find((g) => g === c);
}

export function standardGunPartId(familyId: string): string {
  return `standard_${familyId}`;
}

export function centralBatteryPartId(familyId: string, guns: number): string {
  return `${familyId}_central_battery_${guns}`;
}

export function mountPartIdFor(recordId: string, guns: number): string {
  return guns === 1 ? recordId : `${recordId}_x${guns}`;
}

const sortParts = (parts: readonly FlattenedPart[]): FlattenedPart[] =>
  [...parts].sort((a, b) => compareCodePoints(a.id, b.id));

export function buildPartCatalogue(source: SourceCatalogue): BuiltPartCatalogue {
  const failures: PartCatalogueFailure[] = [];
  const parts = new Map<string, FlattenedPart>();
  const lifecycleUnifications: string[] = [];
  const knownTags: ReadonlySet<string> = new Set(source.tagVocabulary);
  const add = (part: FlattenedPart, path: string): void => {
    const prev = parts.get(part.id);
    if (prev === undefined) {
      parts.set(part.id, part);
      return;
    }
    if (JSON.stringify(prev) !== JSON.stringify(part)) {
      failures.push({
        code: "PARTCAT_DUPLICATE_ID",
        path,
        message: `generated id '${part.id}' is produced twice with different content.`,
      });
    }
  };
  const addFailures = (list: readonly PartCatalogueFailure[]) => failures.push(...list);

  const components = [...source.components].sort((a, b) => compareCodePoints(a.id, b.id));
  const profiles = [...source.profiles].sort((a, b) => compareCodePoints(a.nationId, b.nationId));
  const componentById = new Map(components.map((c) => [c.id, c]));

  const families = [...source.armament.gunFamilies].sort((a, b) => compareCodePoints(a.id, b.id));
  const familyBlocks = new Map<string, ComponentBlocks>();
  const familyDef = new Map<string, ComponentDef>();
  const mountTypesOf = new Map<string, Set<GunMountType>>();
  const noteMountType = (familyId: string, type: string, path: string) => {
    if (!isGunMountType(type as never)) {
      failures.push({
        code: "PARTCAT_UNKNOWN_MOUNT_TYPE",
        path,
        message: `mount type '${type}' is not a gun mount type.`,
      });
      return;
    }
    const set = mountTypesOf.get(familyId) ?? new Set<GunMountType>();
    set.add(type as GunMountType);
    mountTypesOf.set(familyId, set);
  };
  const gunPartAddOns = (
    part: FlattenedGunPart,
    def: ComponentDef,
    blocks: ComponentBlocks,
    extra: {
      readonly supportedMountTypes: readonly string[];
      readonly firstClass: boolean;
      readonly displayName: string | undefined;
      readonly standard: boolean;
    },
  ): FlattenedGunPart => {
    const beam = constantAttribute(def, "beamArcDeg", () => undefined);
    const types = extra.supportedMountTypes.filter((t): t is GunMountType =>
      isGunMountType(t as never),
    );
    const spec = {
      ...part.spec,
      gunFamily: def.id,
      weaponCategory: weaponCategoryOf(def.category),
      ...(beam !== undefined ? { beamArcDeg: beam } : {}),
      ...(types.length > 0 ? { supportedMountTypes: types } : {}),
      ...(extra.firstClass ? { firstClassArmament: true as const } : {}),
    };
    return withBlocks({ ...part, spec }, blocks, extra.displayName);
  };

  for (const family of families) {
    const def = componentById.get(family.id);
    if (def === undefined) {
      failures.push({
        code: "PARTCAT_NO_GUN_MODEL",
        path: `gunFamilies.${family.id}`,
        message: `gun family '${family.id}' has no component of that id.`,
      });
      continue;
    }
    if (!isGunCategory(def.category)) {
      failures.push({
        code: "PARTCAT_INVALID_VALUE",
        path: `components.${def.id}.category`,
        message: `category '${def.category}' is not a gun category.`,
      });
      continue;
    }
    if (def.introduction.obsoleteMonth !== null) {
      failures.push({
        code: "PARTCAT_UNSUPPORTED_OBSOLETE",
        path: `components.${def.id}.introduction.obsoleteMonth`,
        message:
          "a gun family's standard model reads its obsolete month as an inclusive retirement; the " +
          "part lifecycle is exclusive, so a dated end needs an owner decision.",
      });
      continue;
    }
    const built = componentBlocks(def, "gun", LEGACY_COUNT_PARAMETER.gun, knownTags);
    addFailures(built.failures);
    familyBlocks.set(def.id, built.blocks);
    familyDef.set(def.id, def);
    noteMountType(def.id, family.defaultMountType, `gunFamilies.${family.id}.defaultMountType`);

    const model = buildGunPartModel({
      content: { ...source.armament, gunModels: [] },
      components,
      requests: [{ nationId: "standard", familyId: def.id }],
    });
    const standard = model.parts[0];
    if (standard === undefined) {
      failures.push({
        code: "PARTCAT_NO_GUN_MODEL",
        path: `gunFamilies.${family.id}`,
        message: `no standard model could be derived for family '${family.id}'.`,
      });
      continue;
    }
    add(
      gunPartAddOns(standard, def, built.blocks, {
        supportedMountTypes: [family.defaultMountType],
        firstClass: false,
        displayName: def.displayName,
        standard: true,
      }),
      `gunFamilies.${family.id}`,
    );
  }

  const profileModels = profiles.flatMap((p) =>
    p.gunModels.map((model) => ({ nationId: p.nationId, model })),
  );
  const mergedProfileIds = new Set<string>();
  for (const authored of [...source.armament.gunModels].sort((a, b) =>
    compareCodePoints(a.id, b.id),
  )) {
    const def = familyDef.get(authored.familyId);
    const blocks = familyBlocks.get(authored.familyId);
    if (def === undefined || blocks === undefined) continue;
    const request = [{ nationId: authored.nationId, familyId: authored.familyId }];
    const part = buildGunPartModel({
      content: source.armament,
      components,
      requests: request,
    }).parts.find((p) => p.id === authored.id);
    if (part === undefined) {
      failures.push({
        code: "PARTCAT_NO_GUN_MODEL",
        path: `gunModels.${authored.id}`,
        message: `authored model '${authored.id}' was not read.`,
      });
      continue;
    }
    for (const t of authored.supportedMountTypes) {
      noteMountType(authored.familyId, t, `gunModels.${authored.id}.supportedMountTypes`);
    }
    const overlay = profileModels.find((p) => p.model.id === authored.id);
    let displayName: string | undefined;
    let merged = part;
    if (overlay !== undefined) {
      mergedProfileIds.add(authored.id);
      const o = overlay.model;
      const path = `profiles.${overlay.nationId}.gunModels.${o.id}`;
      const dn = o.overrides["displayName"];
      if (typeof dn === "string") displayName = dn;
      const shell = o.overrides["attributes.shellMassG"];
      if (
        shell !== undefined &&
        authored.shellMassG !== undefined &&
        Number(shell) !== authored.shellMassG
      ) {
        failures.push({
          code: "PARTCAT_CONFLICT",
          path: `${path}.overrides.attributes.shellMassG`,
          message: `profile shellMassG ${String(shell)} differs from armament shellMassG ${authored.shellMassG}.`,
        });
      }
      if (JSON.stringify([...o.mounts]) !== JSON.stringify([...authored.supportedMountTypes])) {
        failures.push({
          code: "PARTCAT_CONFLICT",
          path: `${path}.mounts`,
          message: `profile mounts [${o.mounts.join(", ")}] differ from armament [${authored.supportedMountTypes.join(", ")}].`,
        });
      }
      if (o.introductionMonth !== undefined && o.introductionMonth !== authored.introductionMonth) {
        failures.push({
          code: "PARTCAT_CONFLICT",
          path: `${path}.introductionMonth`,
          message: `profile introduction ${o.introductionMonth} differs from armament ${String(authored.introductionMonth)}.`,
        });
      }
      if (o.introductionMonth === undefined && authored.introductionMonth !== undefined) {
        lifecycleUnifications.push(
          `${authored.id}: catalogue floor was the family's ${def.introduction.fromMonth}; now ${authored.introductionMonth}`,
        );
      }
      const known = new Set(["displayName", "attributes.shellMassG"]);
      for (const key of Object.keys(o.overrides)) {
        if (!known.has(key)) {
          failures.push({
            code: "PARTCAT_UNMAPPED_FIELD",
            path: `${path}.overrides.${key}`,
            message: `override '${key}' of a gun model has no destination.`,
          });
        }
      }
      merged = {
        ...part,
        provenance: part.provenance,
      };
    }
    add(
      gunPartAddOns(merged, def, blocks, {
        supportedMountTypes: authored.supportedMountTypes,
        firstClass: true,
        displayName,
        standard: false,
      }),
      `gunModels.${authored.id}`,
    );
  }

  for (const { nationId, model } of profileModels) {
    if (mergedProfileIds.has(model.id)) continue;
    const path = `profiles.${nationId}.gunModels.${model.id}`;
    const base = familyDef.get(model.familyId);
    const blocks = familyBlocks.get(model.familyId);
    if (base === undefined || blocks === undefined) {
      failures.push({
        code: "PARTCAT_NO_GUN_MODEL",
        path,
        message: `profile model '${model.id}' overlays unknown family '${model.familyId}'.`,
      });
      continue;
    }
    const known = new Set(["displayName", "attributes.shellMassG"]);
    for (const key of Object.keys(model.overrides)) {
      if (!known.has(key) && !key.startsWith("attributes.") && !key.startsWith("constants.")) {
        failures.push({
          code: "PARTCAT_UNMAPPED_FIELD",
          path: `${path}.overrides.${key}`,
          message: `override '${key}' of a gun model has no destination.`,
        });
      }
    }
    const overlaid = applyGunModel(base, model);
    const derived = buildGunPartModel({
      content: { ...source.armament, gunModels: [] },
      components: [overlaid],
      requests: [{ nationId, familyId: base.id }],
    }).parts[0];
    if (derived === undefined) continue;
    for (const t of model.mounts) noteMountType(base.id, t, `${path}.mounts`);
    const overlaidBlocks = componentBlocks(overlaid, "gun", LEGACY_COUNT_PARAMETER.gun, knownTags);
    addFailures(overlaidBlocks.failures.filter((f) => !familyBlocks.has(f.path)));
    const dn = model.overrides["displayName"];
    add(
      gunPartAddOns(
        {
          ...derived,
          id: model.id,
          name: model.designation,
          nation: nationId,
          lifecycle: {
            availableFrom: overlaid.introduction.fromMonth,
            availableUntil: overlaid.introduction.obsoleteMonth,
            ...(overlaid.requires.length > 0 ? { requires: [...overlaid.requires] } : {}),
          },
          origin: {
            sourceFile: navalProfileFile(nationId),
            prototype: {
              id: standardGunPartId(base.id),
              sourceFile: base.sourceFile ?? LEGACY_COMPONENT_SOURCE,
              inheritedSpec: [],
              inheritedQuantities: [],
            },
          },
          provenance: {
            ...model.provenance,
            sources: model.provenance.sources.map((s) => ({ ...s })),
          },
        },
        overlaid,
        overlaidBlocks.blocks,
        {
          supportedMountTypes: model.mounts,
          firstClass: false,
          displayName: typeof dn === "string" ? dn : undefined,
          standard: false,
        },
      ),
      path,
    );
  }

  let authoredRecords = 0;
  let derivedRecords = 0;
  const batteryIds = new Set<string>();
  for (const family of families) {
    const def = familyDef.get(family.id);
    const blocks = familyBlocks.get(family.id);
    if (def === undefined || blocks === undefined) continue;
    const types = [...(mountTypesOf.get(family.id) ?? [])].sort(compareCodePoints);
    const range = def.parameters[LEGACY_COUNT_PARAMETER.gun];
    if (range === undefined) {
      failures.push({
        code: "PARTCAT_UNSUPPORTED_PARAMETER",
        path: `components.${def.id}.parameters.barrels`,
        message: "a gun family declares a barrels range so its mounts can be enumerated.",
      });
      continue;
    }
    const counts: number[] = [];
    for (let v = range.min; v <= range.max; v += range.step) counts.push(v);
    for (const type of types) {
      const record = armamentMountFor(source.armament, components, family.id, type, 1);
      if (record === null) {
        failures.push({
          code: "PARTCAT_NO_MOUNT",
          path: `gunMounts.${family.id}.${type}`,
          message: `no ${type} mount record or derivation for family '${family.id}'.`,
        });
        continue;
      }
      const authored = source.armament.gunMounts.some((m) => m.id === String(record.id));
      if (authored) authoredRecords += 1;
      else derivedRecords += 1;
      for (const barrels of counts) {
        const built = buildGunMountPart({
          content: source.armament,
          components,
          familyId: family.id,
          legacyMountType: type,
          barrels,
        });
        if (built === null) continue;
        addFailures(
          built.quantityIssues.map((i) => ({
            code: i.code as PartCatalogueFailureCode,
            path: `components.${i.componentId}.${i.field}`,
            message: i.message,
          })),
        );
        const isBattery = built.disposition !== null;
        const gpm = built.part.spec.gunsPerMount;
        const id =
          isBattery || isSingleGunMount(type)
            ? built.part.id
            : mountPartIdFor(built.legacyMountId, gpm);
        if (isBattery) {
          if (batteryIds.has(id)) continue;
          batteryIds.add(id);
        }
        const spec: FlattenedGunMountPart["spec"] = {
          ...built.part.spec,
          ...(record.compatibleGunFamilies !== undefined && record.compatibleGunFamilies.length > 0
            ? { compatibleGunFamilies: record.compatibleGunFamilies.map(String) }
            : {}),
          ...(record.hullSpaceUsageLitre !== undefined
            ? { hullSpaceUsageLitre: record.hullSpaceUsageLitre }
            : {}),
          ...(!isBattery && id !== built.legacyMountId
            ? { compiledMountId: built.legacyMountId }
            : {}),
        };
        add({ ...built.part, id, name: id, spec }, `gunMounts.${family.id}.${type}.x${barrels}`);
      }
    }
  }

  for (const record of buildAmmunitionPartModel({ ammunition: source.armament.ammunition })
    .records) {
    const { legacy } = record;
    const spec = {
      ...record.part.spec,
      ...(legacy.compatibleGunFamilies !== undefined && legacy.compatibleGunFamilies.length > 0
        ? { compatibleGunFamilies: [...legacy.compatibleGunFamilies] }
        : {}),
      ...(legacy.compatibleGunModelIds !== undefined && legacy.compatibleGunModelIds.length > 0
        ? { compatibleGunModels: [...legacy.compatibleGunModelIds] }
        : {}),
    };
    add({ ...record.part, spec }, `ammunition.${record.part.id}`);
  }
  for (const u of buildAmmunitionPartModel({ ammunition: source.armament.ammunition }).unread) {
    failures.push({
      code: "PARTCAT_SOURCE_NOT_READ",
      path: `ammunition.${u.id}`,
      message: u.message,
    });
  }

  const launchers = buildLauncherPartModel({
    components,
    profiles,
    torpedoDiameterUm: source.torpedoDiameterUm,
  });
  for (const u of launchers.unread) {
    failures.push({
      code: "PARTCAT_SOURCE_NOT_READ",
      path: `launchers.${u.id}`,
      message: u.message,
    });
  }
  let launcherBases = 0;
  let launcherVariants = 0;
  for (const part of launchers.parts) {
    const isVariant = part.origin.prototype !== undefined;
    if (isVariant) launcherVariants += 1;
    else launcherBases += 1;
    const baseDef = componentById.get(isVariant ? (part.origin.prototype?.id ?? part.id) : part.id);
    if (baseDef === undefined || baseDef.torpedoMount === undefined) continue;
    let def = baseDef;
    let nation: NationNavalProfile | undefined;
    if (isVariant) {
      nation = profiles.find((p) => p.nationId === part.nation);
      const variant = nation?.componentVariants.find((v) => v.id === part.id);
      if (variant === undefined) continue;
      def = applyComponentOverrides(baseDef, variant.overrides);
    }
    const built = componentBlocks(
      def,
      "torpedo_launcher",
      LEGACY_COUNT_PARAMETER.torpedo_launcher,
      knownTags,
    );
    addFailures(
      built.failures.map((f) => (isVariant ? { ...f, path: `${f.path}@${part.id}` } : f)),
    );
    const dn =
      isVariant && nation !== undefined
        ? nation.componentVariants.find((v) => v.id === part.id)?.overrides["displayName"]
        : undefined;
    const spec = { ...part.spec, loadsTorpedo: baseDef.torpedoMount.torpedoModelId };
    add(
      withBlocks(
        { ...part, spec } as FlattenedPart,
        built.blocks,
        isVariant ? (typeof dn === "string" ? dn : undefined) : undefined,
      ),
      `launchers.${part.id}`,
    );
  }

  const torpedoes = buildTorpedoPartModel({ models: source.torpedoModels });
  for (const u of torpedoes.unread) {
    failures.push({
      code: "PARTCAT_SOURCE_NOT_READ",
      path: `torpedoes.${u.id}`,
      message: `${u.code}: ${u.message}`,
    });
  }
  for (const part of torpedoes.parts) add(part, `torpedoes.${part.id}`);

  const fittings = buildFittingPartModel({ components });
  for (const u of fittings.unread) {
    failures.push({
      code:
        u.code === "PART_READ_PATH_NO_INTERFACE"
          ? "PARTCAT_NO_INTERFACE"
          : "PARTCAT_SOURCE_NOT_READ",
      path: `components.${u.id}`,
      message: u.message,
    });
  }
  for (const record of fittings.records) {
    const def = record.legacy;
    const interfaceRole = record.part.provides === "accommodation" ? "accommodation" : "fitting";
    const countParameter =
      interfaceRole === "accommodation" ? LEGACY_COUNT_PARAMETER.accommodation : null;
    if (record.countParameter !== null && record.countParameter !== countParameter) {
      failures.push({
        code: "PARTCAT_UNSUPPORTED_PARAMETER",
        path: `components.${def.id}.parameters.${record.countParameter}`,
        message: `a ${record.part.provides} component counts by '${countParameter ?? "nothing"}'.`,
      });
      continue;
    }
    const built = componentBlocks(def, "fitting", countParameter, knownTags);
    addFailures(built.failures);
    add(withBlocks(record.part, built.blocks, undefined), `components.${def.id}`);
  }

  for (const part of buildPlantPartModel({ plants: source.plants }).parts)
    add(part, `plants.${part.id}`);
  for (const u of buildPlantPartModel({ plants: source.plants }).unread) {
    failures.push({ code: "PARTCAT_SOURCE_NOT_READ", path: `plants.${u.id}`, message: u.message });
  }
  const armour = buildArmourPartModel({ armour: source.armour });
  for (const part of armour.parts) add(part, `armour.${part.id}`);
  for (const u of armour.unread) {
    failures.push({ code: "PARTCAT_SOURCE_NOT_READ", path: `armour.${u.id}`, message: u.message });
  }

  const partOfComponent = (id: string): string | undefined => {
    const def = componentById.get(id);
    if (def === undefined) return undefined;
    return isGunCategory(def.category) ? standardGunPartId(id) : id;
  };
  for (const def of components) {
    for (const target of def.upgradePath) {
      const successor = partOfComponent(target);
      const predecessor = partOfComponent(def.id);
      const part = successor === undefined ? undefined : parts.get(successor);
      if (successor === undefined || predecessor === undefined || part === undefined) {
        failures.push({
          code: "PARTCAT_UNKNOWN_UPGRADE_TARGET",
          path: `components.${def.id}.upgradePath`,
          message: `upgrade target '${target}' is not a part of the catalogue.`,
        });
        continue;
      }
      const supersedes = [...new Set([...(part.lifecycle.supersedes ?? []), predecessor])].sort(
        compareCodePoints,
      );
      parts.set(part.id, {
        ...part,
        lifecycle: { ...part.lifecycle, supersedes },
      } as FlattenedPart);
    }
  }

  const sorted = sortParts([...parts.values()]);
  const byFamily: Record<string, number> = {};
  for (const p of sorted) byFamily[p.family] = (byFamily[p.family] ?? 0) + 1;
  const guns = sorted.filter((p): p is FlattenedGunPart => p.family === "gun");
  const inventory: PartCatalogueInventory = {
    parts: sorted.length,
    byFamily,
    gunModels: {
      standard: guns.filter((g) => g.id.startsWith("standard_")).length,
      firstClass: guns.filter((g) => g.spec.firstClassArmament === true).length,
      catalogueOnly: guns.filter(
        (g) => !g.id.startsWith("standard_") && g.spec.firstClassArmament !== true,
      ).length,
      merged: mergedProfileIds.size,
    },
    mounts: {
      total: sorted.filter((p) => p.family === "gun_mount").length,
      authoredRecords,
      derivedRecords,
      centralBatteries: sorted.filter(
        (p) => p.family === "gun_mount" && p.id.includes("_central_battery_"),
      ).length,
    },
    launchers: { bases: launcherBases, variants: launcherVariants },
    unmappedFieldsFound: failures.filter((f) => f.code === "PARTCAT_UNMAPPED_FIELD").length,
    lifecycleUnifications: lifecycleUnifications.sort(compareCodePoints),
  };
  return {
    parts: sorted,
    failures: [...failures].sort(
      (a, b) => compareCodePoints(a.path, b.path) || compareCodePoints(a.code, b.code),
    ),
    inventory,
  };
}

export type { QuantityComponentData };
