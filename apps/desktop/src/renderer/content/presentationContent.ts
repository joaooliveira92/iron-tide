import type {
  MapJoinDto,
  PresentationDossierDto,
  NationPresentationDto,
  PresentationCoordinatesDto,
  PresentationContentDto,
  PresentationFlavorDto,
  RegionDto,
} from "../../shared/content-contract.js";

export type {
  MapJoinDto,
  PresentationDossierDto,
  NationPresentationDto,
  PresentationCoordinatesDto,
  PresentationContentDto,
  PresentationFlavorDto,
  RegionDto,
};

let injected: PresentationContentDto | null = null;

export function setPresentationContent(dto: PresentationContentDto): void {
  injected = dto;
}

export function hasPresentationContent(): boolean {
  return injected !== null;
}

function content(): PresentationContentDto {
  if (injected === null) {
    throw new Error(
      "Presentation content has not been loaded from the main process (inspectPresentationContent).",
    );
  }
  return injected;
}

export function presentationNations(): readonly NationPresentationDto[] {
  return content().nations;
}

export function nationPresentation(countryId: string): NationPresentationDto {
  const found = content().nations.find((nation) => nation.countryId === countryId);
  if (found === undefined) {
    throw new Error(`Missing presentation content for nation: ${countryId}`);
  }
  return found;
}

export function nationPresentationOrNull(countryId: string): NationPresentationDto | null {
  return content().nations.find((nation) => nation.countryId === countryId) ?? null;
}

export function nationFlavor(countryId: string): PresentationFlavorDto {
  return nationPresentation(countryId).flavor;
}

export function nationDossier(countryId: string): PresentationDossierDto {
  return nationPresentation(countryId).dossier;
}

export function countryIdToNationId(countryId: string): string | null {
  return nationPresentationOrNull(countryId)?.nationId ?? null;
}

export function nationIdToCountryId(nationId: string): string | null {
  return content().nations.find((nation) => nation.nationId === nationId)?.countryId ?? null;
}

export function nationDisplayName(nationId: string): string {
  const countryId = nationIdToCountryId(nationId);
  return countryId === null ? nationId : nationPresentation(countryId).flavor.name;
}

export function presentationRegions(): readonly RegionDto[] {
  return content().regions.regions;
}

export function areaRegion(): Readonly<Record<string, string>> {
  return content().regions.areaRegion;
}

function mapJoin(): MapJoinDto {
  return content().mapJoin;
}

export function campaignNationHue(nationId: string): number {
  return mapJoin().nationHue[nationId] ?? 0;
}

export function campaignNationLabel(nationId: string): string {
  return mapJoin().nationLabel[nationId] ?? nationId;
}

export function nationHomeArea(nationId: string | null): string | null {
  if (nationId === null) return null;
  return mapJoin().nationHomeArea[nationId] ?? null;
}

export function fixtureAreaId(campaignAreaId: string): string | null {
  return mapJoin().campaignAreaToFixture[campaignAreaId] ?? null;
}
