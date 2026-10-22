import type {
  FlattenedPart,
  LoadoutEntryData,
  QuantityComponentData,
} from "@bluewave/content-schema";
import { compareCodePoints } from "@bluewave/deterministic";
import { num, type PlacementSpec } from "./compileShared.js";
import type { ComponentCategory, ComponentDef } from "./component.js";
import { compatibilitySlotId, type CompatibilityInterface } from "./partCompatibility.js";
import { lifecycleIssue } from "./partLifecycle.js";
import { quantityLines, totalOf, type QuantityLine } from "./partQuantities.js";
import {
  QUANTITY_STEM,
  readComponentQuantities,
  type QuantityReadIssue,
} from "./legacyComponentQuantities.js";

export type FlattenedFittingPart = Extract<FlattenedPart, { readonly family: "fitting" }>;
export type FlattenedSensorPart = Extract<FlattenedPart, { readonly family: "sensor" }>;
export type FittingOrSensorPart = FlattenedFittingPart | FlattenedSensorPart;
type FittingInterface = FlattenedFittingPart["provides"];

export const FITTING_COMPONENT_FILE = "ship-building/components.yaml";

const INTERFACE_BY_CATEGORY: Partial<
  Readonly<Record<ComponentCategory, FittingInterface | "sensor">>
> = {
  MAGAZINE: "magazine",
  RANGEFINDER: "sensor",
  GENERATOR: "electrical_plant",
  ACCOMMODATION: "accommodation",
  DAMAGE_CONTROL: "damage_control",
};

const INTERFACE_BY_SPECIAL_TAG: Readonly<Record<string, FittingInterface>> = {
  funnel: "funnel",
  ventilation: "ventilation",
};

const WEAPON_CATEGORIES: ReadonlySet<ComponentCategory> = new Set<ComponentCategory>([
  "MAIN_GUN",
  "SECONDARY_GUN",
  "DUAL_PURPOSE_GUN",
  "AA_WEAPON",
  "TORPEDO_TUBE",
]);

export type UnreadFittingCode =
  | "PART_READ_PATH_NO_INTERFACE"
  | "PART_READ_PATH_MULTIPLE_PARAMETERS"
  | "PART_READ_PATH_INVALID_SPEC"
  | "PART_READ_PATH_INVALID_LIFECYCLE"
  | "PART_READ_PATH_UNREADABLE_QUANTITY";

export interface UnreadFitting {
  readonly id: string;
  readonly code: UnreadFittingCode;
  readonly message: string;
  readonly issues: readonly QuantityReadIssue[];
}

export interface FittingPartRecord {
  readonly part: FittingOrSensorPart;
  readonly countParameter: string | null;
  readonly legacy: ComponentDef;
}

export interface FittingPartModel {
  readonly records: readonly FittingPartRecord[];
  readonly unread: readonly UnreadFitting[];
}

function interfaceOf(def: ComponentDef): FittingInterface | "sensor" | null {
  if (def.category === "SPECIAL_EQUIPMENT") {
    const matches = def.tags.filter((t) => Object.hasOwn(INTERFACE_BY_SPECIAL_TAG, t));
    const [only] = matches;
    return matches.length === 1 && only !== undefined
      ? (INTERFACE_BY_SPECIAL_TAG[only] ?? null)
      : null;
  }
  return INTERFACE_BY_CATEGORY[def.category] ?? null;
}

const isNonNegativeInt = (v: number) => Number.isInteger(v) && v >= 0;
const isPositiveInt = (v: number) => Number.isInteger(v) && v > 0;
const isBp = (v: number) => isNonNegativeInt(v) && v <= 10_000;

function specAttribute(
  def: ComponentDef,
  name: string,
  admits: (v: number) => boolean,
): number | undefined | "invalid" {
  const src = def.attributes?.[name];
  if (src === undefined) return undefined;
  try {
    const value = num(src, { ...def.constants });
    return admits(value) ? value : "invalid";
  } catch {
    return "invalid";
  }
}

function lifecycleOf(def: ComponentDef): FittingOrSensorPart["lifecycle"] {
  return {
    availableFrom: def.introduction.fromMonth,
    availableUntil: def.introduction.obsoleteMonth,
    ...(def.requires.length > 0 ? { requires: [...def.requires] } : {}),
  };
}

function placeholderProvenance(def: ComponentDef): FittingOrSensorPart["provenance"] {
  return {
    sourceStatus: "PLACEHOLDER",
    confidence: "LOW",
    kind: "game_conversion",
    sources: [],
    note: `Read from legacy component '${def.id}', which has no structured provenance.`,
  };
}

