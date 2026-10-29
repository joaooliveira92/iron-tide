import type {
  FlattenedPart,
  LoadoutEntryData,
  QuantityComponentData,
} from "@bluewave/content-schema";
import { compareCodePoints } from "@bluewave/deterministic";
import type { ComponentDef } from "./component.js";
import { LEGACY_COMPONENT_SOURCE } from "./component.js";
import type { PlacementSpec } from "./compileShared.js";
import { applyComponentOverrides } from "./componentVariants.js";
import {
  QUANTITY_STEM,
  readComponentQuantities,
  type QuantityReadIssue,
} from "./legacyComponentQuantities.js";
import type { NationNavalProfile } from "./nationProfile.js";
import { compatibilitySlotId } from "./partCompatibility.js";
import { quantityLines, type QuantityLine } from "./partQuantities.js";

export type FlattenedLauncherPart = Extract<FlattenedPart, { readonly family: "torpedo_launcher" }>;
export type LaunchType = FlattenedLauncherPart["spec"]["launchType"];

const LAUNCH_TYPES: ReadonlySet<string> = new Set<LaunchType>([
  "ABOVE_WATER_FIXED",
  "ABOVE_WATER_TRAINABLE",
  "UNDERWATER_FIXED",
  "UNDERWATER_TRAINABLE",
  "SUBMARINE_INTERNAL",
]);

function isLaunchType(value: string): value is LaunchType {
  return LAUNCH_TYPES.has(value);
}

export function navalProfileFile(nationId: string): string {
  return `ship-building/naval-profiles/${nationId}.yaml`;
}

export const TORPEDO_WAIVER = { code: "DQ-TORPEDO-001", waives: "diameterUmEqualsBore" } as const;

export interface UnreadLauncher {
  readonly id: string;
  readonly code:
    | "PART_READ_PATH_NO_TORPEDO_DIAMETER"
    | "PART_READ_PATH_UNKNOWN_LAUNCH_TYPE"
    | "PART_READ_PATH_UNREADABLE_QUANTITY";
  readonly message: string;
}

export interface LauncherPartModel {
  readonly parts: readonly FlattenedLauncherPart[];
  readonly variantNation: ReadonlyMap<string, string>;
  readonly unread: readonly UnreadLauncher[];
}

function launcherQuantities(def: ComponentDef): {
  readonly quantities: QuantityComponentData[];
  readonly issues: readonly string[];
} {
  const c = def.constants;
  const out: QuantityComponentData[] = [];
  const push = (id: string, kind: QuantityComponentData["kind"], value: number | undefined) => {
    if (value !== undefined) out.push({ id, kind, value, basis: "PER_PART_UNIT" });
  };
  push("tube_mass", "massKg", c.tube_kg);
  push(
    "stowed_torpedo_mass",
    "massKg",
    c.torpedo_kg !== undefined && c.torpedoes_per_tube !== undefined
      ? c.torpedo_kg * c.torpedoes_per_tube
      : undefined,
  );
  push("tube_cost", "costMicro", c.cost_per_tube_micro);
  const perTube = readComponentQuantities(def, {
    fields: ["crew", "volumeLitre", "deckFootprintMm2"],
    countParameter: "tubes",
    perUnitBasis: "PER_PART_UNIT",
    idFor: (field, term) =>
      term === "fixed" ? `${QUANTITY_STEM[field]}_fixed` : `tube_${QUANTITY_STEM[field]}`,
  });
  const fixed = perTube.quantities.filter((q) => q.basis !== "PER_PART_UNIT");
  return {
    quantities: [...out, ...perTube.quantities.filter((q) => q.basis === "PER_PART_UNIT")],
    issues: [
      ...perTube.issues.map((i: QuantityReadIssue) => `${i.code}: ${i.message}`),
      ...fixed.map((q) => `${q.id} = ${q.value} is a fixed term; launchers have none (T2).`),
    ],
  };
}

