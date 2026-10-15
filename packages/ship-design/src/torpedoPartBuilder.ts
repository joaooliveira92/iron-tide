/**
 * The torpedo-part builder (ship-part-model ticket 13a, SPM-R17).
 *
 * Additive and in memory only, like the launcher read path (`torpedoPartAdapter.ts`). Each
 * authoritative combat torpedo model becomes one strictly-shaped `family: torpedo` part whose
 * spec carries exactly the values combat reads (SPM-R17): diameter, mass, warhead type and mass,
 * propulsion, ordered speed/range settings, arming distance, reliability, guidance, launch types
 * and the tube-hit hazard policy. A model re-rated after introduction (the 1884 Whitehead Mk IV)
 * carries the first-pattern value as its base spec and the model's current value as a dated
 * revision with its own provenance.
 *
 * The builder performs no I/O and fixes its own input shape, so it never imports `@bluewave/combat`
 * (the codemod passes the models structurally). Every ordering is codepoint order and every
 * generated id is collision-checked by `buildPartCatalogue`.
 */
import type {
  FlattenedPart,
  Provenance,
  QuantityComponentData,
  TorpedoPropulsionType,
  TorpedoTubeHitHazardPolicy,
  TorpedoWarheadType,
} from "@bluewave/content-schema";
import { compareCodePoints } from "@bluewave/deterministic";

export type FlattenedTorpedoPart = Extract<FlattenedPart, { readonly family: "torpedo" }>;

/**
 * The DESIGN-40 §2 mount-type vocabulary, in `interfaces/1` order. Defined locally because
 * ship-design imports `@bluewave/content-schema` as types only (no Effect in the renderer).
 */
const LAUNCH_TYPES = [
  "ABOVE_WATER_FIXED",
  "ABOVE_WATER_TRAINABLE",
  "UNDERWATER_FIXED",
  "UNDERWATER_TRAINABLE",
  "SUBMARINE_INTERNAL",
] as const satisfies readonly FlattenedTorpedoPart["spec"]["launchTypes"][number][];
export type TorpedoMountType = (typeof LAUNCH_TYPES)[number];
/** One ordered speed/range setting of a source torpedo model (combat's `orderedSettings`). */
export interface TorpedoSettingSource {
  readonly settingId: string;
  /** Speed in thousandths of a knot (combat's `speedKnotsBp`). */
  readonly speedKnotsBp: number;
  readonly rangeM: number;
}

/**
 * The first-pattern warhead of a torpedo re-rated after introduction, plus the dated revision
 * that restores the model's current warhead. The provenance grounds the re-rating.
 */
export interface TorpedoWarheadReRatingSource {
  readonly explosiveMassKg: number;
  readonly explosiveEquivalentMassKg: number;
  /** The revision month (`YYYY-MM`) the re-rating took effect, e.g. `1884-01`. */
  readonly from: string;
  readonly provenance: Provenance;
}

/**
 * The authoritative fields of one combat torpedo model the builder reads. Structurally compatible
 * with `@bluewave/combat`'s `TorpedoModelDefinition`; a subset of its fields (the ones the part
 * model carries) plus the content-side lifecycle and provenance the engine model does not have.
 */
export interface TorpedoModelSource {
  readonly torpedoModelId: string;
  readonly diameterMm: number;
  readonly massKg: number;
  readonly warheadType: TorpedoWarheadType;
  readonly warheadExplosiveMassKg: number;
  readonly warheadExplosiveEquivalentMassKg: number;
  readonly propulsionType: TorpedoPropulsionType;
  readonly orderedSettings: readonly TorpedoSettingSource[];
  readonly minimumArmingDistanceM: number;
  readonly reliabilityBp: number;
  readonly guidanceCapability: string;
  /** Technology prerequisites combat's §4 platform-technology predicate reads (may be empty). */
  readonly technologyPrerequisiteIds: readonly string[];
  /** Combat launcher-family ids; their mount-type suffix becomes the part's `launchTypes`. */
  readonly compatibleLauncherFamilyIds: readonly string[];
  readonly tubeHitHazardPolicyId: TorpedoTubeHitHazardPolicy;
  /** Non-null exactly for an `OXYGEN` model. */
  readonly oxygenState: { readonly wakeVisibilityModifierBp: number } | null;
  /** Inclusive availability month, grounded in the model's introduction. */
  readonly availableFrom: string;
  /** Exclusive retirement, or `null` when still available. */
  readonly availableUntil?: string | null;
  /** When present, the model was re-rated: base spec carries the first-pattern warhead. */
  readonly warheadFirstPattern?: TorpedoWarheadReRatingSource;
  /** The part's structured provenance (grounded in the torpedo research). */
  readonly provenance: Provenance;
  /** Content-relative source file the record was authored from. */
  readonly sourceFile: string;
}

