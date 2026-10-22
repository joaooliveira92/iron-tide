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

const LAUNCH_TYPES = [
  "ABOVE_WATER_FIXED",
  "ABOVE_WATER_TRAINABLE",
  "UNDERWATER_FIXED",
  "UNDERWATER_TRAINABLE",
  "SUBMARINE_INTERNAL",
] as const satisfies readonly FlattenedTorpedoPart["spec"]["launchTypes"][number][];
export type TorpedoMountType = (typeof LAUNCH_TYPES)[number];
export interface TorpedoSettingSource {
  readonly settingId: string;
  readonly speedKnotsBp: number;
  readonly rangeM: number;
}

export interface TorpedoWarheadReRatingSource {
  readonly explosiveMassKg: number;
  readonly explosiveEquivalentMassKg: number;
  readonly from: string;
  readonly provenance: Provenance;
}

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
  readonly technologyPrerequisiteIds: readonly string[];
  readonly compatibleLauncherFamilyIds: readonly string[];
  readonly tubeHitHazardPolicyId: TorpedoTubeHitHazardPolicy;
  readonly oxygenState: { readonly wakeVisibilityModifierBp: number } | null;
  readonly availableFrom: string;
  readonly availableUntil?: string | null;
  readonly warheadFirstPattern?: TorpedoWarheadReRatingSource;
  readonly provenance: Provenance;
  readonly sourceFile: string;
}

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
  readonly parts: readonly FlattenedTorpedoPart[];
  readonly unread: readonly UnreadTorpedo[];
}

export interface TorpedoSourceFieldDestination {
  readonly field: string;
  readonly destination: string;
}

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
  { field: "depthKeepingProfile", destination: "(none)" },
  { field: "ownerNationIds", destination: "(none)" },
  { field: "productionRequirementId", destination: "(none)" },
  { field: "contentVersion", destination: "(none)" },
  { field: "contentHash", destination: "(none)" },
];

const MAPPED_MODEL_KEYS: ReadonlySet<string> = new Set(TORPEDO_SOURCE_FIELDS.map((f) => f.field));
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

const LAUNCH_TYPE_ORDER: ReadonlyMap<string, number> = new Map(
  LAUNCH_TYPES.map((mountType, index) => [mountType as string, index]),
);

function launchTypeOfFamily(familyId: string): TorpedoMountType | undefined {
  for (const mountType of LAUNCH_TYPES) {
    const suffix = mountType.toLowerCase();
    if (familyId === suffix || familyId.endsWith(`_${suffix}`)) return mountType;
  }
  return undefined;
}

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
