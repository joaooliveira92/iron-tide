import { contentPackFromArtifact } from "@bluewave/content-compiler";
import type { CompiledContentBundle, ContentPack } from "@bluewave/content-schema";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { type DiagnosticCollector as DiagnosticCollectorType } from "@bluewave/diagnostics";
import { compileTorpedo } from "@bluewave/ship-design";
import type { CompiledTorpedo } from "@bluewave/armament";
import { Result } from "effect";
import type { CampaignFileData } from "./campaignInput.js";
import { validateCampaignPreconditions } from "./campaignSession.js";
import {
  assertFleetDesignLinks,
  buildDesignFamiliesFromData,
  buildDesignsFromData,
} from "./designCompilation.js";
import { buildNationStates, buildSlots } from "./nationCompilation.js";
import {
  decodePrestigeValueSet,
  PRESTIGE_COMPILE_CODES,
  type PrestigeValueSet,
} from "./prestige.js";
import { materialiseSeededConstructions } from "./seededConstructions.js";
import { buildPoliticalState, buildWarState } from "./politicalCompilation.js";
import { getScenarioById, type ScenarioId } from "./scenario.js";
import { createCampaignSnapshotEnvelope, hashCampaignSnapshot } from "./snapshotHash.js";
import type { CampaignSnapshot, CampaignState } from "./state.js";
import {
  DEFAULT_CAMPAIGN_START_MONTH,
  DEFAULT_CAMPAIGN_START_YEAR,
  campaignMonthId,
} from "./timeline.js";
import { buildWorldState } from "./worldCompilation.js";

export interface CampaignCompilerInput {
  contentBundle: CompiledContentBundle;
  contentHash?: string;
  rulesetVersion: string;
  compatibilityVersion: string;
  scenarios?: unknown;
  campaignConfiguration?: unknown;
  fleetSizeSettings?: unknown;
  researchSpeedSettings?: unknown;
  campaignStart?: { startYear: number; startMonth: number };
}

export interface CampaignCompilerOutput {
  state: CampaignState;
  contentHash: string;
  pack: ContentPack;
}

export type CampaignStart = { startYear: number; startMonth: number };

interface ValidatedCampaignStart {
  ok: boolean;
  value?: CampaignStart;
}

function validateCampaignStart(
  start: CampaignCompilerInput["campaignStart"],
  collector: DiagnosticCollectorType,
): ValidatedCampaignStart {
  if (start === undefined) return { ok: true };
  if (
    !Number.isInteger(start?.startYear) ||
    (start?.startYear ?? 0) < 1800 ||
    !Number.isInteger(start?.startMonth) ||
    (start?.startMonth ?? 0) < 1 ||
    (start?.startMonth ?? 0) > 12
  ) {
    collector.addError(
      INVALID_CAMPAIGN_START,
      `Invalid campaignStart ${String(start?.startYear)}-${String(start?.startMonth)}: year must be an integer >= 1800 and month an integer 1..12`,
      { stage: "campaign-compile" },
    );
    return { ok: false };
  }
  return { ok: true, value: { startYear: start.startYear, startMonth: start.startMonth } };
}

export class CampaignCompiler {
  compile(
    input: CampaignCompilerInput,
    signal: AbortSignal,
    collector: DiagnosticCollectorType,
  ): CampaignCompilerOutput | undefined {
    if (signal.aborted) {
      collector.addInfo("ABORT", "Compilation aborted before content compilation");
      return undefined;
    }

    const startInput = validateCampaignStart(input.campaignStart, collector);
    if (!startInput.ok) return undefined;

    if (input.campaignConfiguration !== undefined) {
      if (!validateCampaignPreconditions(input as unknown, collector)) {
        return undefined;
      }
      if (signal.aborted) return undefined;
    }

    const pack: ContentPack = contentPackFromBundle(input.contentBundle);
    const data: CampaignFileData = campaignDataFromBundle(input.contentBundle);
    const contentHash = input.contentHash ?? sha256Hex(canonicalSerialize(input.contentBundle));

    if (collector.hasErrors || signal.aborted) return undefined;

    const campaignStart = resolveCampaignStart(input, startInput.value);

    const world = buildWorldState(pack, campaignStart);

    const prestigeRules = resolvePrestigeRules(pack.rulesets, collector);
    if (prestigeRules === undefined || signal.aborted) return undefined;

    const builtNations = buildNationStates(
      pack,
      data.fleets,
      data.economies,
      data.constructions,
      data.research,
      data.divisions,
      input.rulesetVersion,
      campaignMonthId(campaignStart.startYear, campaignStart.startMonth, 0),
      prestigeRules,
      collector,
    );
    if (!builtNations || signal.aborted) return undefined;

    const wars = buildWarState();

    const politics = buildPoliticalState(data.diplomacy, builtNations, collector);

    const designs = buildDesignsFromData(
      data.designs,
      collector,
      torpedoResolverFor(input.contentBundle),
    );
    const designFamilies = buildDesignFamiliesFromData(data.designs);

    const nations = materialiseSeededConstructions(
      builtNations,
      designs,
      input.contentBundle.shipBuilding,
      campaignMonthId(campaignStart.startYear, campaignStart.startMonth, 0),
      collector,
    );

    if (!assertFleetDesignLinks(nations, designs, collector)) return undefined;
    if (signal.aborted) return undefined;

    const slots = buildSlots(nations);

    const intelligence = { shells: {} };

    const snapshot: CampaignSnapshot = {
      version: "0.1.0",
      turnNumber: SafeInt(0),
      campaignId: `campaign-${pack.manifest.name}`,
      startYear: campaignStart.startYear,
      startMonth: campaignStart.startMonth,
      slots,
      world,
      nations,
      wars,
      politics,
      intelligence,
      designs,
      designFamilies,
      strategicWeather: [],
      prestigeRules,
      rulesetVersion: input.rulesetVersion,
      compatibilityVersion: input.compatibilityVersion,
    };

    if (signal.aborted) return undefined;

    const rawHash = hashCampaignSnapshot(snapshot);
    const envelope = createCampaignSnapshotEnvelope(input.compatibilityVersion, snapshot);

    if (collector.hasErrors) return undefined;

    return {
      state: { snapshot, envelope, rawHash },
      contentHash,
      pack,
    };
  }
}