/** A torpedo the builder could not read, with the reason (never dropped silently). */
export interface UnreadTorpedo {
  readonly id: string;
  readonly code:
    | "TORPEDO_READ_PATH_UNKNOWN_LAUNCH_FAMILY"
    | "TORPEDO_READ_PATH_UNKNOWN_WARHEAD_TYPE"
    | "TORPEDO_READ_PATH_UNKNOWN_PROPULSION_TYPE"
    | "TORPEDO_READ_PATH_UNKNOWN_HAZARD_POLICY"
    | "TORPEDO_READ_PATH_OXYGEN_STATE_MISMATCH"
    | "TORPEDO_READ_PATH_UNMAPPED_FIELD";
  readonly message: string;
}

export interface TorpedoPartModel {
  /** Every torpedo part, codepoint-ordered by id. */
  readonly parts: readonly FlattenedTorpedoPart[];
  readonly unread: readonly UnreadTorpedo[];
}

/** One combat torpedo-model field and the part-schema location that holds it. */
export interface TorpedoSourceFieldDestination {
  readonly field: string;
  /** A part-schema path, or `"(none)"` when the field is not carried. */
  readonly destination: string;
}

/**
 * Every authoritative combat torpedo-model field the migration reads, with its one destination
 * (the `PART_SOURCE_FIELDS` discipline applied to torpedoes). A field marked `"(none)"` is
 * intentionally not carried. The builder fails an unmapped key with a typed, path-specific
 * `TORPEDO_READ_PATH_UNMAPPED_FIELD`, so a new model field cannot be dropped silently.
 */
export const TORPEDO_SOURCE_FIELDS: readonly TorpedoSourceFieldDestination[] = [
  { field: "torpedoModelId", destination: "part.id" },
  { field: "diameterMm", destination: "spec.diameterUm" },
  { field: "massKg", destination: "spec.massKg + quantities[torpedo_mass]" },
  { field: "warheadType", destination: "spec.warheadType" },
  {
    field: "warheadExplosiveMassKg",
    destination: "spec.warheadExplosiveMassKg | revisions[].spec.warheadExplosiveMassKg",
  },
  {
    field: "warheadExplosiveEquivalentMassKg",
    destination:
      "spec.warheadExplosiveEquivalentMassKg | revisions[].spec.warheadExplosiveEquivalentMassKg",
  },
  { field: "propulsionType", destination: "spec.propulsionType" },
  { field: "orderedSettings", destination: "spec.speedSettings" },
  { field: "orderedSettings[].settingId", destination: "spec.speedSettings[].settingId" },
  { field: "minimumArmingDistanceM", destination: "spec.minimumArmingDistanceM" },
  { field: "reliabilityBp", destination: "spec.reliabilityBp" },
  { field: "guidanceCapability", destination: "spec.guidanceCapability" },
  { field: "technologyPrerequisiteIds", destination: "spec.technologyPrerequisiteIds" },
  { field: "compatibleLauncherFamilyIds", destination: "spec.launchTypes (+ spec.diameterUm)" },
  {
    field: "oxygenState",
    destination: "spec.oxygenWakeVisibilityModifierBp (per-model modifier only)",
  },
  { field: "tubeHitHazardPolicyId", destination: "spec.tubeHitHazardPolicy" },
  // Fields intentionally not carried by a part (unread by combat, or engine bookkeeping).
  { field: "depthKeepingProfile", destination: "(none)" },
  { field: "ownerNationIds", destination: "(none)" },
  { field: "productionRequirementId", destination: "(none)" },
  { field: "contentVersion", destination: "(none)" },
  { field: "contentHash", destination: "(none)" },
];