function quantitiesOf(
  def: ComponentDef,
  countParameter: string | null,
): { quantities: readonly QuantityComponentData[]; issues: readonly QuantityReadIssue[] } {
  return readComponentQuantities(def, {
    fields: ["weightKg", "costMicro", "crew", "volumeLitre", "deckFootprintMm2"],
    countParameter,
    perUnitBasis: "PER_PART_UNIT",
    idFor: (field, term) =>
      term === "fixed" ? `${QUANTITY_STEM[field]}_fixed` : QUANTITY_STEM[field],
  });
}

export function buildFittingPartModel(input: {
  readonly components: readonly ComponentDef[];
}): FittingPartModel {
  const records: FittingPartRecord[] = [];
  const unread: UnreadFitting[] = [];
  for (const def of input.components) {
    if (WEAPON_CATEGORIES.has(def.category)) continue;
    const fail = (
      code: UnreadFittingCode,
      message: string,
      issues: readonly QuantityReadIssue[] = [],
    ) => unread.push({ id: def.id, code, message, issues });
    const iface = interfaceOf(def);
    if (iface === null) {
      fail(
        "PART_READ_PATH_NO_INTERFACE",
        `Component '${def.id}' (${def.category}, tags ${def.tags.join(", ") || "none"}) maps to no interface in interfaces/1.`,
      );
      continue;
    }
    const parameters = Object.keys(def.parameters).sort(compareCodePoints);
    if (parameters.length > 1) {
      fail(
        "PART_READ_PATH_MULTIPLE_PARAMETERS",
        `Component '${def.id}' declares ${parameters.join(", ")}; only one count parameter reads as mountCount.`,
      );
      continue;
    }
    const lifecycle = lifecycleIssue(def.introduction.fromMonth, def.introduction.obsoleteMonth);
    if (lifecycle !== null) {
      fail("PART_READ_PATH_INVALID_LIFECYCLE", `Component '${def.id}': ${lifecycle}.`);
      continue;
    }
    const countParameter = parameters[0] ?? null;
    const { quantities, issues } = quantitiesOf(def, countParameter);
    if (issues.length > 0) {
      fail(
        "PART_READ_PATH_UNREADABLE_QUANTITY",
        `Component '${def.id}' has ${issues.length} quantity formula(s) the part model cannot carry.`,
        issues,
      );
      continue;
    }
    const common = {
      id: def.id,
      name: def.displayName,
      lifecycle: lifecycleOf(def),
      quantities: [...quantities],
      revisions: [],
      origin: { sourceFile: FITTING_COMPONENT_FILE },
      provenance: placeholderProvenance(def),
      ...(countParameter !== null
        ? {
            parameters: {
              [countParameter]: {
                min: def.parameters[countParameter]!.min,
                max: def.parameters[countParameter]!.max,
                step: def.parameters[countParameter]!.step,
              },
            },
          }
        : {}),
    };
    const invalidSpec = (name: string) =>
      fail(
        "PART_READ_PATH_INVALID_SPEC",
        `Attribute '${name}' of '${def.id}' is not a constant its strict spec field admits.`,
      );
    if (iface === "sensor") {
      const accuracyBonusBp = specAttribute(def, "accuracyBonusBp", isBp);
      const gunCapacity = specAttribute(def, "capacity", isPositiveInt);
      if (accuracyBonusBp === "invalid") invalidSpec("accuracyBonusBp");
      else if (gunCapacity === "invalid") invalidSpec("capacity");
      else {
        records.push({
          part: {
            ...common,
            family: "sensor",
            provides: "sensor",
            spec: {
              ...(accuracyBonusBp !== undefined ? { accuracyBonusBp } : {}),
              ...(gunCapacity !== undefined ? { gunCapacity } : {}),
            },
          },
          countParameter,
          legacy: def,
        });
      }
      continue;
    }
    const magazineLitre = specAttribute(def, "magazineLitre", isNonNegativeInt);
    const flashProtectionBp = specAttribute(def, "flashProtectionBp", isBp);
    if (magazineLitre === "invalid") invalidSpec("magazineLitre");
    else if (flashProtectionBp === "invalid") invalidSpec("flashProtectionBp");
    else {
      records.push({
        part: {
          ...common,
          family: "fitting",
          provides: iface,
          spec: {
            ...(magazineLitre !== undefined ? { magazineLitre } : {}),
            ...(flashProtectionBp !== undefined ? { flashProtectionBp } : {}),
            ...(def.critical !== undefined ? { critical: def.critical } : {}),
          },
        },
        countParameter,
        legacy: def,
      });
    }
  }
  return {
    records: records.sort((a, b) => compareCodePoints(a.part.id, b.part.id)),
    unread: unread.sort((a, b) => compareCodePoints(a.id, b.id)),
  };
}

