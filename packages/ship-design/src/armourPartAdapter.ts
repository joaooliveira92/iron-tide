/**
 * The P1 armour-material read path (ship-part-model SPM-R1, SPM-R2, SPM-R19, SPM-R20;
 * story 10). Additive and in memory only.
 *
 * - Each armour material is taken out of the balance tables (`ship.armour.materialEffBp` and
 *   `materialAvailability`) and becomes an `armour_material` part: its efficiency is the
 *   spec, its dates and technology the lifecycle.
 * - A design's armour region becomes one entry in the hull's `armour.<region>` slot, which
 *   accepts `armour_material` only: the part is the material and the plate geometry is the
 *   entry's `shape`. The citadel length, the torpedo warhead and the bunker protection are
 *   design facts, not parts, and stay on the adapter side.
 * - The armour stage then reads efficiency and availability from the parts
 *   (`armourBalanceFromParts`), not from a balance-table key.
 *
 * Balance `obsoleteMonth` is exclusive (an ADVISORY from that month on), like
 * `availableUntil`, so it copies unchanged. A material with no availability entry is
 * unrestricted today; the part model has no undated lifecycle, so it is reported, not dated.
 */
import type { FlattenedPart, LoadoutEntryData } from "@bluewave/content-schema";
import { compareCodePoints } from "@bluewave/deterministic";
import type { ArmourBalance, ArmourMaterialAvailability, ArmourRegion } from "./armour.js";
import { armourRegionSlotId } from "./partCompatibility.js";
import { lifecycleIssue } from "./partLifecycle.js";

export type FlattenedArmourPart = Extract<FlattenedPart, { readonly family: "armour_material" }>;

export const ARMOUR_BALANCE_FILE = "ship-building/balance.yaml";

export interface UnreadArmourMaterial {
  readonly id: string;
  readonly code:
    /** No availability entry: the legacy material is undated, the part lifecycle cannot be. */
    | "PART_READ_PATH_NO_MATERIAL_AVAILABILITY"
    /** An availability entry for a material with no efficiency (legacy ignores it). */
    | "PART_READ_PATH_NO_MATERIAL_EFFICIENCY"
    | "PART_READ_PATH_INVALID_LIFECYCLE"
    /** The efficiency is not a positive integer basis-point value. */
    | "PART_READ_PATH_INVALID_SPEC"
    /** `maxThicknessUm` has no field in the part model yet; dropping it would widen access. */
    | "PART_READ_PATH_UNSUPPORTED_MAX_THICKNESS";
  readonly message: string;
}

export interface ArmourPartModel {
  /** Codepoint-ordered by id. */
  readonly parts: readonly FlattenedArmourPart[];
  readonly unread: readonly UnreadArmourMaterial[];
}

/** Build the material parts from the armour balance. Independent of the table order. */
export function buildArmourPartModel(input: {
  readonly armour: Pick<ArmourBalance, "materialEffBp" | "materialAvailability">;
}): ArmourPartModel {
  const parts: FlattenedArmourPart[] = [];
  const unread: UnreadArmourMaterial[] = [];
  const availability = input.armour.materialAvailability ?? {};
  const fail = (id: string, code: UnreadArmourMaterial["code"], message: string) =>
    unread.push({ id, code, message });
  for (const id of Object.keys(availability)) {
    if (input.armour.materialEffBp[id] === undefined) {
      fail(
        id,
        "PART_READ_PATH_NO_MATERIAL_EFFICIENCY",
        `Material '${id}' has availability but no efficiency; the legacy compile cannot fit it.`,
      );
    }
  }
  for (const [id, efficiencyBp] of Object.entries(input.armour.materialEffBp)) {
    const a: ArmourMaterialAvailability | undefined = availability[id];
    if (a === undefined) {
      fail(
        id,
        "PART_READ_PATH_NO_MATERIAL_AVAILABILITY",
        `Material '${id}' has no availability entry; the part model has no undated lifecycle.`,
      );
      continue;
    }
    const lifecycle = lifecycleIssue(a.fromMonth, a.obsoleteMonth);
    if (lifecycle !== null) {
      fail(id, "PART_READ_PATH_INVALID_LIFECYCLE", `Material '${id}': ${lifecycle}.`);
      continue;
    }
    if (!(Number.isInteger(efficiencyBp) && efficiencyBp > 0)) {
      fail(
        id,
        "PART_READ_PATH_INVALID_SPEC",
        `Material '${id}' efficiency ${efficiencyBp} is not a positive integer.`,
      );
      continue;
    }
    if (a.maxThicknessUm !== undefined) {
      fail(
        id,
        "PART_READ_PATH_UNSUPPORTED_MAX_THICKNESS",
        `Material '${id}' limits plate to ${a.maxThicknessUm} um, which the part model cannot carry yet.`,
      );
      continue;
    }
    const requires = a.requires ?? [];
    parts.push({
      id,
      family: "armour_material",
      provides: "armour_material",
      name: id,
      lifecycle: {
        availableFrom: a.fromMonth,
        availableUntil: a.obsoleteMonth ?? null,
        ...(requires.length > 0 ? { requires: [...requires] } : {}),
      },
      spec: { efficiencyBp },
      quantities: [],
      revisions: [],
      origin: { sourceFile: ARMOUR_BALANCE_FILE },
      // The balance cites its sources in comments only; P2's codemod must author them (ticket 11).
      provenance: {
        sourceStatus: "PLACEHOLDER",
        confidence: "LOW",
        kind: "game_conversion",
        sources: [],
        note: `Read from the balance tables' '${id}' entries, whose sources are YAML comments only.`,
      },
    });
  }
  return {
    parts: parts.sort((a, b) => compareCodePoints(a.id, b.id)),
    unread: unread.sort(
      (a, b) => compareCodePoints(a.id, b.id) || compareCodePoints(a.code, b.code),
    ),
  };
}

