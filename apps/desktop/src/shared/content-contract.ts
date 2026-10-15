import type { ShipBuildingData } from "@bluewave/ship-design";

/**
 * The drawing-board content the main process decodes once and ships to the
 * renderer over the narrow content-query IPC (`inspectDrawingBoardContent`).
 *
 * Data-only: every field is structured-cloneable (the runtime
 * `ShipBuildingContent` the board compiles against carries functions and cannot
 * cross the wire; the renderer rebuilds it with the effect-free
 * `buildShipBuildingContent`). The renderer never sees a file path, a raw
 * document, or a parser — only this decoded DTO (ADR-0105 `MIG-EXCL-1`).
 *
 * `catalogue.referenceDesigns` is authored discovery order (UK first, starters
 * before historical), so the renderer's first reference design stays the
 * historical default (ADR-0109).
 */
export interface DrawingBoardContentDto {
  readonly catalogue: ShipBuildingData;
}

/**
 * The nation-facing presentation corpus the main process decodes from the
 * verified artifact and ships to the renderer over the same narrow
 * content-query IPC (`inspectPresentationContent`, CAH-PRES-1/CAH-PRES-3).
 *
 * Data-only: structured-cloneable, with no file path, raw document or parser —
 * only decoded presentation content (ADR-0105 `MIG-EXCL-1`, ADR-0125). The
 * renderer reads these DTOs instead of owning a duplicated hand-authored table
 * (DESIGN-57).
 */
export interface PresentationCoordinatesDto {
  readonly lat: number;
  readonly lng: number;
  readonly label: string;
}

export interface PresentationFlavorDto {
  readonly name: string;
  readonly economy: string;
  readonly military: string;
  readonly diplomacy: string;
}

export interface PresentationDossierDto {
  readonly appointmentTitle: string;
  readonly doctrine: string;
  readonly strategicRegions: string;
  readonly budgetCategory: string;
  readonly shipbuildingCapacity: string;
  readonly researchStrengths: string;
  readonly researchWeaknesses: string;
  readonly nationalCharacteristics: string;
  readonly likelyRivals: readonly string[];
  readonly difficulty: 1 | 2 | 3 | 4 | 5;
}

export interface NationPresentationDto {
  readonly countryId: string;
  readonly nationId: string;
  readonly code: string;
  readonly markerColour: string;
  readonly coordinates: PresentationCoordinatesDto;
  readonly flavor: PresentationFlavorDto;
  readonly dossier: PresentationDossierDto;
}

export interface RegionDto {
  readonly id: string;
  readonly label: string;
}

export interface RegionGroupingDto {
  readonly regions: readonly RegionDto[];
  readonly areaRegion: Readonly<Record<string, string>>;
}

export interface MapJoinDto {
  readonly campaignAreaToFixture: Readonly<Record<string, string>>;
  readonly nationHue: Readonly<Record<string, number>>;
  readonly nationLabel: Readonly<Record<string, string>>;
  readonly nationHomeArea: Readonly<Record<string, string>>;
}

export interface PresentationContentDto {
  readonly nations: readonly NationPresentationDto[];
  readonly regions: RegionGroupingDto;
  readonly mapJoin: MapJoinDto;
}
