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

export interface SourceFileRef {
  readonly path: string;
  readonly sha256: string;
}

export interface LegacySource {
  readonly components: readonly ComponentDef[];
  readonly plants: readonly PropulsionPlant[];
  readonly armour: Pick<ArmourBalance, "materialEffBp" | "materialAvailability">;
  readonly armament: AuthoredArmamentContent;
  readonly profiles: readonly NationNavalProfile[];
  readonly hullForms: readonly HullFormRecord[];
  readonly designs: readonly RawReferenceDesign[];
  readonly tagVocabulary: readonly string[];
  readonly torpedoDiameterUm: (torpedoModelId: string) => number | undefined;
  readonly torpedoModels: readonly TorpedoModelSource[];
  readonly sourceFiles: readonly SourceFileRef[];
}

export interface StagedDesign {
  readonly id: string;
  readonly name: string;
  readonly month: string;
  readonly starterFor?: string;
  readonly header: DesignHeaderData;
  readonly loadout: LoadoutData;
}

export interface StagedSource {
  readonly parts: readonly FlattenedPart[];
  readonly slotTemplates: readonly SlotTemplateData[];
  readonly platforms: readonly PlatformData[];
  readonly designs: readonly StagedDesign[];
  readonly sourceFiles: readonly SourceFileRef[];
  readonly previousDataQuality?: MigrationManifest["dataQuality"];
  readonly previousSource?: MigrationManifest["source"];
}

export interface GeneratedFile {
  readonly path: string;
  readonly records: number;
  readonly content: string;
}

export interface ManifestDataQuality {
  readonly unresolvedArmamentPlacements: number;
  readonly unresolvedMagazineRelationships: number;
  readonly waivers: number;
  readonly centralBatteryPlacements: number;
  readonly launcherVariants: number;
  readonly waivedLauncherRecords: number;
  readonly torpedoEntriesAffected: number;
}

export interface MigrationManifest {
  readonly schema: "ship-part-content-migration/1";
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

export interface MigrationPlan {
  readonly files: readonly GeneratedFile[];
  readonly manifestFile: GeneratedFile;
  readonly manifest: MigrationManifest;
  readonly designs: readonly StagedDesign[];
  readonly contentHash: string;
}

export const MANIFEST_PATH = "manifest.json";