function torpedoResolverFor(
  bundle: CompiledContentBundle,
): ((torpedoModelId: string) => CompiledTorpedo | undefined) | undefined {
  const byId = bundle.shipBuilding?.partModel?.partIndex.byId;
  if (byId === undefined) return undefined;
  return (torpedoModelId: string) => {
    const part = byId[torpedoModelId];
    const compiled =
      part !== undefined && part.family === "torpedo" ? compileTorpedo(part, "9999-12") : undefined;
    return compiled !== undefined && compiled.ok ? compiled.value : undefined;
  };
}

function resolvePrestigeRules(
  rulesets: readonly { readonly id: string; readonly prestige?: unknown }[],
  collector: DiagnosticCollectorType,
): PrestigeValueSet | undefined {
  const carriers = rulesets.filter((ruleset) => ruleset.prestige !== undefined);
  const stage = { stage: "campaign-compile" } as const;
  if (carriers.length === 0) {
    collector.addError(
      PRESTIGE_COMPILE_CODES.valueSetMissing,
      "No ruleset carries a prestige value set; it is required and has no default",
      stage,
    );
    return undefined;
  }
  const [carrier] = carriers;
  if (carriers.length > 1 || carrier === undefined) {
    collector.addError(
      PRESTIGE_COMPILE_CODES.valueSetAmbiguous,
      `More than one ruleset carries a prestige value set (${carriers.map((r) => r.id).join(", ")}); exactly one must`,
      stage,
    );
    return undefined;
  }
  const decoded = decodePrestigeValueSet(carrier.prestige);
  if (Result.isFailure(decoded)) {
    collector.addError(
      PRESTIGE_COMPILE_CODES.valueSetInvalid,
      `Ruleset '${carrier.id}' prestige value set is invalid at '${decoded.failure.field}': ${decoded.failure.message}`,
      { ...stage, entityId: carrier.id },
    );
    return undefined;
  }
  return decoded.success;
}

function contentPackFromBundle(bundle: CompiledContentBundle): ContentPack {
  return contentPackFromArtifact({
    manifest: bundle.manifest,
    rulesets: bundle.rulesets,
    nations: bundle.nations,
    areas: bundle.areas,
    routes: bundle.routes,
    possessions: bundle.possessions,
    ports: bundle.ports,
    technologies: bundle.technologies,
  });
}

function campaignDataFromBundle(bundle: CompiledContentBundle): CampaignFileData {
  const campaign = bundle.campaign;
  return {
    fleets: campaign?.fleets ?? [],
    economies: campaign?.economies ?? [],
    constructions: campaign?.constructions ?? [],
    diplomacy: campaign?.diplomacy ?? [],
    research: campaign?.research ?? [],
    designs: campaign?.designs ?? [],
    divisions: campaign?.divisions ?? [],
  };
}

function resolveCampaignStart(
  input: CampaignCompilerInput,
  explicit: CampaignStart | undefined,
): CampaignStart {
  if (input.campaignConfiguration !== undefined) {
    const scenarioId = (input.campaignConfiguration as { scenarioId?: unknown })["scenarioId"];
    if (typeof scenarioId === "string") {
      const scen = getScenarioById(scenarioId as ScenarioId);
      if (scen) {
        return { startYear: scen.startYear, startMonth: scen.startMonth };
      }
    }
  }
  if (explicit) {
    return { startYear: explicit.startYear, startMonth: explicit.startMonth };
  }
  return { startYear: DEFAULT_CAMPAIGN_START_YEAR, startMonth: DEFAULT_CAMPAIGN_START_MONTH };
}

export const INVALID_CAMPAIGN_START = "INVALID_CAMPAIGN_START" as const;
