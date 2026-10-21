import { hashWithContext } from "@bluewave/deterministic";
import {
  battleOffersFromRulesets,
  presenceFromRulesets,
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

/**
 * Reads and decodes the ship-building catalogue from the compiled content
 * artifact (ADR-0122) once per process — never from raw YAML. The decoded data
 * is the wire DTO the renderer receives (`inspectDrawingBoardContent`) and the
 * input the runtime `ShipBuildingContent` is built from; both derive from
 * exactly the content the compiler validated (ticket 03, CRI-MAIN-1).
 */
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
    technologies: bundle.technologies as { id: string; year: number }[],
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
    // Artifact-derived identity (ADR-0123): the recorded content hash is the
    // artifact's canonical body hash under a domain-separated envelope, so the
    // identity is exactly the thing CI validated — never the raw file bytes.
    hash: hashWithContext(manifest.bodyHash, "ship-building-content"),
    armamentHash: hashWithContext(manifest.bodyHash, "armament-content"),
  };
  return loaded;
}

type BattleOfferRules = ReturnType<typeof battleOffersFromRulesets>;

let battleOffers: { readonly rules: BattleOfferRules | undefined } | null = null;

/**
 * The optional battle-offer ruleset section of the compiled content artifact (spec #109 R1), decoded once per process.
 * Absent = dormant (`undefined`): no offer is raised and war months behave exactly as before.
 */
export function loadBattleOfferRules(): BattleOfferRules | undefined {
  if (battleOffers !== null) return battleOffers.rules;
  const { bundle } = readContentArtifact(resolveGeneratedContentDir());
  battleOffers = { rules: battleOffersFromRulesets(bundle.rulesets) };
  return battleOffers.rules;
}

/**
 * The decoded ship-building catalogue (data-only), exactly as it crosses the
 * content-query IPC to the renderer. Never populated from raw YAML.
 */
export function loadShipBuildingData(): ShipBuildingData {
  return loadShipBuilding().data;
}

/**
 * Loads the ship-building content from the compiled content artifact (ADR-0122)
 * once per process. The same content must be given to every month execution so
 * replays compile identically, and it is exactly the content the compiler
 * validated (ticket 03, CRI-MAIN-1).
 */
export function loadShipBuildingContent(): ShipBuildingContent {
  if (cached) return cached;
  cached = buildShipBuildingContent(loadShipBuilding().data);
  return cached;
}

/**
 * Hash of the compiled ship-building content a month ran on. A month records it
 * so a replay can tell "the content changed since" (an expected difference after
 * a content update) from a real divergence. Artifact-derived and
 * domain-separated, so it is content-derived and tamper-evident (ADR-0123).
 */
export function shipBuildingContentHash(): string {
  return loadShipBuilding().hash;
}

/**
 * A separately versioned, domain-separated identity derived from the same
 * artifact body hash (ADR-0093 Step 3). Kept as its own recorded field so older
 * saves keep their existing content identity; a replay can detect an armament
 * content change on its own. Deterministic across processes.
 */
export function armamentContentHash(): string {
  return loadShipBuilding().armamentHash;
}
