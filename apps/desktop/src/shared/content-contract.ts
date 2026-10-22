import type { ShipBuildingData } from "@bluewave/ship-design";

export interface DrawingBoardContentDto {
  readonly catalogue: ShipBuildingData;
}

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

export interface UiCatalogueDto {
  readonly locale: string;
  readonly strings: Readonly<Record<string, string>>;
}
