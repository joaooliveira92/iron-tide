import type {
  DesignHeaderData,
  FlattenedPart,
  LoadoutData,
  LoadoutEntryData,
} from "@bluewave/content-schema";
import { compareCodePoints } from "@bluewave/deterministic";
import type { AuthoredArmamentContent } from "./armamentContent.js";
import type { ArmourBalance } from "./armour.js";
import { buildArmourPartModel, translateArmourRegion } from "./armourPartAdapter.js";
import type { ComponentDef } from "./component.js";
import type { CompiledDesign, DesignDraft, ShipContext } from "./compileShared.js";
import { compileDesignFromLoadout, type ProductionCompile } from "./compile.js";
import { catalogueForNation } from "./componentVariants.js";
import type { Finding } from "./findings.js";
import { buildFittingPartModel, translateFittingPlacement } from "./fittingPartAdapter.js";
import {
  buildGunPartModel,
  gunKey,
  isSingleGunMount,
  type GunPartRequest,
} from "./gunPartAdapter.js";
import type { PropulsionPlant } from "./machinery.js";
import type { NationNavalProfile } from "./nationProfile.js";
import type { CompatibilityModel } from "./partCompatibility.js";
import { mountPartIdFor } from "./partCatalogue.js";
import { partCatalogue } from "./partQueries.js";
import { headerFromDraft } from "./partCatalogueReaders.js";
import type {
  FitAmmunitionCompatibility,
  FitMountCountRanges,
  FitNationInput,
  FitResult,
} from "./partFitTypes.js";
import { buildPlantPartModel, translateMachinery } from "./plantPartAdapter.js";
import { translateGunPlacement } from "./partReadPath.js";
import { buildLauncherPartModel, translateTubePlacement } from "./torpedoPartAdapter.js";

const WEAPON_GUN: ReadonlySet<string> = new Set([
  "MAIN_GUN",
  "SECONDARY_GUN",
  "DUAL_PURPOSE_GUN",
  "AA_WEAPON",
]);

export interface DraftCompileContent {
  readonly components: readonly ComponentDef[];
  readonly plants: readonly PropulsionPlant[];
  readonly navalProfiles: readonly NationNavalProfile[];
  readonly armament: AuthoredArmamentContent;
  readonly armour: Pick<ArmourBalance, "materialEffBp" | "materialAvailability">;
  readonly compatibility: CompatibilityModel;
  readonly torpedoDiameterUm: (torpedoModelId: string) => number | undefined;
  readonly parts: readonly FlattenedPart[];
}

export interface DraftTranslationIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface DraftLoadout {
  readonly header: DesignHeaderData;
  readonly loadout: LoadoutData;
  readonly mountCountRanges: FitMountCountRanges;
  readonly parts: readonly FlattenedPart[];
  readonly untranslated: readonly DraftTranslationIssue[];
  readonly placements: {
    readonly guns: number;
    readonly tubes: number;
    readonly fittings: number;
  };
}

