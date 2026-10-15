/**
 * The P1 propulsion-plant read path (ship-part-model SPM-R1, SPM-R19, SPM-R20; story 11).
 * Additive and in memory only.
 *
 * - Each `plants.yaml` plant becomes a **parametric** `propulsion_plant` part: installed
 *   power is the declared parameter `installedKw` (`minKw`–`maxKw`, step 1 kW), and the
 *   per-kW weight, volume and fuel curve are its spec. The plant declares no quantity
 *   components: its mass and volume are derived by the machinery stage from the spec and the
 *   entry's `installedKw`, not scaled by an application basis.
 * - A design's machinery plan becomes one entry in its zone's `<zone>.propulsion_plant` slot
 *   with `params.installedKw`. The fuel load, the fouling and the optional room split are
 *   design facts, not parts, and stay on the adapter's `legacy` record (the loadout entry has
 *   no field for a share of one plant across several zones).
 *
 * Plant `obsoleteMonth` is exclusive (the compile blocks when `obsoleteMonth <= month`), like
 * `availableUntil`, so it copies unchanged. A plant without an introduction is always
 * available today; the part model has no undated lifecycle, so it is reported, not dated.
 */
import type { FlattenedPart, LoadoutEntryData } from "@bluewave/content-schema";
import { compareCodePoints } from "@bluewave/deterministic";
import type { MachineryPlan } from "./compileShared.js";
import type { PropulsionPlant } from "./machinery.js";
import { compatibilitySlotId } from "./partCompatibility.js";
import { lifecycleIssue } from "./partLifecycle.js";

export type FlattenedPlantPart = Extract<FlattenedPart, { readonly family: "propulsion_plant" }>;

export const PLANT_FILE = "ship-building/plants.yaml";

/** The one parameter a plant declares: installed power, whole kW. */
export const INSTALLED_KW = "installedKw";

export interface UnreadPlant {
  readonly id: string;
  readonly code:
    | "PART_READ_PATH_INVALID_LIFECYCLE"
    /** A spec value or the power range is not what the strict part schema admits. */
    | "PART_READ_PATH_INVALID_SPEC";
  readonly message: string;
}

export interface PlantPartModel {
  /** Codepoint-ordered by id. */
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

/** Build the plant parts from today's plant catalogue. Independent of the input order. */
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
      // plants.yaml cites its sources in comments only; P2's codemod must author them (ticket 11).
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

/**
 * The legacy plant record for a part: what the machinery stage reads. The power range is the
 * part's `installedKw` parameter; availability is the lifecycle (both ends exclusive-compatible).
 */
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

// ---------------------------------------------------------------------------
// The machinery plan → one loadout entry
// ---------------------------------------------------------------------------

/** The machinery facts that are not a part: fuel, fouling and the room split (adapter side). */
export type MachineryResidue = Omit<
  MachineryPlan,
  "plantId" | "installedKw" | "zoneId" | "stationPermille"
>;

export interface MachineryTranslation {
  readonly designId: string;
  readonly plantPart: FlattenedPlantPart;
  /** The plan's one entry: the plant in its zone slot with `params.installedKw`. */
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

/**
 * Translate a design's machinery plan. Installed power is copied as the entry parameter
 * whether or not it is inside the plant's range: the range is a finding the machinery stage
 * (and ticket 06's fit stage) reports, not a translation failure. Only a value the strict
 * entry schema cannot hold (a non-integer) fails.
 */
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

/**
 * The machinery plan the compile reads, rebuilt from the entry and the adapter residue.
 * `zoneId` is the zone of the entry's slot (`SlotData.zone` on the design's platform).
 */
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
