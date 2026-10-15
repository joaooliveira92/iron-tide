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

/**
 * The presentation-content seam (CAH-PRES-3/CAH-PRES-5). Main decodes the
 * nation-facing corpus (coordinates, flavor, dossier, the nation-id →
 * country-id slot mapping, the area → region grouping and the campaign-map
 * join) from the verified artifact and ships it over the narrow content-query
 * IPC (`inspectPresentationContent`). The app injects that decoded DTO here once
 * it arrives; tests inject the same DTO from the compiled artifact the global
 * setup produced. Nothing here parses YAML, reads the filesystem, or bundles a
 * validation runtime — the renderer reads decoded content only (ADR-0105
 * `MIG-EXCL-1`, ADR-0125).
 *
 * The authored corpus is the single source of truth for what the player sees
 * (DESIGN-57): the renderer no longer owns a second hand-authored table.
 */

let injected: PresentationContentDto | null = null;

/** Inject the decoded DTO (from IPC in the app, from the artifact in tests). */
export function setPresentationContent(dto: PresentationContentDto): void {
  injected = dto;
}

/** True once the decoded presentation corpus has been injected. */
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

/** The authored nation presentation records, in authored slot order. */
export function presentationNations(): readonly NationPresentationDto[] {
  return content().nations;
}

/** One nation's complete presentation record; throws when the id is unknown. */
export function nationPresentation(countryId: string): NationPresentationDto {
  const found = content().nations.find((nation) => nation.countryId === countryId);
  if (found === undefined) {
    throw new Error(`Missing presentation content for nation: ${countryId}`);
  }
  return found;
}

/** One nation's presentation record, or null when the id is unknown. */
export function nationPresentationOrNull(countryId: string): NationPresentationDto | null {
  return content().nations.find((nation) => nation.countryId === countryId) ?? null;
}

export function nationFlavor(countryId: string): PresentationFlavorDto {
  return nationPresentation(countryId).flavor;
}

export function nationDossier(countryId: string): PresentationDossierDto {
  return nationPresentation(countryId).dossier;
}

/** The nation-record id (`uk`, `germany`, …) for a presentation country id (`gb`, `de`, …). */
export function countryIdToNationId(countryId: string): string | null {
  return nationPresentationOrNull(countryId)?.nationId ?? null;
}

/** The presentation country id (`gb`, `de`, …) for a nation-record id (`uk`, `germany`, …). */
export function nationIdToCountryId(nationId: string): string | null {
  return content().nations.find((nation) => nation.nationId === nationId)?.countryId ?? null;
}

/** A nation-record id's canonical display name, falling back to the raw id. */
export function nationDisplayName(nationId: string): string {
  const countryId = nationIdToCountryId(nationId);
  return countryId === null ? nationId : nationPresentation(countryId).flavor.name;
}

/** The declared display regions, in display order. */
export function presentationRegions(): readonly RegionDto[] {
  return content().regions.regions;
}

/** Production-pack area id → display region id. */
export function areaRegion(): Readonly<Record<string, string>> {
  return content().regions.areaRegion;
}

/** The campaign-map join (area → fixture geometry, nation hue/label/home area). */
function mapJoin(): MapJoinDto {
  return content().mapJoin;
}

/** A campaign nation id's OKLCH hue, defaulting to a neutral grey. */
export function campaignNationHue(nationId: string): number {
  return mapJoin().nationHue[nationId] ?? 0;
}

/** A campaign nation id's display label, falling back to the raw id. */
export function campaignNationLabel(nationId: string): string {
  return mapJoin().nationLabel[nationId] ?? nationId;
}

/** A campaign nation id's home-waters area, or null when unknown. */
export function nationHomeArea(nationId: string | null): string | null {
  if (nationId === null) return null;
  return mapJoin().nationHomeArea[nationId] ?? null;
}

/** The fixture polygon a campaign area is drawn on, or null when it has none. */
export function fixtureAreaId(campaignAreaId: string): string | null {
  return mapJoin().campaignAreaToFixture[campaignAreaId] ?? null;
}
