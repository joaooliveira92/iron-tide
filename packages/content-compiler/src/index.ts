import type {
  CompiledPartModel,
  ContentPack,
  PresentationContent,
  UiCatalogue,
} from "@bluewave/content-schema";
import type { DiagnosticCollector } from "@bluewave/diagnostics";

export interface CompilerInput {
  manifestPath: string;
  contentDir: string;
  fileContents?: Readonly<Record<string, string>>;
  rulesetFiles: string[];
  countryFiles: string[];
  areaFiles: string[];
  routeFiles: string[];
  possessionFiles: string[];
  portFiles: string[];
  technologyFiles: string[];
  shipComponentFiles?: string[];
  propulsionPlantFiles?: string[];
  hullFormFiles?: string[];
  shipBalanceFiles?: string[];
  gunFamilyFiles?: string[];
  gunModelFiles?: string[];
  gunMountFiles?: string[];
  ammunitionFiles?: string[];
  navalProfileFiles?: string[];
  referenceDesignFiles?: string[];
  partFiles?: string[];
  slotTemplateFiles?: string[];
  platformFiles?: string[];
  shipTypeFiles?: string[];
  designLoadoutFiles?: string[];
  fleetFiles?: string[];
  economyFiles?: string[];
  constructionFiles?: string[];
  diplomacyFiles?: string[];
  researchFiles?: string[];
  designFiles?: string[];
  divisionFiles?: string[];
  presentationFiles?: string[];
  uiFiles?: string[];
}

export interface ShipBuildingCatalogue {
  components: unknown[];
  plants: unknown[];
  hullForms: unknown[];
  balance: unknown;
  navalProfiles: unknown[];
  armament: {
    gunFamilies: unknown[];
    gunModels: unknown[];
    gunMounts: unknown[];
    ammunition: unknown[];
  };
  referenceDesigns: unknown[];
  partModel?: CompiledPartModel;
  designLoadouts?: unknown[];
}

export interface CampaignCollections {
  fleets: unknown[];
  economies: unknown[];
  constructions: unknown[];
  diplomacy: unknown[];
  research: unknown[];
  designs: unknown[];
  divisions?: unknown[];
}

export interface ContentBundle {
  generatedBy: string;
  manifest: unknown;
  rulesets: unknown[];
  nations: unknown[];
  areas: unknown[];
  routes: unknown[];
  possessions: unknown[];
  ports: unknown[];
  technologies: unknown[];
  shipBuilding?: ShipBuildingCatalogue;
  campaign?: CampaignCollections;
  presentation?: PresentationContent;
  ui?: UiCatalogue;
}

export interface CompilerOutput {
  pack: ContentPack;
  rawHash: string;
  envelopeHash: string;
  bundle: ContentBundle;
  contentVersion: string;
}

export interface CompilerStage<I, O> {
  name: string;
  run(input: I, signal: AbortSignal, collector: DiagnosticCollector): O | undefined;
}

export { Compiler } from "./compiler.js";
export {
  BUNDLE_GENERATED_BY,
  CompileStage,
  contentPackFromArtifact,
  type ContentPackArtifact,
} from "./stages/compile.js";
export { FlattenStage } from "./stages/flatten.js";
export { NormalizeStage } from "./stages/normalize.js";
export { ParseStage } from "./stages/parse.js";
export { ValidateStage } from "./stages/validate.js";
export {
  CONFIDENCE_LEVELS,
  collectProvenanceLocations,
  countConfidence,
  type CollectionConfidence,
  type ConfidenceCounts,
  type ConfidenceLevel,
  type ConfidenceReport,
  type ProvenanceLocation,
} from "./confidence.js";
export {
  PLACEHOLDER_SOURCE_STATUS,
  checkPlaceholderGate,
  collectPlaceholders,
  type PlaceholderAllowlistEntry,
  type PlaceholderGateResult,
  type PlaceholderViolation,
} from "./releaseGate.js";
export { safePath } from "./safePath.js";
export { battleOffersFromRulesets } from "./battleOfferRules.js";
export { fleetManagementFromRulesets } from "./fleetManagementRules.js";
export { presenceFromRulesets, type PresenceValues } from "./presenceRules.js";
export { discoverShipBuildingFiles, type ShipBuildingFileGroups } from "./shipBuildingDiscovery.js";
export { buildFullSurfaceInput } from "./fullSurface.js";
export {
  CONTENT_ARTIFACT_FILENAME,
  CONTENT_BUNDLE_ARTIFACT_KIND,
  CONTENT_BUNDLE_COMPATIBILITY_VERSION,
  CONTENT_BUNDLE_MANIFEST_VERSION,
  CONTENT_LOCK_FILENAME,
  CONTENT_MANIFEST_FILENAME,
  buildContentBundleArtifact,
  verifyContentBundleArtifact,
  verifyContentLock,
  writeContentBundleArtifact,
  type ContentBundleArtifact,
  type ContentBundleManifest,
  type ContentBundleVerification,
  type ContentLock,
  type ContentLockVerification,
} from "./artifact.js";