export function buildLauncherPartModel(input: {
  readonly components: readonly ComponentDef[];
  readonly profiles: readonly NationNavalProfile[];
  readonly torpedoDiameterUm: (torpedoModelId: string) => number | undefined;
}): LauncherPartModel {
  const parts: FlattenedLauncherPart[] = [];
  const unread: UnreadLauncher[] = [];
  const bases = new Map<
    string,
    { def: ComponentDef; part: FlattenedLauncherPart; loads: string; loadsDiameterUm: number }
  >();
  for (const def of input.components) {
    const mount = def.torpedoMount;
    if (def.category !== "TORPEDO_TUBE" || mount === undefined) continue;
    if (!isLaunchType(mount.mountType)) {
      unread.push({
        id: def.id,
        code: "PART_READ_PATH_UNKNOWN_LAUNCH_TYPE",
        message: `Launcher '${def.id}' has launch type '${mount.mountType}', outside the closed set.`,
      });
      continue;
    }
    const loadsDiameterUm = input.torpedoDiameterUm(mount.torpedoModelId);
    if (loadsDiameterUm === undefined) {
      unread.push({
        id: def.id,
        code: "PART_READ_PATH_NO_TORPEDO_DIAMETER",
        message: `Launcher '${def.id}' loads '${mount.torpedoModelId}', which has no structured diameter.`,
      });
      continue;
    }
    const read = launcherQuantities(def);
    if (read.issues.length > 0) {
      unread.push({
        id: def.id,
        code: "PART_READ_PATH_UNREADABLE_QUANTITY",
        message: `Launcher '${def.id}': ${read.issues.join(" ")}`,
      });
      continue;
    }
    const part: FlattenedLauncherPart = {
      id: def.id,
      family: "torpedo_launcher",
      provides: "torpedo_launcher",
      name: def.displayName,
      lifecycle: {
        availableFrom: def.introduction.fromMonth,
        availableUntil: def.introduction.obsoleteMonth,
        ...(def.requires.length > 0 ? { requires: [...def.requires] } : {}),
      },
      slots: [{ id: "torpedo", accepts: ["torpedo"], constraints: { diameterUmEqualsBore: true } }],
      spec: { launchType: mount.mountType, boreDiameterUm: loadsDiameterUm },
      quantities: read.quantities,
      revisions: [],
      origin: { sourceFile: def.sourceFile ?? LEGACY_COMPONENT_SOURCE },
      provenance: {
        sourceStatus: "PLACEHOLDER",
        confidence: "LOW",
        kind: "game_conversion",
        sources: [],
        note: `Read from legacy component '${def.id}', which has no structured provenance.`,
      },
    };
    bases.set(def.id, { def, part, loads: mount.torpedoModelId, loadsDiameterUm });
    parts.push(part);
  }

  const variantNation = new Map<string, string>();
  const profiles = [...input.profiles].sort((a, b) => compareCodePoints(a.nationId, b.nationId));
  for (const profile of profiles) {
    for (const variant of profile.componentVariants) {
      const base = bases.get(variant.familyId);
      if (base === undefined) continue;
      const boreDiameterUm = profile.hardCapabilities.domesticTorpedoDiameterUm;
      const read = launcherQuantities(applyComponentOverrides(base.def, variant.overrides));
      if (read.issues.length > 0) {
        unread.push({
          id: variant.id,
          code: "PART_READ_PATH_UNREADABLE_QUANTITY",
          message: `Launcher variant '${variant.id}': ${read.issues.join(" ")}`,
        });
        continue;
      }
      const { quantities } = read;
      const inherited = quantities
        .filter((q) => base.part.quantities.some((b) => b.id === q.id && b.value === q.value))
        .map((q) => q.id);
      const waived = boreDiameterUm !== base.loadsDiameterUm;
      parts.push({
        ...base.part,
        id: variant.id,
        name: variant.designation,
        nation: profile.nationId,
        spec: { ...base.part.spec, boreDiameterUm },
        quantities,
        ...(waived
          ? {
              legacyExceptions: [
                {
                  ...TORPEDO_WAIVER,
                  forPart: base.loads,
                  note:
                    `Structured national diameter ${boreDiameterUm} um differs from the ` +
                    `${base.loadsDiameterUm} um '${base.loads}' it loads; preserved from legacy content.`,
                },
              ],
            }
          : {}),
        origin: {
          sourceFile: navalProfileFile(profile.nationId),
          prototype: {
            id: base.part.id,
            sourceFile: base.def.sourceFile ?? LEGACY_COMPONENT_SOURCE,
            inheritedSpec: ["launchType"],
            inheritedQuantities: inherited,
          },
        },
        provenance: {
          ...variant.provenance,
          sources: variant.provenance.sources.map((s) => ({ ...s })),
        },
      });
      variantNation.set(variant.id, profile.nationId);
    }
  }
  return {
    parts: parts.sort((a, b) => compareCodePoints(a.id, b.id)),
    variantNation,
    unread: unread.sort((a, b) => compareCodePoints(a.id, b.id)),
  };
}

