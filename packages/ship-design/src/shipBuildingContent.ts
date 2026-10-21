import type { ArchetypeId, ArchetypeSpec, AiEnvironment } from "./ai.js";
import type { ComponentDef } from "./component.js";
import type { ConstructionBalance } from "./construction.js";
import {
  hullFormsFromRecords,
  shipBalanceFromRecord,
  type HullFormRecord,
} from "./contextBuilder.js";
import type { CostBalance } from "./cost.js";
import type { CveBalance } from "./cve.js";
import type { Facility } from "./compile.js";
import type { PropulsionPlant } from "./machinery.js";
import type { ThreatProfile } from "./armour.js";
import type { WorkshopEnvironment } from "./workshop.js";
import { checkRebuildBalance, type RebuildBalance } from "./rebuild.js";
import { checkRevisionBalance, type RevisionBalance } from "./revision.js";
import { checkStudyBalance, type StudyBalance } from "./study.js";
import { buildYards } from "./yards.js";
import { catalogueForNation } from "./componentVariants.js";
import { type NationNavalProfile, resolveNavalProfile } from "./nationProfile.js";
import { compareCodePoints } from "@bluewave/deterministic";
import type { AuthoredArmamentContent } from "./armamentContent.js";
import type { StarterDesign } from "./shipTypeRoster.js";
import type { DesignDraft } from "./compileShared.js";
import type {
  CompiledPartModel,
  ReferenceDesignLoadoutData,
  ReferenceDesignProvenance,
} from "@bluewave/content-schema";
import { buildProductionPartModel } from "./compileProduction.js";
import type { DraftCompileContent } from "./compileDraft.js";
import {
  buildCompatibilitySlots,
  platformSlots,
  type CompatibilityModel,
} from "./partCompatibility.js";
import { rebuildDraft } from "./partCatalogueReaders.js";

// Re-exported so the desktop main process can type a reference design's provenance without importing the
// content-schema package directly (its content loaders must not pull in the schema; a main-process test pins that).
export type { ReferenceDesignProvenance, ReferenceValueProvenance } from "@bluewave/content-schema";

/** A raw reference-design entry as authored in `reference-designs.yaml` (its `starterFor` is optional). */
export interface RawReferenceDesign {
  readonly id: string;
  readonly name: string;
  readonly month: string;
  readonly starterFor?: string;
  /**
   * True when the design reconstructs a documented real ship (ticket 39); carried
   * through from content so the Drawing Board and the AI can tell a historical
   * reconstruction from a doctrine template without reading YAML comments.
   */
  readonly historical?: boolean;
  /** Machine-readable provenance of every reconstructed fact (historical designs only, ticket 39). */
  readonly provenance?: ReferenceDesignProvenance;
  readonly draft: DesignDraft;
}

/** Parsed (not yet interpreted) ship-building data: the YAML files of content/production/<scenario>/ship-building. */
export interface ShipBuildingData {
  readonly components: readonly ComponentDef[];
  readonly plants: readonly PropulsionPlant[];
  readonly hullForms: readonly HullFormRecord[];
  readonly balance: {
    readonly ship: unknown;
    readonly cost: CostBalance;
    readonly construction: ConstructionBalance;
    readonly cve: CveBalance;
    readonly ai?: Readonly<Record<ArchetypeId, ArchetypeSpec>>;
    /** Revision-tier thresholds (spec 15.4); absent in older packs, in which case revisions are refused. */
    readonly revision?: RevisionBalance;
    /** Retained-hull limits of a rebuild (DESIGN-23 section 21); absent in older packs, in which case rebuilds are refused. */
    readonly rebuild?: RebuildBalance;
    /** Design studies (DESIGN-21 sections 3 and 18, ADR-0085); absent in older packs, in which case designs need no study. */
    readonly study?: StudyBalance;
    readonly environment: {
      readonly threats: readonly ThreatProfile[];
      readonly facilities: readonly Facility[];
      /** Work micro-units per month per line per tonne of a yard's maxDisplacement (ADR-0067 section 6). */
      readonly yardWorkPerTonneMonth: number;
      readonly kgPerHitPoint: number;
      /** Micro-pounds per treasury unit (campaign treasury and project work are counted in these units). */
      readonly treasuryUnitMicro: number;
    };
  };
  /** Technology id and the year it becomes available, from the scenario's technology list. */
  readonly technologies: readonly { readonly id: string; readonly year: number }[];
  /** National naval profiles (optional): when present, a nation's catalogue and capabilities are derived from them. */
  readonly navalProfiles?: readonly NationNavalProfile[];
  /** First-class armament content (optional, ADR-0093 Step 3): drives authoritative weapon resolution. */
  readonly armament?: AuthoredArmamentContent;
  /** Reference designs (optional): the starter designs the AI may base a procurement candidate on. */
  readonly referenceDesigns?: readonly RawReferenceDesign[];
  /**
   * The compiled part model and the authoritative reference-design loadouts
   * (ship-part-model ticket 11d). When both are present, reference designs are
   * rebuilt from their loadouts — the parts are authoritative and the legacy
   * `referenceDesigns` array is the harness baseline only.
   */
  readonly partModel?: CompiledPartModel;
  readonly designLoadouts?: readonly ReferenceDesignLoadoutData[];
  /**
   * The values of the optional S-5 ruleset section (ADR-0242), when the pack authors one. Absent = dormant: the
   * context carries no colonial fitting rule and a fitting is recorded but costs nothing.
   */
  readonly presence?: PresenceRuleValues;
}

