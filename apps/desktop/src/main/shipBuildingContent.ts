import { hashWithContext } from "@bluewave/deterministic";
import type { EventEngineContent } from "@bluewave/phase-engine";
import {
  battleOffersFromRulesets,
  eventResolutionFromRulesets,
  fleetManagementFromRulesets,
  gunneryFromRulesets,
  missilesFromRulesets,
  presenceFromRulesets,
  tensionDriftFromRulesets,
  type ShipBuildingCatalogue,
} from "@bluewave/content-compiler";
import {
  buildShipBuildingContent,
  type AuthoredArmamentContent,
  type ComponentDef,
  type HullFormRecord,
  type NationNavalProfile,
  type PropulsionPlant,
  type RawReferenceDesign,
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
  const catalogue = bundle.shipBuilding as ShipBuildingCatalogue | undefined;
  if (catalogue === undefined) {
    throw new ContentArtifactError(
      "CONTENT_ARTIFACT_INVALID",
      "The compiled content artifact carries no ship-building catalogue.",
    );
  }
  const presence = presenceFromRulesets(bundle.rulesets);
  const data: ShipBuildingData = {
    components: catalogue.components as ComponentDef[],
    plants: catalogue.plants as unknown as PropulsionPlant[],
    hullForms: catalogue.hullForms as HullFormRecord[],
    balance: catalogue.balance as ShipBuildingData["balance"],
    technologies: [...bundle.technologies] as { id: string; year: number }[],
    navalProfiles: catalogue.navalProfiles as unknown as NationNavalProfile[],
    armament: catalogue.armament as unknown as AuthoredArmamentContent,
    referenceDesigns: catalogue.referenceDesigns as RawReferenceDesign[],
    ...(catalogue.partModel !== undefined ? { partModel: catalogue.partModel } : {}),
    ...(presence === undefined ? {} : { presence }),
    ...(catalogue.designLoadouts !== undefined
      ? {
          designLoadouts: catalogue.designLoadouts as NonNullable<
            ShipBuildingData["designLoadouts"]
          >,
        }
      : {}),
  };
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
