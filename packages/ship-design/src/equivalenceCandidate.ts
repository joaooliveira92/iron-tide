/**
 * The candidate (parts) pipeline of the equivalence harness (ship-part-model SPM-R22, R23;
 * ticket 08). A reference design becomes one loadout through the read-path adapters, the
 * existing fit barrier (`validateLoadoutFit` → `deriveAfterFit`, I-10) decides whether anything
 * may be derived, and only an `ACCEPTED` loadout is compiled from its parts.
 *
 * It composes the adapters; it owns no fit rule and does not route `compileDesign` through the
 * barrier (ticket 11). Unresolved `FIT_MAGAZINE_*` relationships are carried to the report, not
 * decided here.
 */
import type { FlattenedPart, LoadoutEntryData } from "@bluewave/content-schema";
import { compareCodePoints } from "@bluewave/deterministic";
import { armourBalanceFromParts, armourRegionFromEntry } from "./armourPartAdapter.js";
import type { ArmourPartModel } from "./armourPartAdapter.js";
import { componentAccessOf } from "./armamentCompile.js";
import { nationHasArmamentContent } from "./armamentContent.js";
import type { AuthoredArmamentContent } from "./armamentContent.js";
import { compileDesign } from "./compile.js";
import type { CompiledDesign, DesignDraft, ShipContext } from "./compileShared.js";
import { catalogueForNation } from "./componentVariants.js";
import type { ComponentDef } from "./component.js";
import { fittingPlacementValues, translateFittingPlacement } from "./fittingPartAdapter.js";
import type { FittingPartModel } from "./fittingPartAdapter.js";
import type { GunPartModel } from "./gunPartAdapter.js";
import type { NationNavalProfile } from "./nationProfile.js";
import { platformSlots } from "./partCompatibility.js";
import type { CompatibilityModel } from "./partCompatibility.js";
import { deriveAfterFit, validateLoadoutFit } from "./partFit.js";
import type { FitMountCountRanges, FitResult } from "./partFitTypes.js";
import { resolveGunPlacementThroughParts } from "./partReadPath.js";
import type { UnresolvedGunPlacement } from "./partReadPath.js";
import { totalOf } from "./partQuantities.js";
import type { QuantityLine } from "./partQuantities.js";
import { shipTypeRequirementsFor } from "./shipTypeRegistry.js";
import {
  machineryPlanFromEntry,
  propulsionPlantFromPart,
  translateMachinery,
} from "./plantPartAdapter.js";
import type { PlantPartModel } from "./plantPartAdapter.js";
import { translateArmourRegion } from "./armourPartAdapter.js";
import { readPlacements } from "./partCatalogueReaders.js";
import { translateTubePlacement } from "./torpedoPartAdapter.js";
import type { LauncherPartModel } from "./torpedoPartAdapter.js";

const WEAPON_GUN = new Set(["MAIN_GUN", "SECONDARY_GUN", "DUAL_PURPOSE_GUN", "AA_WEAPON"]);

/** One reference design as the harness reads it. */
export interface EquivalenceDesign {
  readonly id: string;
  readonly month: string;
  readonly draft: DesignDraft;
}

/** Everything the candidate pipeline reads, passed in so this module performs no I/O. */
export interface CandidateEnvironment {
  readonly components: readonly ComponentDef[];
  readonly navalProfiles: readonly NationNavalProfile[];
  readonly armament: AuthoredArmamentContent;
  readonly compatibility: CompatibilityModel;
  readonly models: {
    readonly fittings: FittingPartModel;
    readonly plants: PlantPartModel;
    readonly armour: ArmourPartModel;
    readonly launchers: LauncherPartModel;
    readonly guns: GunPartModel;
  };
  /** The same national context production compiles in. */
  readonly contextFor: (month: string, nationId: string) => ShipContext;
}

export type EntryKind = "gun" | "tube" | "fitting";