export interface TubePlacementTranslation {
  readonly designId: string;
  readonly instanceId: string;
  readonly nationId: string;
  readonly componentId: string;
  readonly legacyTubes: number | null;
  readonly defaulted: boolean;
  readonly mountCount: number;
  readonly launcherPart: FlattenedLauncherPart;
  readonly entry: LoadoutEntryData;
  readonly quantities: readonly QuantityLine[];
}

export interface UntranslatedTubePlacement {
  readonly designId: string;
  readonly instanceId: string;
  readonly nationId: string;
  readonly componentId: string;
  readonly code: "PART_READ_PATH_INVALID_TUBE_COUNT" | "PART_READ_PATH_NO_LAUNCHER";
  readonly message: string;
}

export type TubePlacementResult =
  | { readonly translation: TubePlacementTranslation; readonly untranslated: null }
  | { readonly translation: null; readonly untranslated: UntranslatedTubePlacement };

export function translateTubePlacement(input: {
  readonly designId: string;
  readonly placement: PlacementSpec;
  readonly nationId: string;
  readonly model: LauncherPartModel;
  readonly appliedModels: Readonly<Record<string, string>>;
}): TubePlacementResult {
  const { placement } = input;
  const where = {
    designId: input.designId,
    instanceId: placement.instanceId,
    nationId: input.nationId,
    componentId: placement.componentId,
  };
  const fail = (code: UntranslatedTubePlacement["code"], message: string): TubePlacementResult => ({
    translation: null,
    untranslated: { ...where, code, message },
  });

  const tubes = placement.params?.tubes;
  if (tubes !== undefined && !(Number.isInteger(tubes) && tubes > 0)) {
    return fail(
      "PART_READ_PATH_INVALID_TUBE_COUNT",
      `tubes must be a positive integer; '${String(tubes)}' fails translation (I-23).`,
    );
  }
  const applied = input.appliedModels[placement.componentId];
  const variantId =
    applied !== undefined && input.model.variantNation.get(applied) === input.nationId
      ? applied
      : undefined;
  const partId = variantId ?? placement.componentId;
  const launcherPart = input.model.parts.find((p) => p.id === partId);
  if (launcherPart === undefined) {
    return fail("PART_READ_PATH_NO_LAUNCHER", `No launcher part '${partId}' was read.`);
  }
  const mountCount = tubes ?? 1;
  return {
    untranslated: null,
    translation: {
      ...where,
      legacyTubes: tubes ?? null,
      defaulted: tubes === undefined,
      mountCount,
      launcherPart,
      entry: {
        id: placement.instanceId,
        slot: compatibilitySlotId(placement.zoneId, "torpedo_launcher"),
        part: launcherPart.id,
        mountCount,
        stationPermille: placement.stationPermille,
        ...(placement.side !== undefined ? { side: placement.side } : {}),
        ...(placement.magazineRef !== undefined ? { magazineEntry: placement.magazineRef } : {}),
      },
      quantities: quantityLines(
        launcherPart.quantities,
        "launcher",
        launcherPart.id,
        mountCount,
        1,
      ),
    },
  };
}
