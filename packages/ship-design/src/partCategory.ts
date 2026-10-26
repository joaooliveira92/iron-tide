import type { FlattenedPart } from "@bluewave/content-schema";
import type { ComponentCategory } from "./component.js";
import { designInvariant } from "./errors.js";

type FittingInterface = Extract<FlattenedPart, { readonly family: "fitting" }>["provides"];

export type PartCategoryFailureCode =
  | "PART_CATEGORY_NO_WEAPON_CATEGORY"
  | "PART_CATEGORY_UNSUPPORTED_FAMILY"
  | "PART_CATEGORY_UNSUPPORTED_INTERFACE";

export interface PartCategoryFailure {
  readonly code: PartCategoryFailureCode;
  readonly partId: string;
  readonly message: string;
}

export type PartCategoryResult =
  | { readonly ok: true; readonly category: ComponentCategory }
  | { readonly ok: false; readonly failure: PartCategoryFailure };

const FITTING_CATEGORY: Readonly<Record<FittingInterface, ComponentCategory>> = {
  magazine: "MAGAZINE",
  electrical_plant: "GENERATOR",
  accommodation: "ACCOMMODATION",
  damage_control: "DAMAGE_CONTROL",
  funnel: "SPECIAL_EQUIPMENT",
  ventilation: "SPECIAL_EQUIPMENT",
};

export function partCategory(part: FlattenedPart): PartCategoryResult {
  switch (part.family) {
    case "gun": {
      const category = part.spec.weaponCategory;
      if (category === undefined) {
        return fail(
          "PART_CATEGORY_NO_WEAPON_CATEGORY",
          part.id,
          `gun part '${part.id}' declares no spec.weaponCategory.`,
        );
      }
      return { ok: true, category };
    }
    case "torpedo_launcher":
      return { ok: true, category: "TORPEDO_TUBE" };
    case "ammunition":
      return { ok: true, category: "AMMUNITION" };
    case "sensor":
      return { ok: true, category: "RANGEFINDER" };
    case "propulsion_plant":
      return { ok: true, category: "ENGINE" };
    case "armour_material":
      return { ok: true, category: "ARMOUR_SCHEME" };
    case "fitting": {
      const category = FITTING_CATEGORY[part.provides];
      if (category === undefined) {
        return fail(
          "PART_CATEGORY_UNSUPPORTED_INTERFACE",
          part.id,
          `fitting interface '${part.provides}' has no legacy category.`,
        );
      }
      return { ok: true, category };
    }
    case "gun_mount":
    case "torpedo":
      return fail(
        "PART_CATEGORY_UNSUPPORTED_FAMILY",
        part.id,
        `family '${part.family}' has no legacy category of its own.`,
      );
    default: {
      const never: never = part;
      return never;
    }
  }
}

function fail(code: PartCategoryFailureCode, partId: string, message: string): PartCategoryResult {
  return { ok: false, failure: { code, partId, message } };
}

export function partCategoryOrThrow(part: FlattenedPart): ComponentCategory {
  const result = partCategory(part);
  if (!result.ok) throw designInvariant(`${result.failure.code}: ${result.failure.message}`);
  return result.category;
}
