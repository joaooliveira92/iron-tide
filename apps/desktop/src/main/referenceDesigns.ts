import {
  referenceDesignsFromLoadouts,
  type DesignDraft,
  type ReferenceDesignProvenance,
} from "@bluewave/ship-design";
import type { ShipBuildingCatalogue } from "@bluewave/content-compiler";

import { ContentArtifactError, readContentArtifact } from "./contentArtifact.js";
import { resolveGeneratedContentDir } from "./contentPack.js";

export interface RawReferenceDesignFile {
  readonly id: string;
  readonly name: string;
  readonly month: string;
  readonly starterFor?: string;
  readonly historical?: boolean;
  readonly provenance?: ReferenceDesignProvenance;
  readonly draft: DesignDraft;
}

export function readReferenceDesigns(): RawReferenceDesignFile[] {
  const { bundle } = readContentArtifact(resolveGeneratedContentDir());
  const catalogue = bundle.shipBuilding as ShipBuildingCatalogue | undefined;
  if (catalogue === undefined) {
    throw new ContentArtifactError(
      "CONTENT_ARTIFACT_INVALID",
      "The compiled content artifact carries no ship-building catalogue.",
    );
  }
  if (catalogue.partModel !== undefined && catalogue.designLoadouts !== undefined) {
    return referenceDesignsFromLoadouts(
      catalogue.designLoadouts as Parameters<typeof referenceDesignsFromLoadouts>[0],
      catalogue.partModel,
      catalogue.referenceDesigns as Parameters<typeof referenceDesignsFromLoadouts>[2],
    );
  }
  return catalogue.referenceDesigns as RawReferenceDesignFile[];
}