/**
 * The decoded values of the optional S-5 ruleset section (ADR-0242, ADR-0247). The design compile reads only the colonial
 * fitting; the presence measurement reads the rest through `ShipBuildingContent.presence`.
 */
export interface PresenceRuleValues {
  readonly colonialServiceDisplacementBp: number;
  readonly requiredTonsPerPossessionWeight: number;
  readonly noPortValueWeight: number;
  readonly crampedOrShortRangeCountBp: number;
  readonly penaltyRequests?: true;
  /** The optional base-limit block (spec #73 R10, ADR-0250); absent = base limits dormant. */
  readonly baseLimits?: {
    readonly limitByBaseLevel: readonly number[];
    readonly noBaseLimit: number;
    readonly occupyingStates: readonly (
      | "ACTIVE"
      | "RESERVE"
      | "MOTHBALLED"
      | "WORKING_UP"
      | "REPAIR"
    )[];
    readonly maintenanceAdderBp: number;
    readonly crewQualityReduction: number;
  };
}

/** Everything a caller needs, built once. `environmentFor(month)` is pure: same data and month, same environment. */
export interface ShipBuildingContent {
  readonly components: readonly ComponentDef[];
  readonly plants: readonly PropulsionPlant[];
  readonly hullForms: readonly HullFormRecord[];
  /** `environmentFor(month)` is nation-neutral; passing a nationId derives that nation's catalogue and capabilities. */
  readonly environmentFor: (month: string, nationId?: string) => WorkshopEnvironment;
  /** Ruleset constant for the engine projection (displacement per hit point). */
  readonly kgPerHitPoint: number;
  /** Micro-pounds per treasury unit, to turn the cost model's pounds into the engine's units. */
  readonly treasuryUnitMicro: number;
  readonly aiEnvironmentFor: (month: string, nationId?: string) => AiEnvironment;
  /** Revision-tier thresholds, or null when the pack has none. */
  readonly revision: RevisionBalance | null;
  /** The S-5 ruleset section's values when the pack authors one; absent = dormant (ADR-0247). */
  readonly presence?: PresenceRuleValues;
  /** Retained-hull limits of a rebuild, or null when the pack has none. */
  readonly rebuild: RebuildBalance | null;
  /** Design-study rules, or null when the pack has none (designs are then approved without a study). */
  readonly study: StudyBalance | null;
  /** National naval profiles, or empty when the pack has none. */
  readonly navalProfiles: readonly NationNavalProfile[];
  /** First-class armament content, or null when the pack has none (the compatibility path). */
  readonly armament: AuthoredArmamentContent | null;
  /** The profile active for a nation at a month, or null. */
  readonly navalProfileFor: (nationId: string, month: string) => NationNavalProfile | null;
  /** Starter designs (a reference design with a `starterFor`), for AI procurement candidate generation. */
  readonly starterDesigns: readonly StarterDesign[];
  /**
   * The compiled part model, when the pack carries parts content (ticket 13b). Callers that build a
   * design's torpedo mounts into the neutral compiled record (combat reads it) resolve the torpedo
   * part from `partIndex.byId`; a parts-less pack leaves it absent and combat fails closed.
   */
  readonly partModel?: CompiledPartModel;
  /**
   * The forward-adapter content for the production parts barrier (ticket 17a), present when the
   * pack carries first-class armament. A player draft is compiled through the parts, never the
   * legacy catalogue, from exactly the content this pack validated.
   */
  readonly draftCompileContent?: DraftCompileContent;
}

