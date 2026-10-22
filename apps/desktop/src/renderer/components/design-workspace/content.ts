import {
  buildPartCatalogueView,
  buildShipBuildingContent,
  legacyCatalogueView,
  type ComponentDef,
  type PartCatalogueEntry,
  type RawReferenceDesign,
  type ShipBuildingContent,
  type ShipBuildingData,
} from "@bluewave/ship-design";
import type { DrawingBoardContentDto } from "../../../shared/content-contract.js";

export type ReferenceDesign = RawReferenceDesign;

export interface DrawingBoardContent extends ShipBuildingContent {
  readonly references: readonly ReferenceDesign[];
  readonly catalogue: readonly PartCatalogueEntry[];
}

export function catalogueView(
  components: readonly ComponentDef[],
  partModel: ShipBuildingData["partModel"],
): readonly PartCatalogueEntry[] {
  return partModel === undefined
    ? legacyCatalogueView(components)
    : buildPartCatalogueView(partModel);
}

let injected: DrawingBoardContentDto | null = null;
let cached: DrawingBoardContent | null = null;

export function setDrawingBoardContent(dto: DrawingBoardContentDto): void {
  injected = dto;
  cached = null;
}

export function hasDrawingBoardContent(): boolean {
  return injected !== null;
}

function buildDrawingBoardContent(dto: DrawingBoardContentDto): DrawingBoardContent {
  return {
    ...buildShipBuildingContent(dto.catalogue),
    references: dto.catalogue.referenceDesigns ?? [],
    catalogue: catalogueView(dto.catalogue.components, dto.catalogue.partModel),
  };
}

export function loadDrawingBoardContent(): DrawingBoardContent {
  if (cached) return cached;
  if (injected === null) {
    throw new Error(
      "Drawing-board content has not been loaded from the main process (inspectDrawingBoardContent).",
    );
  }
  cached = buildDrawingBoardContent(injected);
  return cached;
}