export interface FittingPlacementTranslation {
  readonly designId: string;
  readonly instanceId: string;
  readonly record: FittingPartRecord;
  readonly legacyCount: number | null;
  readonly defaulted: boolean;
  readonly mountCount: number;
  readonly ignoredParams: readonly string[];
  readonly entry: LoadoutEntryData;
  readonly quantities: readonly QuantityLine[];
}

export interface UntranslatedFittingPlacement {
  readonly designId: string;
  readonly instanceId: string;
  readonly componentId: string;
  readonly code: "PART_READ_PATH_NO_FITTING_PART" | "PART_READ_PATH_INVALID_COUNT";
  readonly message: string;
}

export type FittingPlacementResult =
  | { readonly translation: FittingPlacementTranslation; readonly untranslated: null }
  | { readonly translation: null; readonly untranslated: UntranslatedFittingPlacement };

export function translateFittingPlacement(input: {
  readonly designId: string;
  readonly placement: PlacementSpec;
  readonly model: FittingPartModel;
}): FittingPlacementResult {
  const { placement } = input;
  const fail = (
    code: UntranslatedFittingPlacement["code"],
    message: string,
  ): FittingPlacementResult => ({
    translation: null,
    untranslated: {
      designId: input.designId,
      instanceId: placement.instanceId,
      componentId: placement.componentId,
      code,
      message,
    },
  });
  const record = input.model.records.find((r) => r.part.id === placement.componentId);
  if (record === undefined) {
    return fail(
      "PART_READ_PATH_NO_FITTING_PART",
      `No fitting part '${placement.componentId}' was read.`,
    );
  }
  const counted = record.countParameter;
  const raw = counted === null ? undefined : placement.params?.[counted];
  if (raw !== undefined && !(Number.isInteger(raw) && raw > 0)) {
    return fail(
      "PART_READ_PATH_INVALID_COUNT",
      `${counted ?? "count"} must be a positive integer; '${String(raw)}' fails translation.`,
    );
  }
  const fallback = counted === null ? 1 : (record.legacy.parameters[counted]?.min ?? 1);
  const mountCount = raw ?? fallback;
  const iface: CompatibilityInterface = record.part.provides;
  return {
    untranslated: null,
    translation: {
      designId: input.designId,
      instanceId: placement.instanceId,
      record,
      legacyCount: raw ?? null,
      defaulted: counted !== null && raw === undefined,
      mountCount,
      ignoredParams: Object.keys(placement.params ?? {})
        .filter((name) => name !== counted)
        .sort(compareCodePoints),
      entry: {
        id: placement.instanceId,
        slot: compatibilitySlotId(placement.zoneId, iface),
        part: record.part.id,
        mountCount,
        stationPermille: placement.stationPermille,
        ...(placement.side !== undefined ? { side: placement.side } : {}),
        ...(counted !== null ? { params: { [counted]: mountCount } } : {}),
        ...(placement.magazineRef !== undefined ? { magazineEntry: placement.magazineRef } : {}),
      },
      quantities: quantityLines(record.part.quantities, "fitting", record.part.id, mountCount, 1),
    },
  };
}

export interface FittingPlacementValues {
  readonly weightKg: number;
  readonly costMicro: number;
  readonly crew: number;
  readonly volumeLitre: number;
  readonly deckFootprintMm2: number;
  readonly heightMm: number;
  readonly zCgMm: number;
  readonly powerKw: number;
  readonly coolingKw: number;
  readonly attr: Readonly<Record<string, number>>;
}

export function fittingPlacementValues(t: FittingPlacementTranslation): FittingPlacementValues {
  const { part, legacy, countParameter } = t.record;
  const vars = {
    ...legacy.constants,
    ...(countParameter === null ? {} : { [countParameter]: t.mountCount }),
  };
  const fromPart: Readonly<Record<string, number | undefined>> =
    part.family === "sensor"
      ? { accuracyBonusBp: part.spec.accuracyBonusBp, capacity: part.spec.gunCapacity }
      : { magazineLitre: part.spec.magazineLitre, flashProtectionBp: part.spec.flashProtectionBp };
  const attr: Record<string, number> = {};
  for (const [name, src] of Object.entries(legacy.attributes ?? {})) {
    attr[name] = fromPart[name] ?? num(src, vars);
  }
  return {
    weightKg: totalOf(t.quantities, "massKg"),
    costMicro: totalOf(t.quantities, "costMicro"),
    crew: totalOf(t.quantities, "crew"),
    volumeLitre: totalOf(t.quantities, "volumeLitre"),
    deckFootprintMm2: totalOf(t.quantities, "deckFootprintMm2"),
    heightMm: num(legacy.heightMm, vars),
    zCgMm: num(legacy.zCgMm, vars),
    powerKw: num(legacy.powerKw, vars),
    coolingKw: num(legacy.coolingKw, vars),
    attr,
  };
}