/** Technology is available once its year has begun; month ids are YYYY-MM. */
export function unlockedTechIds(
  techs: ShipBuildingData["technologies"],
  month: string,
): Set<string> {
  const year = Number(month.slice(0, 4));
  return new Set(techs.filter((t) => t.year <= year).map((t) => t.id));
}

/**
 * Rebuild the authoritative reference designs from their parts loadouts (ticket 11d). The
 * inverse readers reconstruct each legacy `DesignDraft` from the part model, so the catalogues
 * and the AI read exactly the activated parts content. A loadout that cannot rebuild is a
 * content error, never a silently dropped design.
 */
export function referenceDesignsFromLoadouts(
  loadouts: readonly ReferenceDesignLoadoutData[],
  model: CompiledPartModel,
  authored?: readonly RawReferenceDesign[],
): RawReferenceDesign[] {
  const production = buildProductionPartModel({
    parts: Object.values(model.partIndex.byId),
    slotTemplates: model.slotTemplates,
    platforms: model.platforms,
  });
  // Ticket 39: the loadout carries only the mechanical facts (a `historical`/`provenance`
  // passthrough would duplicate it). The authored catalogue entry is the source for those
  // metadata fields, joined back by id so the read path is not a dead end.
  const authoredById = new Map((authored ?? []).map((design) => [design.id, design] as const));
  return loadouts.map((loadout) => {
    const slots = platformSlots(production.compatibility, loadout.loadout.platform) ?? [];
    const rebuilt = rebuildDraft({
      designId: loadout.id,
      header: loadout.header,
      loadout: loadout.loadout,
      partOf: production.partOf,
      slotOf: (slotId) => slots.find((slot) => slot.id === slotId),
    });
    if (rebuilt.draft === null || rebuilt.issues.length > 0) {
      throw new Error(`reference design '${loadout.id}' does not rebuild from its parts loadout`);
    }
    const source = authoredById.get(loadout.id);
    return {
      id: loadout.id,
      name: loadout.name,
      month: loadout.month,
      ...(loadout.starterFor === undefined ? {} : { starterFor: loadout.starterFor }),
      ...(source?.historical === undefined ? {} : { historical: source.historical }),
      ...(source?.provenance === undefined ? {} : { provenance: source.provenance }),
      draft: rebuilt.draft,
    };
  });
}

