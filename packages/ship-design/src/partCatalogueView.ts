/**
 * The family-level catalogue view the designer reads (ship-part-model ticket 17b-1).
 *
 * The Shipbuilding workspace once read the legacy `ComponentDef` catalogue for its
 * read-only displays. The compiled parts are now authoritative, so this module
 * rebuilds the same family-level catalogue from `CompiledPartModel` — the exact
 * behaviour-preserving projection the legacy `data.components` produced.
 *
 * **Selection.** A part is family-level when it is the direct image of a legacy
 * `components.yaml` record (ADR-0154 §19, `partCatalogue.ts` `PART_SOURCE_FIELDS`):
 * a gun family's `standard_<family>` model, a fitting (the whole `fitting` family),
 * the single `sensor`, or a `torpedo_launcher` base (`origin.prototype` absent;
 * national launcher variants and every national gun model are excluded, so the menu
 * never grows). `buildPartCatalogueView.test.ts` pins the selection for the shipped
 * 1880 artifact: 45 entries, equal to `legacyCatalogueView(data.components)`.
 *
 * **What is carried.** Only what the read-only and edit consumers need: id, display name,
 * category, lifecycle, technology requires, tags, fire-control class, the count range (legacy
 * `parameters.barrels`/`tubes`/`blocks`) and the `rounds` range. 17b-2 adds the legacy
 * `parameters` map (rebuilt from `entryUnits` + `rounds`) and an optional `allowedZones`, so the
 * designer's edit paths (`defOf`, `allowedZones`-dependent placement, param edits) can read this
 * view instead of the legacy `ComponentDef` catalogue. Fields the part model cannot reconstruct
 * exactly (`forbidsCoLocation`, `buildWorkMicro`, `productionLine`, formula forms) stay absent;
 * no consumer here may read them.
 *
 * Pure and runtime-free: `import type` only from `@bluewave/content-schema`, no
 * Effect runtime, no I/O, no ambient randomness. The result is id-sorted.
 */
import type { CompiledPartModel, FlattenedPart } from "@bluewave/content-schema";
import { compareCodePoints } from "@bluewave/deterministic";
import type { ComponentCategory, ComponentDef, ParameterRange } from "./component.js";

/** The `standard_<family>` model id prefix (ticket 11b; `partCatalogue.ts` `standardGunPartId`). */
const STANDARD_GUN_PREFIX = "standard_";

/**
 * The legacy count parameter of each category, the one whose range became the
 * part's `entryUnits` (`partCatalogue.ts` `LEGACY_COUNT_PARAMETER`). Every other
 * legacy parameter has no family-level destination.
 */
const COUNT_PARAMETER_BY_CATEGORY: Readonly<Partial<Record<ComponentCategory, string>>> = {
  MAIN_GUN: "barrels",
  SECONDARY_GUN: "barrels",
  DUAL_PURPOSE_GUN: "barrels",
  AA_WEAPON: "barrels",
  TORPEDO_TUBE: "tubes",
  ACCOMMODATION: "blocks",
};

/**
 * The inverse of the read path's category → interface map
 * (`fittingPartAdapter.ts` `INTERFACE_BY_CATEGORY` / `INTERFACE_BY_SPECIAL_TAG`).
 * `funnel` and `ventilation` both come from `SPECIAL_EQUIPMENT`; every other
 * interface has exactly one category.
 */
const FITTING_CATEGORY_BY_INTERFACE: Readonly<Record<string, ComponentCategory>> = {
  magazine: "MAGAZINE",
  electrical_plant: "GENERATOR",
  accommodation: "ACCOMMODATION",
  damage_control: "DAMAGE_CONTROL",
  funnel: "SPECIAL_EQUIPMENT",
  ventilation: "SPECIAL_EQUIPMENT",
};

/** One family-level catalogue entry: the narrow read-only projection of a legacy component. */
export interface PartCatalogueEntry {
  readonly id: string;
  readonly displayName: string;
  readonly category: ComponentCategory;
  readonly introduction: {
    readonly fromMonth: string;
    /** Exclusive, like the legacy `obsoleteMonth`; `null` when still available. */
    readonly obsoleteMonth: string | null;
  };
  readonly requires: readonly string[];
  readonly tags: readonly string[];
  /** Fire-control class of a weapon, or null. */
  readonly fcClass: string | null;
  /**
   * The legacy parameter ranges the edit paths drive (`barrels`/`tubes`/`blocks` from
   * `entryUnits`, plus `rounds`), keyed by their legacy names so a `set_param` edit built from
   * this entry feeds the same `PlacementSpec.params` the compiler reads. A part whose parameter
   * has no family-level destination is a build failure, not a silent omission.
   */
  readonly parameters: Readonly<Record<string, ParameterRange>>;
  /**
   * The zones the fitting may occupy (legacy `allowedZones`). The part schema has no destination
   * for it (ADR-0154 §19), so the compiled-parts view leaves it absent — every zone accepts every
   * fitting, exactly the legacy behaviour for the shipped pack. The parts-less fallback carries
   * the legacy field unchanged.
   */
  readonly allowedZones?: readonly string[];
  /** The count range (legacy `barrels`/`tubes`/`blocks`), or null for a one-unit fitting. */
  readonly entryUnits: ParameterRange | null;
  /** The `rounds` range of a gun, or null. */
  readonly rounds: ParameterRange | null;
}

/** The legacy family id of a family-level part: a gun's standard model strips its prefix. */
function entryIdOf(part: FlattenedPart): string {
  return part.family === "gun" ? part.id.slice(STANDARD_GUN_PREFIX.length) : part.id;
}

/** True when the part is the direct image of a legacy `components.yaml` record. */
function isFamilyLevelPart(part: FlattenedPart): boolean {
  switch (part.family) {
    case "gun":
      return part.id === `${STANDARD_GUN_PREFIX}${part.spec.gunFamily ?? ""}`;
    case "fitting":
    case "sensor":
      return true;
    case "torpedo_launcher":
      return part.origin.prototype === undefined;
    default:
      return false;
  }
}

/** The legacy component category a family-level part came from, or null when undecidable. */
function categoryOf(part: FlattenedPart): ComponentCategory | null {
  switch (part.family) {
    case "gun":
      return part.spec.weaponCategory ?? null;
    case "sensor":
      return "RANGEFINDER";
    case "torpedo_launcher":
      return "TORPEDO_TUBE";
    case "fitting":
      return FITTING_CATEGORY_BY_INTERFACE[part.provides] ?? null;
    default:
      return null;
  }
}

/** The fire-control class a part declares, or null. */
function fcClassOf(part: FlattenedPart): string | null {
  const capability = part.capabilities?.find((c) => c.kind === "fire_control_class");
  return capability !== undefined && capability.kind === "fire_control_class"
    ? capability.class
    : null;
}

function entryOfPart(part: FlattenedPart): PartCatalogueEntry {
  const category = categoryOf(part);
  if (category === null) {
    throw new Error(
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
  };
}

const byId = (a: PartCatalogueEntry, b: PartCatalogueEntry): number =>
  compareCodePoints(a.id, b.id);

/** The family-level catalogue the designer's read-only displays show, from the compiled parts. */
export function buildPartCatalogueView(model: CompiledPartModel): readonly PartCatalogueEntry[] {
  return Object.values(model.partIndex.byId).filter(isFamilyLevelPart).map(entryOfPart).sort(byId);
}

/** The same view projected directly from the legacy `ComponentDef` catalogue (the fallback). */
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