export function draftToLoadout(input: {
  readonly designId: string;
  readonly draft: DesignDraft;
  readonly month: string;
  readonly content: DraftCompileContent;
}): DraftLoadout {
  const { designId, draft, month, content } = input;
  const nationId = draft.nationId;
  const profile = content.navalProfiles.find((p) => p.nationId === nationId);
  const applied =
    profile === undefined
      ? {}
      : catalogueForNation(content.components, profile, month).appliedModels;

  const fittingModel = buildFittingPartModel({ components: content.components });
  const plantModel = buildPlantPartModel({ plants: content.plants });
  const armourModel = buildArmourPartModel({ armour: content.armour });
  const launcherModel = buildLauncherPartModel({
    components: content.components,
    profiles: content.navalProfiles,
    torpedoDiameterUm: content.torpedoDiameterUm,
  });
  const requests: GunPartRequest[] = [];
  for (const placement of draft.placements) {
    const category = content.components.find((c) => c.id === placement.componentId)?.category;
    if (category !== undefined && WEAPON_GUN.has(category)) {
      requests.push({ nationId, familyId: placement.componentId });
    }
  }
  const gunModel = buildGunPartModel({
    content: content.armament,
    components: content.components,
    requests,
  });

  const production = new Map(content.parts.map((part) => [part.id, part] as const));
  const entries: LoadoutEntryData[] = [];
  const referenced = new Map<string, FlattenedPart>();
  const ranges: Record<string, { min: number; max: number; step: number }> = {};
  const untranslated: DraftTranslationIssue[] = [];
  const placements = { guns: 0, tubes: 0, fittings: 0 };
  const at = (instanceId: string, field: string) =>
    `${designId}.${instanceId}${field === "" ? "" : `.${field}`}`;
  const reference = (id: string, path: string): FlattenedPart | null => {
    const part = production.get(id);
    if (part === undefined) {
      untranslated.push({
        code: "PART_READ_PATH_MISSING_PART",
        path,
        message: `The pack has no part '${id}', so the placement cannot be compiled.`,
      });
      return null;
    }
    referenced.set(part.id, part);
    return part;
  };

  for (const placement of draft.placements) {
    const component = content.components.find((c) => c.id === placement.componentId);
    const category = component?.category;
    if (category === "TORPEDO_TUBE") {
      const r = translateTubePlacement({
        designId,
        placement,
        nationId,
        model: launcherModel,
        appliedModels: applied,
      });
      if (r.translation === null) {
        untranslated.push({
          code: r.untranslated.code,
          path: at(placement.instanceId, "part"),
          message: r.untranslated.message,
        });
        continue;
      }
      const launcher = reference(r.translation.launcherPart.id, at(placement.instanceId, "part"));
      if (launcher === null) continue;
      const loaded =
        launcher.family === "torpedo_launcher" ? launcher.spec.loadsTorpedo : undefined;
      if (loaded !== undefined && reference(loaded, at(placement.instanceId, "torpedo")) === null) {
        continue;
      }
      entries.push(r.translation.entry);
      const tubes = launcher.entryUnits ?? component?.parameters["tubes"];
      if (tubes !== undefined) ranges[launcher.id] = tubes;
      placements.tubes += 1;
    } else if (category !== undefined && WEAPON_GUN.has(category)) {
      const gun = gunModel.byRequest.get(gunKey(nationId, placement.componentId));
      if (gun === undefined) {
        untranslated.push({
          code: "PART_READ_PATH_NO_GUN_MODEL",
          path: at(placement.instanceId, "gun"),
          message: `No gun model for family '${placement.componentId}' available to '${nationId}'.`,
        });
        continue;
      }
      const t = translateGunPlacement({
        designId,
        placement,
        nationId,
        gun,
        content: content.armament,
        components: content.components,
      });
      if (t === null) {
        untranslated.push({
          code: "PART_READ_PATH_NO_MOUNT",
          path: at(placement.instanceId, "part"),
          message: `No ${gun.resolvedMountType} mount for family '${gun.familyId}'.`,
        });
        continue;
      }
      const mountId =
        t.disposition !== null || isSingleGunMount(t.legacyResolvedMountType)
          ? t.mountPart.id
          : mountPartIdFor(t.legacyMountId, t.gunsPerMount);
      const mount = reference(mountId, at(placement.instanceId, "part"));
      const gunPart = reference(t.gunPart.id, at(placement.instanceId, "gun"));
      if (mount === null || gunPart === null) continue;
      entries.push({ ...t.entry, part: mount.id });
      placements.guns += 1;
    } else {
      const r = translateFittingPlacement({ designId, placement, model: fittingModel });
      if (r.translation === null) {
        untranslated.push({
          code: r.untranslated.code,
          path: at(placement.instanceId, "part"),
          message: r.untranslated.message,
        });
        continue;
      }
      const fitting = reference(r.translation.record.part.id, at(placement.instanceId, "part"));
      if (fitting === null) continue;
      entries.push(r.translation.entry);
      const counted = r.translation.record.countParameter;
      const range =
        fitting.entryUnits ??
        (counted === null ? undefined : r.translation.record.legacy.parameters[counted]);
      if (range !== undefined) ranges[fitting.id] = range;
      placements.fittings += 1;
    }
  }

  const machinery = translateMachinery({ designId, machinery: draft.machinery, model: plantModel });
  if (machinery.translation === null) {
    untranslated.push({
      code: machinery.untranslated.code,
      path: `${designId}.machinery`,
      message: machinery.untranslated.message,
    });
  } else if (reference(machinery.translation.plantPart.id, `${designId}.machinery`) !== null) {
    entries.push(machinery.translation.entry);
  }

  draft.armour.regions.forEach((region, index) => {
    const r = translateArmourRegion({ designId, index, region, model: armourModel });
    if (r.translation === null) {
      untranslated.push({
        code: r.untranslated.code,
        path: `${designId}.armour[${String(index)}]`,
        message: r.untranslated.message,
      });
    } else if (
      reference(r.translation.materialPart.id, `${designId}.armour[${String(index)}]`) !== null
    ) {
      entries.push(r.translation.entry);
    }
  });

  const parts = [...referenced.values()].sort((a, b) => compareCodePoints(a.id, b.id));
  return {
    header: headerFromDraft(draft),
    loadout: { platform: draft.hull.hullFormId, entries },
    mountCountRanges: ranges,
    parts,
    untranslated,
    placements,
  };
}