export function buildShipBuildingContent(data: ShipBuildingData): ShipBuildingContent {
  // A pack that has a study section must have all of it (DERIVED_DESIGN_DISCOUNT_CONTRACT_MISSING otherwise).
  const study = data.balance.study === undefined ? null : checkStudyBalance(data.balance.study);
  if (data.balance.rebuild !== undefined) {
    const problems = checkRebuildBalance(data.balance.rebuild);
    if (problems.length > 0)
      throw new Error(`invalid ship-building rebuild balance: ${problems.join("; ")}`);
  }
  if (data.balance.revision !== undefined) {
    const problems = checkRevisionBalance(data.balance.revision);
    if (problems.length > 0)
      throw new Error(`invalid ship-building revision balance: ${problems.join("; ")}`);
  }
  const ship = shipBalanceFromRecord(data.balance.ship);
  const forms = hullFormsFromRecords(data.hullForms);
  const yards = buildYards(
    data.balance.environment.facilities,
    data.balance.environment.yardWorkPerTonneMonth,
  );
  const profiles = data.navalProfiles ?? [];
  // The forward adapter (ticket 17a) reads the same compatibility slots the pack compiled; a pack
  // without a compiled part model still derives them from its hull forms, as the read path does.
  const compatibility: CompatibilityModel =
    data.partModel !== undefined
      ? { slotTemplates: data.partModel.slotTemplates, platforms: data.partModel.platforms }
      : buildCompatibilitySlots({ hullForms: data.hullForms });
  // A launcher's bore is the structured diameter of the torpedo it loads; the compiled torpedo
  // parts are the authority (the codemod read the same model ids).
  const torpedoDiameterUm = (torpedoModelId: string): number | undefined => {
    const part = data.partModel?.partIndex.byId[torpedoModelId];
    if (part === undefined || part.family !== "torpedo") return undefined;
    return part.spec.diameterUm;
  };
  const draftCompileContent: DraftCompileContent | undefined =
    data.armament === undefined || data.partModel === undefined
      ? undefined
      : {
          components: data.components,
          plants: data.plants,
          navalProfiles: profiles,
          armament: data.armament,
          armour: ship.armour,
          compatibility,
          torpedoDiameterUm,
          parts: Object.values(data.partModel.partIndex.byId).sort((a, b) =>
            compareCodePoints(a.id, b.id),
          ),
        };
  // The authoritative source of reference designs is the parts loadouts when the pack carries
  // them; the legacy `referenceDesigns` array remains the equivalence-harness baseline.
  const referenceDesigns =
    data.partModel !== undefined && data.designLoadouts !== undefined
      ? referenceDesignsFromLoadouts(data.designLoadouts, data.partModel, data.referenceDesigns)
      : (data.referenceDesigns ?? []);
  const environmentFor = (month: string, nationId?: string): WorkshopEnvironment => {
    const profile = nationId === undefined ? null : resolveNavalProfile(profiles, nationId, month);
    const selection = profile === null ? null : catalogueForNation(data.components, profile, month);
    const ctx: WorkshopEnvironment["ctx"] = {
      month,
      unlockedTechs: unlockedTechIds(data.technologies, month),
      catalogue: selection?.catalogue ?? data.components,
      plants: data.plants,
      hullForms: forms,
      threats: data.balance.environment.threats,
      facilities: data.balance.environment.facilities,
      treaty: null,
      balance: ship,
      armamentContent: data.armament ?? null,
      // Classification, availability and the fit requirements read the compiled ship-type registry
      // (ADR-0156, ticket 12b) when the pack carries one; a pack without parts content falls back
      // to the code registry, whose values the 12a regression pins equal.
      ...(data.partModel === undefined ? {} : { shipTypes: data.partModel.partIndex.shipTypes }),
      // SPM-R18 (ticket 14): a refit evaluates slot acceptance from the parts when the pack carries them.
      ...(data.partModel === undefined ? {} : { partModel: data.partModel }),
      ...(data.presence === undefined
        ? {}
        : { colonialFitting: { displacementBp: data.presence.colonialServiceDisplacementBp } }),
      ...(profile !== null
        ? {
            capabilities: new Set(profile.hardCapabilities.grants),
            restrictedShipTypes: profile.hardCapabilities.restrictedShipTypes,
            navalProfile: profile,
          }
        : {}),
    };
    return {
      ctx,
      costBalance: data.balance.cost,
      costCtx: { maturityBpByTech: {}, firstOfClass: true },
      constructionBalance: data.balance.construction,
      cveBalance: data.balance.cve,
      yards,
    };
  };
  return {
    components: data.components,
    plants: data.plants,
    hullForms: data.hullForms,
    environmentFor,
    kgPerHitPoint: data.balance.environment.kgPerHitPoint,
    treasuryUnitMicro: data.balance.environment.treasuryUnitMicro,
    ...(data.presence === undefined ? {} : { presence: data.presence }),
    revision: data.balance.revision ?? null,
    rebuild: data.balance.rebuild ?? null,
    study,
    navalProfiles: profiles,
    armament: data.armament ?? null,
    ...(data.partModel === undefined ? {} : { partModel: data.partModel }),
    ...(draftCompileContent === undefined ? {} : { draftCompileContent }),
    navalProfileFor: (nationId, month) => resolveNavalProfile(profiles, nationId, month),
    starterDesigns: referenceDesigns
      .filter((r): r is RawReferenceDesign & { starterFor: string } => r.starterFor !== undefined)
      .map((r) => ({
        id: r.id,
        name: r.name,
        month: r.month,
        starterFor: r.starterFor,
        draft: r.draft,
      })),
    aiEnvironmentFor: (month, nationId) => {
      if (!data.balance.ai) throw new Error("ship-building balance has no 'ai' section");
      const env = environmentFor(month, nationId);
      return {
        ctx: env.ctx,
        costBalance: env.costBalance,
        costCtx: env.costCtx,
        cveBalance: env.cveBalance,
        archetypes: data.balance.ai,
        budgetMicro: null,
      };
    },
  };
}
