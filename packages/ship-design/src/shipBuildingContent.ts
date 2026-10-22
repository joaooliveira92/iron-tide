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

export type { ReferenceDesignProvenance, ReferenceValueProvenance } from "@bluewave/content-schema";

export interface RawReferenceDesign {
  readonly id: string;
  readonly name: string;
  readonly month: string;
  readonly starterFor?: string;
  readonly historical?: boolean;
  readonly provenance?: ReferenceDesignProvenance;
  readonly draft: DesignDraft;
}

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
    readonly revision?: RevisionBalance;
    readonly rebuild?: RebuildBalance;
    readonly study?: StudyBalance;
    readonly environment: {
      readonly threats: readonly ThreatProfile[];
      readonly facilities: readonly Facility[];
      readonly yardWorkPerTonneMonth: number;
      readonly kgPerHitPoint: number;
      readonly treasuryUnitMicro: number;
    };
  };
  readonly technologies: readonly { readonly id: string; readonly year: number }[];
  readonly navalProfiles?: readonly NationNavalProfile[];
  readonly armament?: AuthoredArmamentContent;
  readonly referenceDesigns?: readonly RawReferenceDesign[];
  readonly partModel?: CompiledPartModel;
  readonly designLoadouts?: readonly ReferenceDesignLoadoutData[];
  readonly presence?: PresenceRuleValues;
}

export interface PresenceRuleValues {
  readonly colonialServiceDisplacementBp: number;
  readonly requiredTonsPerPossessionWeight: number;
  readonly noPortValueWeight: number;
  readonly crampedOrShortRangeCountBp: number;
  readonly penaltyRequests?: true;
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

export interface ShipBuildingContent {
  readonly components: readonly ComponentDef[];
  readonly plants: readonly PropulsionPlant[];
  readonly hullForms: readonly HullFormRecord[];
  readonly environmentFor: (month: string, nationId?: string) => WorkshopEnvironment;
  readonly kgPerHitPoint: number;
  readonly treasuryUnitMicro: number;
  readonly aiEnvironmentFor: (month: string, nationId?: string) => AiEnvironment;
  readonly revision: RevisionBalance | null;
  readonly presence?: PresenceRuleValues;
  readonly rebuild: RebuildBalance | null;
  readonly study: StudyBalance | null;
  readonly navalProfiles: readonly NationNavalProfile[];
  readonly armament: AuthoredArmamentContent | null;
  readonly navalProfileFor: (nationId: string, month: string) => NationNavalProfile | null;
  readonly starterDesigns: readonly StarterDesign[];
  readonly partModel?: CompiledPartModel;
  readonly draftCompileContent?: DraftCompileContent;
}

export function unlockedTechIds(
  techs: ShipBuildingData["technologies"],
  month: string,
): Set<string> {
  const year = Number(month.slice(0, 4));
  return new Set(techs.filter((t) => t.year <= year).map((t) => t.id));
}

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
  const compatibility: CompatibilityModel =
    data.partModel !== undefined
      ? { slotTemplates: data.partModel.slotTemplates, platforms: data.partModel.platforms }
      : buildCompatibilitySlots({ hullForms: data.hullForms });
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
      ...(data.partModel === undefined ? {} : { shipTypes: data.partModel.partIndex.shipTypes }),
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
