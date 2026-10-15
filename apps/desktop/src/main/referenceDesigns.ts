import {
  referenceDesignsFromLoadouts,
  type DesignDraft,
  type ReferenceDesignProvenance,
} from "@bluewave/ship-design";
import type { ShipBuildingCatalogue } from "@bluewave/content-compiler";

import { ContentArtifactError, readContentArtifact } from "./contentArtifact.js";
import { resolveGeneratedContentDir } from "./contentPack.js";

/** A raw reference design as authored under `ship-building/reference-designs/<nation>/` (ADR-0109). */
export interface RawReferenceDesignFile {
  readonly id: string;
  readonly name: string;
  readonly month: string;
  readonly starterFor?: string;
  /** True when the design reconstructs a documented real ship (ticket 39). */
  readonly historical?: boolean;
  /** Machine-readable provenance of the reconstructed facts (historical designs only, ticket 39). */
  readonly provenance?: ReferenceDesignProvenance;
  readonly draft: DesignDraft;
}

/**
 * Every reference design, read from the compiled content artifact (ADR-0122) —
 * never from raw YAML. When the pack carries the parts model and design loadouts
 * (ship-part-model ticket 11d), the loadouts are authoritative and the draft is
 * rebuilt from them; the legacy `referenceDesigns` array is the harness baseline.
 */
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
