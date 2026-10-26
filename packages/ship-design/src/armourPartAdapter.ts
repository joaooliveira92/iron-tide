import type { FlattenedPart, LoadoutEntryData } from "@bluewave/content-schema";
import { compareCodePoints } from "@bluewave/deterministic";
import type { ArmourBalance, ArmourMaterialAvailability, ArmourRegion } from "./armour.js";
import { armourRegionSlotId } from "./partCompatibility.js";
import { lifecycleIssue } from "./partLifecycle.js";
import { designInvariant } from "./errors.js";

export type FlattenedArmourPart = Extract<FlattenedPart, { readonly family: "armour_material" }>;

export const ARMOUR_BALANCE_FILE = "ship-building/balance.yaml";

export interface UnreadArmourMaterial {
  readonly id: string;
  readonly code:
    | "PART_READ_PATH_NO_MATERIAL_AVAILABILITY"
    | "PART_READ_PATH_NO_MATERIAL_EFFICIENCY"
    | "PART_READ_PATH_INVALID_LIFECYCLE"
    | "PART_READ_PATH_INVALID_SPEC"
    | "PART_READ_PATH_UNSUPPORTED_MAX_THICKNESS";
  readonly message: string;
}

export interface ArmourPartModel {
  readonly parts: readonly FlattenedArmourPart[];
  readonly unread: readonly UnreadArmourMaterial[];
}

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

export interface ArmourRegionTranslation {
  readonly designId: string;
  readonly index: number;
  readonly materialPart: FlattenedArmourPart;
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

export function armourRegionFromEntry(
  entry: LoadoutEntryData,
  region: ArmourRegion["region"],
): ArmourRegion {
  if (entry.shape === undefined) {
    throw designInvariant(`armourPartAdapter: armour entry '${entry.slot}' has no shape`);
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
