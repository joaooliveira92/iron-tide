import { hashWithContext } from "@bluewave/deterministic";
import type { EventEngineContent, MonthExecutorEngineOptions } from "@bluewave/phase-engine";
import {
  baseGrowthFromRulesets,
  researchReturnsFromRulesets,
  colonyIncomeFromRulesets,
  battleOffersFromRulesets,
  eventResolutionFromRulesets,
  fleetManagementFromRulesets,
  fleetMoraleFromRulesets,
  unrestFromRulesets,
  gunneryFromRulesets,
  missilesFromRulesets,
  peaceBehaviourFromRulesets,
  tensionDriftFromRulesets,
  tradeProtectionFromRulesets,
  warDeclarationFromRulesets,
} from "@bluewave/content-compiler";
import { shipBuildingDataFromBundle } from "@bluewave/campaign";
import {
  buildShipBuildingContent,
  type ShipBuildingContent,
  type ShipBuildingData,
} from "@bluewave/ship-design";

import { ContentArtifactError, readContentArtifact } from "./contentArtifact.js";
import { resolveGeneratedContentDir } from "./contentPack.js";

interface LoadedShipBuilding {
  readonly data: ShipBuildingData;
  readonly hash: string;
  readonly armamentHash: string;
}

let loaded: LoadedShipBuilding | null = null;
let cached: ShipBuildingContent | null = null;

function loadShipBuilding(): LoadedShipBuilding {
  if (loaded) return loaded;
  const { bundle, manifest } = readContentArtifact(resolveGeneratedContentDir());
  const data = shipBuildingDataFromBundle(bundle);
  if (data === undefined) {
    throw new ContentArtifactError(
      "CONTENT_ARTIFACT_INVALID",
      "The compiled content artifact carries no ship-building catalogue.",
    );
  }
  loaded = {
    data,
    hash: hashWithContext(manifest.bodyHash, "ship-building-content"),
    armamentHash: hashWithContext(manifest.bodyHash, "armament-content"),
  };
  return loaded;
}

type BattleOfferRules = ReturnType<typeof battleOffersFromRulesets>;

let battleOffers: { readonly rules: BattleOfferRules | undefined } | null = null;

export function loadBattleOfferRules(): BattleOfferRules | undefined {
  if (battleOffers !== null) return battleOffers.rules;
  const { bundle } = readContentArtifact(resolveGeneratedContentDir());
  battleOffers = { rules: battleOffersFromRulesets(bundle.rulesets) };
  return battleOffers.rules;
}

type FleetManagementRules = Extract<
  NonNullable<ReturnType<typeof fleetManagementFromRulesets>>,
  { readonly ok: true }
>["value"];

let fleetManagement: { readonly rules: FleetManagementRules | undefined } | null = null;

export function loadFleetManagementRules(): FleetManagementRules | undefined {
  if (fleetManagement !== null) return fleetManagement.rules;
  const { bundle } = readContentArtifact(resolveGeneratedContentDir());
  const decoded = fleetManagementFromRulesets(bundle.rulesets);
  if (decoded !== undefined && !decoded.ok)
    throw new ContentArtifactError(
      "CONTENT_ARTIFACT_INVALID",
      `ruleset fleetManagement section is invalid at '${decoded.field}': ${decoded.message}`,
    );
  fleetManagement = { rules: decoded?.value };
  return fleetManagement.rules;
}

type GunneryRules = ReturnType<typeof gunneryFromRulesets>;

let gunneryRules: { readonly rules: GunneryRules | undefined } | null = null;

export function loadGunneryRules(): GunneryRules | undefined {
  if (gunneryRules !== null) return gunneryRules.rules;
  const { bundle } = readContentArtifact(resolveGeneratedContentDir());
  gunneryRules = { rules: gunneryFromRulesets(bundle.rulesets) };
  return gunneryRules.rules;
}

type MissilesRules = ReturnType<typeof missilesFromRulesets>;

let missilesRules: { readonly rules: MissilesRules | undefined } | null = null;

export function loadMissilesRules(): MissilesRules | undefined {
  if (missilesRules !== null) return missilesRules.rules;
  const { bundle } = readContentArtifact(resolveGeneratedContentDir());
  missilesRules = { rules: missilesFromRulesets(bundle.rulesets) };
  return missilesRules.rules;
}

type TensionDriftRules = Extract<
  NonNullable<ReturnType<typeof tensionDriftFromRulesets>>,
  { readonly ok: true }
>["value"];

let tensionDrift: { readonly rules: TensionDriftRules | undefined } | null = null;