/** SPM-R23 per-entry detail. Nothing here is derived from the legacy value it is compared to. */
export interface EntryDetail {
  readonly instanceId: string;
  readonly kind: EntryKind;
  /** The legacy component id of the placement. */
  readonly legacyComponentId: string;
  readonly parts: readonly string[];
  /** Legacy barrels (guns), tubes (launchers), or null (fittings carry no unit row). */
  readonly legacyUnits: number | null;
  readonly mountCount: number;
  readonly gunsPerMount: number | null;
  readonly containedUnits: number | null;
  readonly quantities: readonly QuantityLine[];
  readonly totals: {
    readonly massKg: number;
    readonly costMicro: number;
    readonly crew: number;
  };
  /** Tubes only. */
  readonly launcherCount: number | null;
  readonly launcherMassKg: number | null;
  /** Guns only: the mount type/id the legacy resolver chose, and the canonical ones. */
  readonly legacyMountType: string | null;
  readonly legacyMountId: string | null;
  readonly mountType: string | null;
  readonly mountId: string | null;
  /** The nine only: the translation disposition (migration provenance). */
  readonly disposition: string | null;
  /** Guns only: the legacy resolved mount record's fixed installation mass, when authored. */
  readonly legacyFixedInstallationKg: number | null;
}

export interface UntranslatedPlacement {
  readonly designId: string;
  readonly instanceId: string;
  readonly code: string;
  readonly message: string;
}

export interface CandidateDesign {
  readonly designId: string;
  readonly fit: FitResult | null;
  readonly entries: readonly EntryDetail[];
  readonly untranslated: readonly UntranslatedPlacement[];
  readonly unresolvedGuns: readonly UnresolvedGunPlacement[];
  readonly draft: DesignDraft | null;
  /** `null` unless the fit was `ACCEPTED` and derivation ran. */
  readonly compiled: CompiledDesign | null;
}

const present = <T>(value: T | null | undefined, what: string): T => {
  if (value === null || value === undefined) throw new Error(`equivalenceCandidate: ${what}`);
  return value;
};

const uniqueParts = (parts: readonly FlattenedPart[]): FlattenedPart[] => {
  const byId = new Map<string, FlattenedPart>();
  for (const part of parts) byId.set(part.id, part);
  return [...byId.values()].sort((a, b) => compareCodePoints(a.id, b.id));
};

const totalsOf = (lines: readonly QuantityLine[]): EntryDetail["totals"] => ({
  massKg: totalOf(lines, "massKg"),
  costMicro: totalOf(lines, "costMicro"),
  crew: totalOf(lines, "crew"),
});

