/**
 * The canonical-part → legacy `ComponentCategory` adapter (ship-part-model ticket 17a-2,
 * ADR-0163 §2). **Transitional boundary, remove when the legacy category consumers retire.**
 *
 * The derive and the construction/systems stages still branch on a `ComponentCategory`
 * (`WEAPON_CATEGORIES`, `GENERATOR`, `MAGAZINE`, `ACCOMMODATION`, the ledger map). The
 * canonical part model is the authority and does not carry the legacy token (ADR-0154 §15,
 * ADR-0163 §2), so this module is the one code-owned place a part's semantics become the
 * legacy category. It reads the canonical discriminants — `family`, `provides`, `spec` and
 * `capabilities` — never a display label, and never reconstructs a `ComponentDef`.
 *
 * The mapping is exhaustive over `family` (a `never` default makes a new family a compile
 * error) and, for a `fitting`, over `provides`. It fails loudly for the parts that have no
 * legacy category the derive ever needs (a `gun_mount` takes its category from its gun; a
 * `torpedo` is never placed).
 */
import type { FlattenedPart } from "@bluewave/content-schema";
import type { ComponentCategory } from "./component.js";

/** The interfaces a `fitting` may provide (the closed `FAMILY_INTERFACES.fitting`). */
type FittingInterface = Extract<FlattenedPart, { readonly family: "fitting" }>["provides"];

/** The one reason a part has no unambiguous legacy category. */
export type PartCategoryFailureCode =
  /** A gun part names no `spec.weaponCategory`; the derive cannot file it. */
  | "PART_CATEGORY_NO_WEAPON_CATEGORY"
  /** The family has no legacy category (a mount takes its gun's; a torpedo is never placed). */
  | "PART_CATEGORY_UNSUPPORTED_FAMILY"
  /** The fitting interface maps to no legacy category. */
  | "PART_CATEGORY_UNSUPPORTED_INTERFACE";

export interface PartCategoryFailure {
  readonly code: PartCategoryFailureCode;
  readonly partId: string;
  readonly message: string;
}

export type PartCategoryResult =
  | { readonly ok: true; readonly category: ComponentCategory }
  | { readonly ok: false; readonly failure: PartCategoryFailure };

/**
 * The legacy category of a fitting interface. `funnel` and `ventilation` are the two
 * `SPECIAL_EQUIPMENT` interfaces (ADR-0154 §19; the forward map in `fittingPartAdapter.ts`);
 * they share one legacy category, so the mapping is a total function of `provides`.
 */
const FITTING_CATEGORY: Readonly<Record<FittingInterface, ComponentCategory>> = {
  magazine: "MAGAZINE",
  electrical_plant: "GENERATOR",
  accommodation: "ACCOMMODATION",
  damage_control: "DAMAGE_CONTROL",
  funnel: "SPECIAL_EQUIPMENT",
  ventilation: "SPECIAL_EQUIPMENT",
};

/** The single authoritative mapping from a canonical part to its legacy category. */
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
    // The forward adapter maps the legacy `RANGEFINDER` (and only it) to the `sensor`
    // interface (`fittingPartAdapter.ts` `INTERFACE_BY_CATEGORY`), so `sensor` is unambiguous.
    case "sensor":
      return { ok: true, category: "RANGEFINDER" };
    case "propulsion_plant":
      // A plant is a machinery component; the derive files it under the machinery category.
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
    // A mount's category is its gun's (the derive resolves the pair and reads the gun), and a
    // torpedo is never placed. Both are inert here; the default makes a new family a compile error.
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

/** The category or a thrown error: the derive's call site, where an unsupported part is a bug. */
export function partCategoryOrThrow(part: FlattenedPart): ComponentCategory {
  const result = partCategory(part);
  if (!result.ok) throw new Error(`${result.failure.code}: ${result.failure.message}`);
  return result.category;
}
