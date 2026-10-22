import type { FlattenedPart, LoadoutEntryData } from "@bluewave/content-schema";
import { compareCodePoints } from "@bluewave/deterministic";
import type { MachineryPlan } from "./compileShared.js";
import type { PropulsionPlant } from "./machinery.js";
import { compatibilitySlotId } from "./partCompatibility.js";
import { lifecycleIssue } from "./partLifecycle.js";

export type FlattenedPlantPart = Extract<FlattenedPart, { readonly family: "propulsion_plant" }>;

export const PLANT_FILE = "ship-building/plants.yaml";

export const INSTALLED_KW = "installedKw";

export interface UnreadPlant {
  readonly id: string;
  readonly code: "PART_READ_PATH_INVALID_LIFECYCLE" | "PART_READ_PATH_INVALID_SPEC";
  readonly message: string;
}

export interface PlantPartModel {
  readonly parts: readonly FlattenedPlantPart[];
  readonly unread: readonly UnreadPlant[];
}

const isInt = (v: number) => Number.isInteger(v);
const isPositiveInt = (v: number) => isInt(v) && v > 0;

function specIssue(plant: PropulsionPlant): string | null {
  if (!isPositiveInt(plant.weightMilliKgPerKw))
    return "weightMilliKgPerKw must be a positive integer";
  if (!isPositiveInt(plant.volumeLitrePerKw)) return "volumeLitrePerKw must be a positive integer";
  if (!(isInt(plant.reliabilityBp) && plant.reliabilityBp >= 0 && plant.reliabilityBp <= 10_000))
    return "reliabilityBp must be an integer 0..10000";
  if (plant.sfcGramPerKwh.points.length === 0) return "the fuel curve has no points";
  if (!plant.sfcGramPerKwh.points.every(([x, y]) => isInt(x) && isInt(y)))
    return "the fuel curve has a non-integer point";
  if (!(isInt(plant.minKw) && isInt(plant.maxKw) && plant.minKw <= plant.maxKw))
    return `the power range ${plant.minKw}..${plant.maxKw} kW is not an integer range`;
  return null;
}

export function buildPlantPartModel(input: {
  readonly plants: readonly PropulsionPlant[];
}): PlantPartModel {
  const parts: FlattenedPlantPart[] = [];
  const unread: UnreadPlant[] = [];
  for (const plant of input.plants) {
    const intro = plant.introduction;
    const lifecycle = lifecycleIssue(intro?.fromMonth, intro?.obsoleteMonth);
    if (intro === undefined || lifecycle !== null) {
      unread.push({
        id: plant.id,
        code: "PART_READ_PATH_INVALID_LIFECYCLE",
        message: `Plant '${plant.id}': ${lifecycle ?? "no introduction"}; the part model has no undated lifecycle.`,
      });
      continue;
    }
    const spec = specIssue(plant);
    if (spec !== null) {
      unread.push({
        id: plant.id,
        code: "PART_READ_PATH_INVALID_SPEC",
        message: `Plant '${plant.id}': ${spec}.`,
      });
      continue;
    }
    const requires = plant.requires ?? [];
    parts.push({
      id: plant.id,
      family: "propulsion_plant",
      provides: "propulsion_plant",
      name: plant.id,
      lifecycle: {
        availableFrom: intro.fromMonth,
        availableUntil: intro.obsoleteMonth,
        ...(requires.length > 0 ? { requires: [...requires] } : {}),
      },
      parameters: { [INSTALLED_KW]: { min: plant.minKw, max: plant.maxKw, step: 1 } },
      spec: {
        fuelType: plant.fuelType,
        weightMilliKgPerKw: plant.weightMilliKgPerKw,
        volumeLitrePerKw: plant.volumeLitrePerKw,
        sfcGramPerKwh: {
          points: plant.sfcGramPerKwh.points.map(([x, y]): readonly [number, number] => [x, y]),
        },
        reliabilityBp: plant.reliabilityBp,
      },
      quantities: [],
      revisions: [],
      origin: { sourceFile: PLANT_FILE },
      provenance: {
        sourceStatus: "PLACEHOLDER",
        confidence: "LOW",
        kind: "game_conversion",
        sources: [],
        note: `Read from legacy plant '${plant.id}', whose sources are YAML comments only.`,
      },
    });
  }
  return {
    parts: parts.sort((a, b) => compareCodePoints(a.id, b.id)),
    unread: unread.sort((a, b) => compareCodePoints(a.id, b.id)),
  };
}