/** The candidate pipeline for one design: translate, fit, then derive only after `ACCEPTED`. */
export function runCandidateDesign(
  design: EquivalenceDesign,
  env: CandidateEnvironment,
): CandidateDesign {
  const { draft } = design;
  const nationId = draft.nationId;
  const profile = present(
    env.navalProfiles.find((p) => p.nationId === nationId),
    `no naval profile for '${nationId}'`,
  );
  const ctx = env.contextFor(design.month, nationId);
  const applied = catalogueForNation(env.components, profile, design.month).appliedModels;
  const categoryOf = (id: string) => env.components.find((c) => c.id === id)?.category;

  const entries: LoadoutEntryData[] = [];
  const parts: FlattenedPart[] = [];
  const ranges: Record<string, { min: number; max: number; step: number }> = {};
  const details: EntryDetail[] = [];
  const untranslated: UntranslatedPlacement[] = [];
  const unresolvedGuns: UnresolvedGunPlacement[] = [];
  const gunCompiled = new Map<
    string,
    NonNullable<CompiledDesign["components"][number]["armament"]>
  >();
  const bad = (instanceId: string, code: string, message: string) =>
    untranslated.push({ designId: design.id, instanceId, code, message });

  for (const placement of draft.placements) {
    const category = categoryOf(placement.componentId);
    const instanceId = placement.instanceId;
    if (category === "TORPEDO_TUBE") {
      const r = translateTubePlacement({
        designId: design.id,
        placement,
        nationId,
        model: env.models.launchers,
        appliedModels: applied,
      });
      if (r.translation === null) {
        bad(instanceId, r.untranslated.code, r.untranslated.message);
        continue;
      }
      const t = r.translation;
      entries.push(t.entry);
      parts.push(t.launcherPart);
      const tubes = env.components.find((c) => c.id === placement.componentId)?.parameters["tubes"];
      if (tubes !== undefined) ranges[t.launcherPart.id] = tubes;
      details.push({
        instanceId,
        kind: "tube",
        legacyComponentId: placement.componentId,
        parts: [t.launcherPart.id],
        legacyUnits: t.legacyTubes ?? 1,
        mountCount: t.mountCount,
        gunsPerMount: null,
        containedUnits: t.mountCount,
        quantities: t.quantities,
        totals: totalsOf(t.quantities),
        launcherCount: t.mountCount,
        launcherMassKg: totalOf(
          t.quantities.filter((q) => q.scope === "launcher"),
          "massKg",
        ),
        legacyMountType: null,
        legacyMountId: null,
        mountType: null,
        mountId: null,
        disposition: null,
        legacyFixedInstallationKg: null,
      });
    } else if (category !== undefined && WEAPON_GUN.has(category)) {
      const r = resolveGunPlacementThroughParts({
        content: env.armament,
        components: env.components,
        model: env.models.guns,
        designId: design.id,
        placement,
        nationId,
        familyId: placement.componentId,
        month: design.month,
        unlockedTechnologyIds: ctx.unlockedTechs,
        componentAccess: componentAccessOf(ctx.navalProfile),
        useFirstClassArmament: nationHasArmamentContent(env.armament, nationId),
      });
      if (r.unresolved !== null) unresolvedGuns.push(r.unresolved);
      if (r.compiled !== null) gunCompiled.set(instanceId, r.compiled);
      const t = r.translation;
      if (t === null) {
        bad(
          instanceId,
          r.unresolved?.code ?? "PART_READ_PATH_NO_MOUNT",
          r.unresolved?.message ?? "no gun translation",
        );
        continue;
      }
      entries.push(t.entry);
      parts.push(t.mountPart, t.gunPart);
      details.push({
        instanceId,
        kind: "gun",
        legacyComponentId: placement.componentId,
        parts: [t.mountPart.id, t.gunPart.id],
        legacyUnits: t.legacyBarrels,
        mountCount: t.mountCount,
        gunsPerMount: t.gunsPerMount,
        containedUnits: t.containedUnits,
        quantities: t.quantities,
        totals: totalsOf(t.quantities),
        launcherCount: null,
        launcherMassKg: null,
        legacyMountType: t.legacyResolvedMountType,
        legacyMountId: t.legacyMountId,
        mountType: t.mountType,
        mountId: t.mountPart.id,
        disposition: t.disposition,
        legacyFixedInstallationKg:
          env.armament.gunMounts.find((m) => String(m.id) === t.legacyMountId)
            ?.baseInstallationMassKg ?? null,
      });
    } else {
      const r = translateFittingPlacement({
        designId: design.id,
        placement,
        model: env.models.fittings,
      });
      if (r.translation === null) {
        bad(instanceId, r.untranslated.code, r.untranslated.message);
        continue;
      }
      const t = r.translation;
      entries.push(t.entry);
      parts.push(t.record.part);
      const counted = t.record.countParameter;
      const range = counted === null ? undefined : t.record.legacy.parameters[counted];
      if (range !== undefined) ranges[t.record.part.id] = range;
      const values = fittingPlacementValues(t);
      details.push({
        instanceId,
        kind: "fitting",
        legacyComponentId: placement.componentId,
        parts: [t.record.part.id],
        legacyUnits: null,
        mountCount: t.mountCount,
        gunsPerMount: null,
        containedUnits: null,
        quantities: t.quantities,
        totals: { massKg: values.weightKg, costMicro: values.costMicro, crew: values.crew },
        launcherCount: null,
        launcherMassKg: null,
        legacyMountType: null,
        legacyMountId: null,
        mountType: null,
        mountId: null,
        disposition: null,
        legacyFixedInstallationKg: null,
      });
    }
  }

  const slots = platformSlots(env.compatibility, draft.hull.hullFormId) ?? [];
  const machinery = translateMachinery({
    designId: design.id,
    machinery: draft.machinery,
    model: env.models.plants,
  });
  const regions = draft.armour.regions.map((region, index) =>
    translateArmourRegion({ designId: design.id, index, region, model: env.models.armour }),
  );
  if (machinery.translation === null) {
    bad("machinery", machinery.untranslated.code, machinery.untranslated.message);
  } else {
    entries.push(machinery.translation.entry);
    parts.push(machinery.translation.plantPart);
  }
  for (const r of regions) {
    if (r.translation === null) {
      bad(`armour[${r.untranslated.index}]`, r.untranslated.code, r.untranslated.message);
    } else {
      entries.push(r.translation.entry);
      parts.push(r.translation.materialPart);
    }
  }
  const sortedUnresolved = [...unresolvedGuns].sort(
    (a, b) =>
      compareCodePoints(a.designId, b.designId) || compareCodePoints(a.instanceId, b.instanceId),
  );
  if (untranslated.length > 0 || machinery.translation === null) {
    return {
      designId: design.id,
      fit: null,
      entries: details,
      untranslated,
      unresolvedGuns: sortedUnresolved,
      draft: null,
      compiled: null,
    };
  }

  const requirements = shipTypeRequirementsFor(ctx, draft.requirement.category);
  const fit = validateLoadoutFit({
    parts: uniqueParts(parts),
    slotTemplates: env.compatibility.slotTemplates,
    platforms: env.compatibility.platforms,
    loadout: { platform: draft.hull.hullFormId, entries },
    month: design.month,
    nation: { nationId },
    mountCountRanges: ranges satisfies FitMountCountRanges,
    ...(requirements.length === 0 ? {} : { shipTypeRequirements: requirements }),
  });

  // The candidate compiles the placements its parts rebuild, never the original legacy
  // placements (ticket 11b). An incomplete loadout is a typed failure, not a fallback.
  const partById = new Map(uniqueParts(parts).map((p) => [p.id, p] as const));
  const reconstructed = readPlacements({
    designId: design.id,
    entries,
    partOf: (id) => partById.get(id),
    slotOf: (id) => slots.find((s) => s.id === id),
  });
  if (reconstructed.issues.length > 0) {
    for (const issue of reconstructed.issues) {
      bad(issue.path, issue.code, issue.message);
    }
    return {
      designId: design.id,
      fit,
      entries: details,
      untranslated,
      unresolvedGuns: sortedUnresolved,
      draft: null,
      compiled: null,
    };
  }

  const zoneOf = (slot: string) => slots.find((s) => s.id === slot)?.zone;
  const derived = deriveAfterFit(fit, () => {
    const candidateDraft: DesignDraft = {
      ...draft,
      placements: reconstructed.placements,
      machinery: machineryPlanFromEntry(
        machinery.translation,
        present(zoneOf(machinery.translation.entry.slot), "machinery slot has no zone"),
      ),
      armour: {
        ...draft.armour,
        regions: regions.map((r) => {
          const t = present(r.translation, "armour translation");
          const region = present(
            slots.find((s) => s.id === t.entry.slot)?.region,
            "armour slot has no region",
          );
          return armourRegionFromEntry(t.entry, region);
        }),
      },
    };
    const candidateCtx: ShipContext = {
      ...ctx,
      plants: env.models.plants.parts.map(propulsionPlantFromPart),
      balance: {
        ...ctx.balance,
        armour: armourBalanceFromParts(ctx.balance.armour, env.models.armour.parts),
      },
    };
    const compiled = compileDesign(candidateDraft, candidateCtx);
    // The weapon contract is the one the parts produced; a placement the parts did not
    // resolve carries none, so a legacy armament is never copied across.
    const components = compiled.components.map((c) => {
      const { armament: _legacy, ...rest } = c;
      const fromParts = gunCompiled.get(c.instanceId);
      return fromParts === undefined ? rest : { ...rest, armament: fromParts };
    });
    return { draft: candidateDraft, compiled: { ...compiled, components } };
  });
  return {
    designId: design.id,
    fit,
    entries: details,
    untranslated,
    unresolvedGuns: sortedUnresolved,
    draft: derived.derived ? derived.value.draft : null,
    compiled: derived.derived ? derived.value.compiled : null,
  };
}