export type DraftCompileResult =
  | {
      readonly status: "ACCEPTED";
      readonly fit: FitResult;
      readonly compiled: CompiledDesign;
    }
  | {
      readonly status: "REJECTED" | "NOT_EVALUABLE";
      readonly fit: FitResult;
      readonly findings: readonly Finding[];
    }
  | {
      readonly status: "UNTRANSLATED";
      readonly issues: readonly DraftTranslationIssue[];
      readonly findings: readonly Finding[];
    };

function blocking(id: string, message: string, path: string): Finding {
  return {
    id,
    severity: "BLOCKING",
    what: message,
    why: message,
    consequence:
      "The design cannot be built until every placement and fact translates to its parts.",
    remedies: [],
    evidence: { formulaId: id, inputs: {}, threshold: 0, value: 0 },
    parameters: { path },
  };
}

export function compileDraftFromParts(input: {
  readonly designId: string;
  readonly draft: DesignDraft;
  readonly month: string;
  readonly content: DraftCompileContent;
  readonly ctx: ShipContext;
  readonly nation?: FitNationInput;
  readonly unlockedTechnologies?: readonly string[];
  readonly ammunitionCompatibility?: FitAmmunitionCompatibility;
}): DraftCompileResult {
  const forward = draftToLoadout({
    designId: input.designId,
    draft: input.draft,
    month: input.month,
    content: input.content,
  });
  if (forward.untranslated.length > 0) {
    return {
      status: "UNTRANSLATED",
      issues: forward.untranslated,
      findings: forward.untranslated.map((issue) =>
        blocking(issue.code, issue.message, issue.path),
      ),
    };
  }
  const catalogue = partCatalogue({
    parts: forward.parts,
    slotTemplates: input.content.compatibility.slotTemplates,
    platforms: input.content.compatibility.platforms,
  });
  const result: ProductionCompile = compileDesignFromLoadout({
    designId: input.designId,
    header: forward.header,
    loadout: forward.loadout,
    catalogue,
    month: input.month,
    ctx: input.ctx,
    conditions: {
      ...(input.nation === undefined ? {} : { nation: input.nation }),
      mountCountRanges: forward.mountCountRanges,
      unlockedTechnologies: input.unlockedTechnologies ?? [...input.ctx.unlockedTechs],
      ...(input.ammunitionCompatibility === undefined
        ? {}
        : { ammunitionCompatibility: input.ammunitionCompatibility }),
    },
  });
  if (result.status === "UNTRANSLATED") {
    return {
      status: "UNTRANSLATED",
      issues: result.issues,
      findings: result.issues.map((issue) => blocking(issue.code, issue.message, issue.path)),
    };
  }
  return result;
}

export type LegacyCompileView =
  | {
      readonly valid: true;
      readonly compiled: CompiledDesign;
      readonly findings: readonly Finding[];
    }
  | {
      readonly valid: false;
      readonly compiled: null;
      readonly findings: readonly Finding[];
    };

export function toLegacyCompileView(result: DraftCompileResult): LegacyCompileView {
  if (result.status === "ACCEPTED") {
    return result.compiled.valid
      ? { valid: true, compiled: result.compiled, findings: result.compiled.findings }
      : { valid: false, compiled: null, findings: result.compiled.findings };
  }
  return { valid: false, compiled: null, findings: result.findings };
}