export function propulsionPlantFromPart(part: FlattenedPlantPart): PropulsionPlant {
  const range = part.parameters?.[INSTALLED_KW];
  if (range === undefined) {
    throw new Error(`plantPartAdapter: plant part '${part.id}' declares no ${INSTALLED_KW}`);
  }
  const { lifecycle, spec } = part;
  return {
    id: part.id,
    fuelType: spec.fuelType,
    weightMilliKgPerKw: spec.weightMilliKgPerKw,
    volumeLitrePerKw: spec.volumeLitrePerKw,
    sfcGramPerKwh: { points: spec.sfcGramPerKwh.points.map(([x, y]) => [x, y] as const) },
    reliabilityBp: spec.reliabilityBp,
    minKw: range.min,
    maxKw: range.max,
    introduction: {
      fromMonth: lifecycle.availableFrom,
      obsoleteMonth: lifecycle.availableUntil ?? null,
    },
    ...(lifecycle.requires !== undefined ? { requires: [...lifecycle.requires] } : {}),
  };
}

export type MachineryResidue = Omit<
  MachineryPlan,
  "plantId" | "installedKw" | "zoneId" | "stationPermille"
>;

export interface MachineryTranslation {
  readonly designId: string;
  readonly plantPart: FlattenedPlantPart;
  readonly entry: LoadoutEntryData;
  readonly legacy: MachineryResidue;
}

export interface UntranslatedMachinery {
  readonly designId: string;
  readonly plantId: string;
  readonly code: "PART_READ_PATH_NO_PLANT_PART" | "PART_READ_PATH_INVALID_INSTALLED_POWER";
  readonly message: string;
}

export type MachineryTranslationResult =
  | { readonly translation: MachineryTranslation; readonly untranslated: null }
  | { readonly translation: null; readonly untranslated: UntranslatedMachinery };

export function translateMachinery(input: {
  readonly designId: string;
  readonly machinery: MachineryPlan;
  readonly model: PlantPartModel;
}): MachineryTranslationResult {
  const { plantId, installedKw, zoneId, stationPermille, ...legacy } = input.machinery;
  const fail = (
    code: UntranslatedMachinery["code"],
    message: string,
  ): MachineryTranslationResult => ({
    translation: null,
    untranslated: { designId: input.designId, plantId, code, message },
  });
  const plantPart = input.model.parts.find((p) => p.id === plantId);
  if (plantPart === undefined) {
    return fail("PART_READ_PATH_NO_PLANT_PART", `No plant part '${plantId}' was read.`);
  }
  if (!Number.isInteger(installedKw)) {
    return fail(
      "PART_READ_PATH_INVALID_INSTALLED_POWER",
      `installedKw must be a whole number of kW; '${String(installedKw)}' fails translation.`,
    );
  }
  return {
    untranslated: null,
    translation: {
      designId: input.designId,
      plantPart,
      entry: {
        slot: compatibilitySlotId(zoneId, "propulsion_plant"),
        part: plantPart.id,
        mountCount: 1,
        stationPermille,
        params: { [INSTALLED_KW]: installedKw },
      },
      legacy,
    },
  };
}

export function machineryPlanFromEntry(
  t: MachineryTranslation,
  zoneId: MachineryPlan["zoneId"],
): MachineryPlan {
  const installedKw = t.entry.params?.[INSTALLED_KW];
  if (installedKw === undefined || t.entry.stationPermille === undefined) {
    throw new Error(
      `plantPartAdapter: machinery entry of '${t.designId}' lost its power or station`,
    );
  }
  return {
    plantId: t.entry.part,
    installedKw,
    zoneId,
    stationPermille: t.entry.stationPermille,
    ...t.legacy,
  };
}