export function loadTensionDriftRules(): TensionDriftRules | undefined {
  if (tensionDrift !== null) return tensionDrift.rules;
  const { bundle } = readContentArtifact(resolveGeneratedContentDir());
  const decoded = tensionDriftFromRulesets(bundle.rulesets);
  if (decoded !== undefined && !decoded.ok)
    throw new ContentArtifactError(
      "CONTENT_ARTIFACT_INVALID",
      `ruleset tensionDrift section is invalid at '${decoded.field}': ${decoded.message}`,
    );
  tensionDrift = { rules: decoded?.value };
  return tensionDrift.rules;
}

type FleetMoraleRules = Extract<
  NonNullable<ReturnType<typeof fleetMoraleFromRulesets>>,
  { readonly ok: true }
>["value"];

let fleetMorale: { readonly rules: FleetMoraleRules | undefined } | null = null;

export function loadFleetMoraleRules(): FleetMoraleRules | undefined {
  if (fleetMorale !== null) return fleetMorale.rules;
  const { bundle } = readContentArtifact(resolveGeneratedContentDir());
  const decoded = fleetMoraleFromRulesets(bundle.rulesets);
  if (decoded !== undefined && !decoded.ok)
    throw new ContentArtifactError(
      "CONTENT_ARTIFACT_INVALID",
      `ruleset fleetMorale section is invalid at '${decoded.field}': ${decoded.message}`,
    );
  fleetMorale = { rules: decoded?.value };
  return fleetMorale.rules;
}

type TradeProtectionRules = Extract<
  NonNullable<ReturnType<typeof tradeProtectionFromRulesets>>,
  { readonly ok: true }
>["value"];

let tradeProtection: { readonly rules: TradeProtectionRules | undefined } | null = null;

export function loadTradeProtectionRules(): TradeProtectionRules | undefined {
  if (tradeProtection !== null) return tradeProtection.rules;
  const { bundle } = readContentArtifact(resolveGeneratedContentDir());
  const decoded = tradeProtectionFromRulesets(bundle.rulesets);
  if (decoded !== undefined && !decoded.ok)
    throw new ContentArtifactError(
      "CONTENT_ARTIFACT_INVALID",
      `ruleset tradeProtection section is invalid at '${decoded.field}': ${decoded.message}`,
    );
  tradeProtection = { rules: decoded?.value };
  return tradeProtection.rules;
}

type WarDeclarationRules = Extract<
  NonNullable<ReturnType<typeof warDeclarationFromRulesets>>,
  { readonly ok: true }
>["value"];

let warDeclaration: { readonly rules: WarDeclarationRules | undefined } | null = null;

export function loadWarDeclarationRules(): WarDeclarationRules | undefined {
  if (warDeclaration !== null) return warDeclaration.rules;
  const { bundle } = readContentArtifact(resolveGeneratedContentDir());
  const decoded = warDeclarationFromRulesets(bundle.rulesets);
  if (decoded !== undefined && !decoded.ok)
    throw new ContentArtifactError(
      "CONTENT_ARTIFACT_INVALID",
      `ruleset warDeclaration section is invalid at '${decoded.field}': ${decoded.message}`,
    );
  warDeclaration = { rules: decoded?.value };
  return warDeclaration.rules;
}

type UnrestRules = Extract<
  NonNullable<ReturnType<typeof unrestFromRulesets>>,
  { readonly ok: true }
>["value"];

let unrest: { readonly rules: UnrestRules | undefined } | null = null;

export function loadUnrestRules(): UnrestRules | undefined {
  if (unrest !== null) return unrest.rules;
  const { bundle } = readContentArtifact(resolveGeneratedContentDir());
  const decoded = unrestFromRulesets(bundle.rulesets);
  if (decoded !== undefined && !decoded.ok)
    throw new ContentArtifactError(
      "CONTENT_ARTIFACT_INVALID",
      `ruleset unrest section is invalid at '${decoded.field}': ${decoded.message}`,
    );
  unrest = { rules: decoded?.value };
  return unrest.rules;
}

type BaseGrowthRules = Extract<
  NonNullable<ReturnType<typeof baseGrowthFromRulesets>>,
  { readonly ok: true }
>["value"];

let baseGrowth: { readonly rules: BaseGrowthRules | undefined } | null = null;

export function loadBaseGrowthRules(): BaseGrowthRules | undefined {
  if (baseGrowth !== null) return baseGrowth.rules;
  const { bundle } = readContentArtifact(resolveGeneratedContentDir());
  const decoded = baseGrowthFromRulesets(bundle.rulesets);
  if (decoded !== undefined && !decoded.ok)
    throw new ContentArtifactError(
      "CONTENT_ARTIFACT_INVALID",
      `ruleset baseGrowth section is invalid at '${decoded.field}': ${decoded.message}`,
    );
  baseGrowth = { rules: decoded?.value };
  return baseGrowth.rules;
}