/** The combat-model keys with a documented destination. */
const MAPPED_MODEL_KEYS: ReadonlySet<string> = new Set(TORPEDO_SOURCE_FIELDS.map((f) => f.field));
/** The content-side fields the source adds to the combat model (not legacy model fields). */
const CONTENT_SIDE_KEYS: ReadonlySet<string> = new Set([
  "availableFrom",
  "availableUntil",
  "warheadFirstPattern",
  "provenance",
  "sourceFile",
]);

const WARHEAD_TYPES: ReadonlySet<string> = new Set([
  "WET_GUNCOTTON",
  "TNT",
  "TORPEX",
  "TPX",
  "HBX",
  "HEXANITE",
  "TYPE_97",
]);
const PROPULSION_TYPES: ReadonlySet<string> = new Set([
  "COMPRESSED_AIR",
  "WET_HEATER",
  "ELECTRIC",
  "OXYGEN",
]);
const HAZARD_POLICIES: ReadonlySet<string> = new Set(["ORDINARY", "OXYGEN", "ELECTRIC"]);

/** The canonical launch-type order of `interfaces/1`: the part's `launchTypes` sort key. */
const LAUNCH_TYPE_ORDER: ReadonlyMap<string, number> = new Map(
  LAUNCH_TYPES.map((mountType, index) => [mountType as string, index]),
);

/**
 * The mount type a combat launcher-family id names, from its lower-snake suffix
 * (`14in_above_water_trainable` → `ABOVE_WATER_TRAINABLE`). `undefined` when none matches.
 */
function launchTypeOfFamily(familyId: string): TorpedoMountType | undefined {
  for (const mountType of LAUNCH_TYPES) {
    const suffix = mountType.toLowerCase();
    if (familyId === suffix || familyId.endsWith(`_${suffix}`)) return mountType;
  }
  return undefined;
}

/** The launch types a model declares, deduplicated and in the canonical mount-type order. */
function launchTypesOf(
  model: TorpedoModelSource,
): { readonly launchTypes: readonly TorpedoMountType[] } | { readonly failure: UnreadTorpedo } {
  const types = new Set<TorpedoMountType>();
  for (const familyId of model.compatibleLauncherFamilyIds) {
    const mountType = launchTypeOfFamily(familyId);
    if (mountType === undefined) {
      return {
        failure: {
          id: model.torpedoModelId,
          code: "TORPEDO_READ_PATH_UNKNOWN_LAUNCH_FAMILY",
          message: `Launcher family '${familyId}' names no DESIGN-40 §2 mount type.`,
        },
      };
    }
    types.add(mountType);
  }
  if (types.size === 0) {
    return {
      failure: {
        id: model.torpedoModelId,
        code: "TORPEDO_READ_PATH_UNKNOWN_LAUNCH_FAMILY",
        message: "A torpedo declares no compatible launcher family.",
      },
    };
  }
  const launchTypes = [...types].sort(
    (a, b) => (LAUNCH_TYPE_ORDER.get(a) ?? 0) - (LAUNCH_TYPE_ORDER.get(b) ?? 0),
  );
  return { launchTypes };
}

function provenanceOf(model: TorpedoModelSource): Provenance {
  return {
    ...model.provenance,
    sources: model.provenance.sources.map((s) => ({ ...s })),
  };
}

