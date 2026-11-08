import type { CompiledPartModel, FlattenedPart } from "@bluewave/content-schema";
import { compareCodePoints } from "@bluewave/deterministic";
import type { ComponentCategory, ComponentDef, ParameterRange } from "./component.js";
import { designInvariant } from "./errors.js";

const STANDARD_GUN_PREFIX = "standard_";

const COUNT_PARAMETER_BY_CATEGORY: Readonly<Partial<Record<ComponentCategory, string>>> = {
  MAIN_GUN: "barrels",
  SECONDARY_GUN: "barrels",
  DUAL_PURPOSE_GUN: "barrels",
  AA_WEAPON: "barrels",
  TORPEDO_TUBE: "tubes",
  ACCOMMODATION: "blocks",
};

const FITTING_CATEGORY_BY_INTERFACE: Readonly<Record<string, ComponentCategory>> = {
  magazine: "MAGAZINE",
  electrical_plant: "GENERATOR",
  accommodation: "ACCOMMODATION",
  damage_control: "DAMAGE_CONTROL",
  funnel: "SPECIAL_EQUIPMENT",
  ventilation: "SPECIAL_EQUIPMENT",
};

export interface PartCatalogueEntry {
  readonly id: string;
  readonly displayName: string;
  readonly category: ComponentCategory;
  readonly introduction: {
    readonly fromMonth: string;
    readonly obsoleteMonth: string | null;
  };
  readonly requires: readonly string[];
  readonly tags: readonly string[];
  readonly fcClass: string | null;
  readonly parameters: Readonly<Record<string, ParameterRange>>;
  readonly allowedZones?: readonly string[];
  readonly entryUnits: ParameterRange | null;
  readonly rounds: ParameterRange | null;
  readonly nationIds?: readonly string[];
  readonly caliberUm?: number;
  readonly roleTags?: readonly string[];
}

type NationsByGunFamily = ReadonlyMap<string, readonly string[]>;

function nationsByGunFamily(parts: readonly FlattenedPart[]): NationsByGunFamily {
  const sets = new Map<string, Set<string>>();
  for (const part of parts) {
    if (part.family !== "gun" || part.nation === undefined) continue;
    const family = part.spec.gunFamily;
    if (family === undefined) continue;
    const set = sets.get(family) ?? new Set<string>();
    set.add(part.nation);
    sets.set(family, set);
  }
  return new Map([...sets].map(([family, set]) => [family, [...set].sort(compareCodePoints)]));
}

function pickerFieldsOf(
  part: FlattenedPart,
  nations: NationsByGunFamily,
): Pick<PartCatalogueEntry, "nationIds" | "caliberUm" | "roleTags"> {
  if (part.family !== "gun") return {};
  const nationIds = nations.get(part.spec.gunFamily ?? "");
  const roleTags = (part.metadata?.tags ?? []).filter((tag) => tag !== "gun");
  return {
    ...(nationIds === undefined ? {} : { nationIds }),
    caliberUm: part.spec.calibreUm,
    ...(roleTags.length === 0 ? {} : { roleTags }),
  };
}

function entryIdOf(part: FlattenedPart): string {
  return part.family === "gun" ? part.id.slice(STANDARD_GUN_PREFIX.length) : part.id;
}

function isFamilyLevelPart(part: FlattenedPart): boolean {
  switch (part.family) {
    case "gun":
      return part.id === `${STANDARD_GUN_PREFIX}${part.spec.gunFamily ?? ""}`;
    case "fitting":
    case "sensor":
    case "radar":
    case "sonar":
    case "asw_weapon":
    case "aa_weapon":
    case "missile_launcher":
    case "hangar":
      return true;
    case "torpedo_launcher":
      return part.origin.prototype === undefined;
    default:
      return false;
  }
}

function categoryOf(part: FlattenedPart): ComponentCategory | null {
  switch (part.family) {
    case "gun":
      return part.spec.weaponCategory ?? null;
    case "sensor":
      return "RANGEFINDER";
    case "radar":
      return "RADAR";
    case "sonar":
      return "SONAR";
    case "asw_weapon":
      return "ASW_WEAPON";
    case "aa_weapon":
      return "AA_WEAPON";
    case "missile_launcher":
      return "MISSILE_LAUNCHER";
    case "hangar":
      return "AIRCRAFT_FACILITY";
    case "torpedo_launcher":
      return "TORPEDO_TUBE";
    case "fitting":
      return FITTING_CATEGORY_BY_INTERFACE[part.provides] ?? null;
    default:
      return null;
  }
}

function fcClassOf(part: FlattenedPart): string | null {
  const capability = part.capabilities?.find((c) => c.kind === "fire_control_class");
  return capability !== undefined && capability.kind === "fire_control_class"
    ? capability.class
    : null;
}

function entryOfPart(part: FlattenedPart, nations: NationsByGunFamily): PartCatalogueEntry {
  const category = categoryOf(part);
  if (category === null) {
    throw designInvariant(
      `part '${part.id}' is family-level but has no derivable component category in the part model`,
    );
  }
  const entryUnits = part.entryUnits ?? null;
  const rounds = part.parameters?.["rounds"] ?? null;
  const countParameter = COUNT_PARAMETER_BY_CATEGORY[category];
  const parameters: Record<string, ParameterRange> = {};
  if (countParameter !== undefined && entryUnits !== null) parameters[countParameter] = entryUnits;
  if (rounds !== null) parameters["rounds"] = rounds;
  return {
    id: entryIdOf(part),
    displayName: part.metadata?.displayName ?? part.name,
    category,
    introduction: {
      fromMonth: part.lifecycle.availableFrom,
      obsoleteMonth: part.lifecycle.availableUntil ?? null,
    },
    requires: part.lifecycle.requires ?? [],
    tags: part.metadata?.tags ?? [],
    fcClass: fcClassOf(part),
    parameters,
    entryUnits,
    rounds,
    ...pickerFieldsOf(part, nations),
  };
}

const byId = (a: PartCatalogueEntry, b: PartCatalogueEntry): number =>
  compareCodePoints(a.id, b.id);

export function buildPartCatalogueView(model: CompiledPartModel): readonly PartCatalogueEntry[] {
  const parts = Object.values(model.partIndex.byId);
  const nations = nationsByGunFamily(parts);
  return parts
    .filter(isFamilyLevelPart)
    .map((part) => entryOfPart(part, nations))
    .sort(byId);
}

export function legacyCatalogueView(
  components: readonly ComponentDef[],
): readonly PartCatalogueEntry[] {
  return components
    .map((def): PartCatalogueEntry => {
      const countParameter = COUNT_PARAMETER_BY_CATEGORY[def.category];
      return {
        id: def.id,
        displayName: def.displayName,
        category: def.category,
        introduction: {
          fromMonth: def.introduction.fromMonth,
          obsoleteMonth: def.introduction.obsoleteMonth,
        },
        requires: def.requires,
        tags: def.tags,
        fcClass: def.fcClass ?? null,
        parameters: def.parameters,
        ...(def.allowedZones === undefined ? {} : { allowedZones: def.allowedZones }),
        entryUnits: countParameter === undefined ? null : (def.parameters[countParameter] ?? null),
        rounds: def.parameters["rounds"] ?? null,
      };
    })
    .sort(byId);
}