/**
 * The armour balance with its material efficiency and availability taken from the parts
 * instead of the balance tables. Every other armour constant is unchanged.
 */
export function armourBalanceFromParts(
  base: ArmourBalance,
  parts: readonly FlattenedArmourPart[],
): ArmourBalance {
  const materialEffBp: Record<string, number> = {};
  const materialAvailability: Record<string, ArmourMaterialAvailability> = {};
  for (const part of parts) {
    materialEffBp[part.id] = part.spec.efficiencyBp;
    const { availableFrom, availableUntil, requires } = part.lifecycle;
    materialAvailability[part.id] = {
      ...(requires !== undefined ? { requires: [...requires] } : {}),
      fromMonth: availableFrom,
      ...(availableUntil != null ? { obsoleteMonth: availableUntil } : {}),
    };
  }
  return { ...base, materialEffBp, materialAvailability };
}

// ---------------------------------------------------------------------------
// Armour regions → loadout entries
// ---------------------------------------------------------------------------

export interface ArmourRegionTranslation {
  readonly designId: string;
  /** The region's position in the design's armour list (the order the armour stage reads). */
  readonly index: number;
  readonly materialPart: FlattenedArmourPart;
  /** The region's one entry: the material in its `armour.<region>` slot, with its plate shape. */
  readonly entry: LoadoutEntryData;
}

export interface UntranslatedArmourRegion {
  readonly designId: string;
  readonly index: number;
  readonly region: string;
  readonly materialId: string;
  readonly code: "PART_READ_PATH_NO_ARMOUR_MATERIAL" | "PART_READ_PATH_INVALID_ARMOUR_SHAPE";
  readonly message: string;
}

export type ArmourRegionResult =
  | { readonly translation: ArmourRegionTranslation; readonly untranslated: null }
  | { readonly translation: null; readonly untranslated: UntranslatedArmourRegion };

const isPositiveInt = (v: number) => Number.isInteger(v) && v > 0;

/** Translate one armour region (its index keeps the design's region order). */
export function translateArmourRegion(input: {
  readonly designId: string;
  readonly index: number;
  readonly region: ArmourRegion;
  readonly model: ArmourPartModel;
}): ArmourRegionResult {
  const { region: r } = input;
  const fail = (code: UntranslatedArmourRegion["code"], message: string): ArmourRegionResult => ({
    translation: null,
    untranslated: {
      designId: input.designId,
      index: input.index,
      region: r.region,
      materialId: r.materialId,
      code,
      message,
    },
  });
  const materialPart = input.model.parts.find((p) => p.id === r.materialId);
  if (materialPart === undefined) {
    return fail(
      "PART_READ_PATH_NO_ARMOUR_MATERIAL",
      `No armour material part '${r.materialId}' was read.`,
    );
  }
  const shapeOk =
    isPositiveInt(r.thicknessUm) &&
    isPositiveInt(r.lengthMm) &&
    isPositiveInt(r.heightMm) &&
    Number.isInteger(r.cosObliquityBp) &&
    r.cosObliquityBp >= 0 &&
    r.cosObliquityBp <= 10_000;
  if (!shapeOk) {
    return fail(
      "PART_READ_PATH_INVALID_ARMOUR_SHAPE",
      `Region ${r.region} (${r.thicknessUm} um × ${r.lengthMm} mm × ${r.heightMm} mm, cos ${r.cosObliquityBp} bp) ` +
        "is not a plate the strict shape admits.",
    );
  }
  return {
    untranslated: null,
    translation: {
      designId: input.designId,
      index: input.index,
      materialPart,
      entry: {
        slot: armourRegionSlotId(r.region),
        part: materialPart.id,
        mountCount: 1,
        shape: {
          thicknessUm: r.thicknessUm,
          lengthMm: r.lengthMm,
          heightMm: r.heightMm,
          cosObliquityBp: r.cosObliquityBp,
        },
      },
    },
  };
}

/**
 * The armour region the armour stage reads, rebuilt from the entry. `region` is the region of
 * the entry's slot (`SlotData.region` on the design's platform).
 */
export function armourRegionFromEntry(
  entry: LoadoutEntryData,
  region: ArmourRegion["region"],
): ArmourRegion {
  if (entry.shape === undefined) {
    throw new Error(`armourPartAdapter: armour entry '${entry.slot}' has no shape`);
  }
  return {
    region,
    thicknessUm: entry.shape.thicknessUm,
    lengthMm: entry.shape.lengthMm,
    heightMm: entry.shape.heightMm,
    materialId: entry.part,
    cosObliquityBp: entry.shape.cosObliquityBp,
  };
}
