/**
 * The source and destination shapes of the content codemod (ship-part-model ticket 11c).
 *
 * A `LegacySource` is today's authoritative content decoded into memory: the same shapes the
 * whole-catalogue builder of 11b reads. A `StagedSource` is the codemod's own parts-based
 * output read back — the fixed point a second migration must reproduce. Neither performs I/O;
 * the loader (`load.ts`) and publisher (`publish.ts`) own the filesystem.
 */
import type {
  DesignHeaderData,
  FlattenedPart,
  LoadoutData,
  PlatformData,
  SlotTemplateData,
} from "@bluewave/content-schema";
import type {
  ArmourBalance,
  AuthoredArmamentContent,
  ComponentDef,
  HullFormRecord,
  NationNavalProfile,
  PropulsionPlant,
  RawReferenceDesign,
  TorpedoModelSource,
} from "@bluewave/ship-design";

/** One source file read, with its content hash — the source identity of a migration. */
export interface SourceFileRef {
  /** Content-relative path, never a host path. */
  readonly path: string;
  readonly sha256: string;
}

/** The authoritative legacy content a migration reads (passed in; the planner does no I/O). */
export interface LegacySource {
  readonly components: readonly ComponentDef[];
  readonly plants: readonly PropulsionPlant[];
  readonly armour: Pick<ArmourBalance, "materialEffBp" | "materialAvailability">;
  readonly armament: AuthoredArmamentContent;
  readonly profiles: readonly NationNavalProfile[];
  readonly hullForms: readonly HullFormRecord[];
  readonly designs: readonly RawReferenceDesign[];
  /** The closed tag vocabulary a component's `tags` must belong to (`PART_TAGS`). */
  readonly tagVocabulary: readonly string[];
  /** The structured diameter of a torpedo model in µm, or `undefined` when it has none. */
  readonly torpedoDiameterUm: (torpedoModelId: string) => number | undefined;
  /** Every torpedo model the buildable catalogue references (ticket 13a, SPM-R17). */
  readonly torpedoModels: readonly TorpedoModelSource[];
  readonly sourceFiles: readonly SourceFileRef[];
}

/** A design as the staged output carries it: the legacy metadata plus its parts representation. */
export interface StagedDesign {
  readonly id: string;
  readonly name: string;
  readonly month: string;
  readonly starterFor?: string;
  readonly header: DesignHeaderData;
  readonly loadout: LoadoutData;
}

/** The staged tree read back as a migration source (the idempotency fixed point). */
export interface StagedSource {
  readonly parts: readonly FlattenedPart[];
  readonly slotTemplates: readonly SlotTemplateData[];
  readonly platforms: readonly PlatformData[];
  readonly designs: readonly StagedDesign[];
  readonly sourceFiles: readonly SourceFileRef[];
  /** The data-quality block of the staged manifest, if the tree carries one (re-emitted). */
  readonly previousDataQuality?: MigrationManifest["dataQuality"];
  /** The source identity of the staged manifest, if any: re-emitting keeps the fixed point exact. */
  readonly previousSource?: MigrationManifest["source"];
}

/** One generated file: a content-relative path, its record count and its exact bytes. */
export interface GeneratedFile {
  readonly path: string;
  readonly records: number;
  readonly content: string;
}

/** The independent data-quality counts the manifest records (SPM-R23, corrected 11c). */
export interface ManifestDataQuality {
  /** Gun placements for a nation with no first-class armament content. */
  readonly unresolvedArmamentPlacements: number;
  /** `FIT_MAGAZINE_*` relationships the fit stage could not resolve. */
  readonly unresolvedMagazineRelationships: number;
  /** Applied `DQ-TORPEDO-001` waivers. */
  readonly waivers: number;
  readonly centralBatteryPlacements: number;
  readonly launcherVariants: number;
  readonly waivedLauncherRecords: number;
  readonly torpedoEntriesAffected: number;
}

/** The machine-readable manifest beside every staged tree (`manifest.json`). */
export interface MigrationManifest {
  readonly schema: "ship-part-content-migration/1";
  /** Always true in 11c: the codemod stages content and never activates production. */
  readonly stagedOnly: true;
  readonly source: {
    readonly kind: "legacy" | "staged";
    readonly files: readonly SourceFileRef[];
    readonly hash: string;
  };
  readonly content: {
    readonly files: readonly {
      readonly path: string;
      readonly records: number;
      readonly sha256: string;
    }[];
    /** The hash every migration of the same content must reproduce. */
    readonly hash: string;
  };
  readonly records: {
    readonly parts: number;
    readonly partsByFamily: Readonly<Record<string, number>>;
    readonly slotTemplates: number;
    readonly platforms: number;
    readonly designs: number;
    readonly placements: number;
    readonly gunPlacements: number;
    readonly tubePlacements: number;
    readonly fittingPlacements: number;
  };
  readonly dataQuality: ManifestDataQuality;
}

/** A fully planned migration: the content files, the manifest, and their trees' hash. */
export interface MigrationPlan {
  /** Content files only, sorted by path; the manifest is separate. */
  readonly files: readonly GeneratedFile[];
  readonly manifestFile: GeneratedFile;
  readonly manifest: MigrationManifest;
  /** The planned designs, in codepoint order (a convenience view of the design files). */
  readonly designs: readonly StagedDesign[];
  /** SHA-256 over `(path, content hash)` of every content file — the fixed-point identity. */
  readonly contentHash: string;
}

export const MANIFEST_PATH = "manifest.json";
