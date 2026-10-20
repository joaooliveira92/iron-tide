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
  /**
   * The immutable name→text map of every source the compiler loads, keyed by the
   * same resolved path string used in `manifestPath` and the `*Files` arrays.
   * `ParseStage` parses only these contents — it performs no ambient filesystem
   * I/O (ADR-0004). `Compiler.compile` reads the files and injects the map when a
   * caller supplies only paths, so the stage is also drivable from an in-memory
   * input.
   */
  fileContents?: Readonly<Record<string, string>>;
  rulesetFiles: string[];
  countryFiles: string[];
  areaFiles: string[];
  routeFiles: string[];
  possessionFiles: string[];
  portFiles: string[];
  technologyFiles: string[];
  /**
   * Ship-building catalogue (the full authored surface). Every group is optional:
   * the content-pack-only `bwc compile` boundary leaves them undefined and its
   * artifact is byte-identical to before; `content:build`/`content:check` supply
   * them so the catalogue flows through the same four compiler stages.
   */
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
  /**
   * The ship part model (ship-part-model SPM-R1–R3): part records, shared slot
   * templates and platforms. Validated strictly, then flattened and indexed into
   * `shipBuilding.partModel` (SPM-R10, SPM-R11). A pack with none of them has no
   * `partModel`, so its artifact is byte-identical to one built before the part model.
   */
  partFiles?: string[];
  slotTemplateFiles?: string[];
  platformFiles?: string[];
  /**
   * The ship-type registry (ship-part-model ticket 12a, ADR-0156): one record per
   * canonical type. Strictly decoded, then carried beside the part index as
   * `partIndex.shipTypes`. Optional like the other part-model groups.
   */
  shipTypeFiles?: string[];
  /**
   * Authoritative reference designs in the parts representation (ship-part-model
   * ticket 11d): each is a header + loadout the production compile path rebuilds
   * a draft from. Optional; a pack without them has no `designLoadouts`.
   */
  designLoadoutFiles?: string[];
  /**
   * Campaign-file collections (the authored campaign surface). Optional like the
   * ship-building groups: a content-pack-only `bwc compile` leaves them undefined
   * and its artifact stays byte-compatible; `content:build`/`content:check`
   * supply them so the campaigns flow through the same four compiler stages and
   * land in the bundle (ticket 07, CRI-MAIN-2).
   */
  fleetFiles?: string[];
  economyFiles?: string[];
  constructionFiles?: string[];
  diplomacyFiles?: string[];
  researchFiles?: string[];
  designFiles?: string[];
  /** Authored initial divisions (N-1 ticket 07). Optional like the other campaign groups. */
  divisionFiles?: string[];
  /**
   * Presentation content (the nation-facing corpus: coordinates, flavor,
   * dossier, slot mapping, area→region grouping and the campaign-map join).
   * Optional like the other full-surface groups: a content-pack-only `bwc
   * compile` leaves it undefined and its artifact stays byte-compatible;
   * `content:build`/`content:check` supply it so it lands in the bundle
   * (CAH-PRES-1, CAH-PRES-2).
   */
  presentationFiles?: string[];
  /**
   * UI-string catalogue files (the keyed en-US presentation strings, CAH-UI-1).
   * Optional like the other full-surface groups; a content-pack-only build leaves
   * it undefined and the artifact stays byte-compatible.
   */
  uiFiles?: string[];
}

/**
 * The compiled ship-building catalogue: canonical, sorted, inert JSON that the
 * runtime can hand to `buildShipBuildingContent` without re-reading YAML. The
 * `technologies` collection lives on the bundle root (it is a content-pack
 * collection) and is joined by the consumer, mirroring the authored layout.
 */
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
  /** The flattened part index, slot templates and platforms; absent with no part model. */
  partModel?: CompiledPartModel;
  /** Authoritative reference designs in the parts representation; absent without them. */
  designLoadouts?: unknown[];
}

/**
 * The compiled campaign-file collections (`fleets`/`economies`/`constructions`/
 * `diplomacy`/`research`/`designs`): canonical, sorted, inert JSON the runtime
 * `CampaignCompiler` consumes instead of re-reading raw campaign YAML.
 */
export interface CampaignCollections {
  fleets: unknown[];
  economies: unknown[];
  constructions: unknown[];
  diplomacy: unknown[];
  research: unknown[];
  designs: unknown[];
  /** Authored initial divisions; absent for a pack that declares none (N-1 ticket 07). */
  divisions?: unknown[];
}

/**
 * The full compiled content bundle: the content-pack collections plus the
 * ship-building catalogue and the campaign-file collections, under one inert,
 * hash-pinned artifact. `generatedBy` is the do-not-edit marker (BW-RUL-002,
 * DESIGN-05).
 */
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
  /** The content-pack subset (unchanged shape; the `bwc compile` wire format). */
  pack: ContentPack;
  rawHash: string;
  envelopeHash: string;
  /**
   * The full bundle, including the ship-building catalogue when the input
   * carried it. Always present; `shipBuilding` is absent for content-pack-only
   * inputs so `canonicalSerialize(bundle)` stays backwards-compatible.
   */
  bundle: ContentBundle;
  /** The semantic content version, from the pack manifest. */
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