type ResearchReturnsRules = Extract<
  NonNullable<ReturnType<typeof researchReturnsFromRulesets>>,
  { readonly ok: true }
>["value"];

let researchReturns: { readonly rules: ResearchReturnsRules | undefined } | null = null;

export function loadResearchReturnsRules(): ResearchReturnsRules | undefined {
  if (researchReturns !== null) return researchReturns.rules;
  const { bundle } = readContentArtifact(resolveGeneratedContentDir());
  const decoded = researchReturnsFromRulesets(bundle.rulesets);
  if (decoded !== undefined && !decoded.ok)
    throw new ContentArtifactError(
      "CONTENT_ARTIFACT_INVALID",
      `ruleset researchReturns section is invalid at '${decoded.field}': ${decoded.message}`,
    );
  researchReturns = { rules: decoded?.value };
  return researchReturns.rules;
}

type ColonyIncomeRules = Extract<
  NonNullable<ReturnType<typeof colonyIncomeFromRulesets>>,
  { readonly ok: true }
>["value"];

let colonyIncome: { readonly rules: ColonyIncomeRules | undefined } | null = null;

export function loadColonyIncomeRules(): ColonyIncomeRules | undefined {
  if (colonyIncome !== null) return colonyIncome.rules;
  const { bundle } = readContentArtifact(resolveGeneratedContentDir());
  const decoded = colonyIncomeFromRulesets(bundle.rulesets);
  if (decoded !== undefined && !decoded.ok)
    throw new ContentArtifactError(
      "CONTENT_ARTIFACT_INVALID",
      `ruleset colonyIncome section is invalid at '${decoded.field}': ${decoded.message}`,
    );
  colonyIncome = { rules: decoded?.value };
  return colonyIncome.rules;
}

type PeaceBehaviourRules = Extract<
  NonNullable<ReturnType<typeof peaceBehaviourFromRulesets>>,
  { readonly ok: true }
>["value"];

let peaceBehaviour: { readonly rules: PeaceBehaviourRules | undefined } | null = null;

export function loadPeaceBehaviourRules(): PeaceBehaviourRules | undefined {
  if (peaceBehaviour !== null) return peaceBehaviour.rules;
  const { bundle } = readContentArtifact(resolveGeneratedContentDir());
  const decoded = peaceBehaviourFromRulesets(bundle.rulesets);
  if (decoded !== undefined && !decoded.ok)
    throw new ContentArtifactError(
      "CONTENT_ARTIFACT_INVALID",
      `ruleset peaceBehaviour section is invalid at '${decoded.field}': ${decoded.message}`,
    );
  peaceBehaviour = { rules: decoded?.value };
  return peaceBehaviour.rules;
}

let eventContent: { readonly content: EventEngineContent | undefined } | null = null;

export function loadEventContent(): EventEngineContent | undefined {
  if (eventContent !== null) return eventContent.content;
  const { bundle } = readContentArtifact(resolveGeneratedContentDir());
  const decoded = eventResolutionFromRulesets(bundle.rulesets);
  if (decoded !== undefined && !decoded.ok)
    throw new ContentArtifactError(
      "CONTENT_ARTIFACT_INVALID",
      `ruleset eventResolution section is invalid at '${decoded.field}': ${decoded.message}`,
    );
  const catalogue = bundle.campaign?.events ?? [];
  eventContent = {
    content:
      decoded === undefined || catalogue.length === 0
        ? undefined
        : { rules: decoded.value, catalogue },
  };
  return eventContent.content;
}

export type ConstructionEventRules = NonNullable<MonthExecutorEngineOptions["constructionEvents"]>;

let constructionEventContent: { readonly rules: ConstructionEventRules | undefined } | null = null;

export function loadConstructionEvents(): ConstructionEventRules | undefined {
  if (constructionEventContent !== null) return constructionEventContent.rules;
  const { bundle } = readContentArtifact(resolveGeneratedContentDir());
  const rules = bundle.campaign?.constructionEvents;
  constructionEventContent = {
    rules: rules === undefined || rules.length === 0 ? undefined : rules,
  };
  return constructionEventContent.rules;
}

export function loadShipBuildingData(): ShipBuildingData {
  return loadShipBuilding().data;
}

export function loadShipBuildingContent(): ShipBuildingContent {
  if (cached) return cached;
  cached = buildShipBuildingContent(loadShipBuilding().data);
  return cached;
}

export function shipBuildingContentHash(): string {
  return loadShipBuilding().hash;
}

export function armamentContentHash(): string {
  return loadShipBuilding().armamentHash;
}