/** Build the whole torpedo catalogue from the authoritative models. */
export function buildTorpedoPartModel(input: {
  readonly models: readonly TorpedoModelSource[];
}): TorpedoPartModel {
  const parts: FlattenedTorpedoPart[] = [];
  const unread: UnreadTorpedo[] = [];
  for (const model of [...input.models].sort((a, b) =>
    compareCodePoints(a.torpedoModelId, b.torpedoModelId),
  )) {
    const unmapped = Object.keys(model).find(
      (key) => !MAPPED_MODEL_KEYS.has(key) && !CONTENT_SIDE_KEYS.has(key),
    );
    if (unmapped !== undefined) {
      unread.push({
        id: model.torpedoModelId,
        code: "TORPEDO_READ_PATH_UNMAPPED_FIELD",
        message: `Torpedo model field '${unmapped}' has no destination in the part schema.`,
      });
      continue;
    }
    if (!WARHEAD_TYPES.has(model.warheadType)) {
      unread.push({
        id: model.torpedoModelId,
        code: "TORPEDO_READ_PATH_UNKNOWN_WARHEAD_TYPE",
        message: `Warhead type '${model.warheadType}' is outside the closed set.`,
      });
      continue;
    }
    if (!PROPULSION_TYPES.has(model.propulsionType)) {
      unread.push({
        id: model.torpedoModelId,
        code: "TORPEDO_READ_PATH_UNKNOWN_PROPULSION_TYPE",
        message: `Propulsion type '${model.propulsionType}' is outside the closed set.`,
      });
      continue;
    }
    if (!HAZARD_POLICIES.has(model.tubeHitHazardPolicyId)) {
      unread.push({
        id: model.torpedoModelId,
        code: "TORPEDO_READ_PATH_UNKNOWN_HAZARD_POLICY",
        message: `Hazard policy '${model.tubeHitHazardPolicyId}' is outside the closed set.`,
      });
      continue;
    }
    const isOxygen = model.propulsionType === "OXYGEN";
    if (isOxygen !== (model.oxygenState !== null)) {
      unread.push({
        id: model.torpedoModelId,
        code: "TORPEDO_READ_PATH_OXYGEN_STATE_MISMATCH",
        message: "An oxygen state is present exactly for an OXYGEN model.",
      });
      continue;
    }
    const launch = launchTypesOf(model);
    if ("failure" in launch) {
      unread.push(launch.failure);
      continue;
    }

    const first = model.warheadFirstPattern;
    const baseExplosiveMassKg = first?.explosiveMassKg ?? model.warheadExplosiveMassKg;
    const baseExplosiveEquivalentMassKg =
      first?.explosiveEquivalentMassKg ?? model.warheadExplosiveEquivalentMassKg;
    const spec = {
      diameterUm: model.diameterMm * 1000,
      massKg: model.massKg,
      warheadType: model.warheadType,
      warheadExplosiveMassKg: baseExplosiveMassKg,
      warheadExplosiveEquivalentMassKg: baseExplosiveEquivalentMassKg,
      propulsionType: model.propulsionType,
      speedSettings: model.orderedSettings.map((s) => ({
        settingId: s.settingId,
        speedMilliKnots: s.speedKnotsBp,
        rangeM: s.rangeM,
      })),
      minimumArmingDistanceM: model.minimumArmingDistanceM,
      reliabilityBp: model.reliabilityBp,
      guidanceCapability: model.guidanceCapability,
      technologyPrerequisiteIds: [...model.technologyPrerequisiteIds],
      launchTypes: launch.launchTypes,
      tubeHitHazardPolicy: model.tubeHitHazardPolicyId,
      ...(isOxygen && model.oxygenState !== null
        ? { oxygenWakeVisibilityModifierBp: model.oxygenState.wakeVisibilityModifierBp }
        : {}),
    };

    const revisions: FlattenedTorpedoPart["revisions"] =
      first === undefined
        ? []
        : [
            {
              from: first.from,
              spec: {
                warheadExplosiveMassKg: model.warheadExplosiveMassKg,
                warheadExplosiveEquivalentMassKg: model.warheadExplosiveEquivalentMassKg,
              },
              provenance: {
                ...first.provenance,
                sources: first.provenance.sources.map((s) => ({ ...s })),
              },
            },
          ];

    const quantities: QuantityComponentData[] = [
      { id: "torpedo_mass", kind: "massKg", value: model.massKg, basis: "PER_PART_UNIT" },
    ];

    parts.push({
      id: model.torpedoModelId,
      family: "torpedo",
      provides: "torpedo",
      name: model.torpedoModelId,
      lifecycle: {
        availableFrom: model.availableFrom,
        ...(model.availableUntil !== undefined ? { availableUntil: model.availableUntil } : {}),
      },
      spec,
      quantities,
      revisions,
      origin: { sourceFile: model.sourceFile },
      provenance: provenanceOf(model),
    });
  }
  return {
    parts: parts.sort((a, b) => compareCodePoints(a.id, b.id)),
    unread: unread.sort((a, b) => compareCodePoints(a.id, b.id)),
  };
}
