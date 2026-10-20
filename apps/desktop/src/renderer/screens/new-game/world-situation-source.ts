import type { OpeningBriefingProjection } from "@bluewave/campaign-engine";
import {
  areaRegion,
  hasPresentationContent,
  nationHomeArea,
  nationIdToCountryId,
  nationPresentationOrNull,
  presentationRegions,
} from "../../content/presentationContent.js";
import type { NationProfileSource, WorldSituationSource } from "./world-situation.js";

/** The authored profile of a campaign nation id, or null when none is injected or authored. */
function profileFor(nationId: string): NationProfileSource | null {
  if (!hasPresentationContent()) return null;
  const countryId = nationIdToCountryId(nationId);
  if (countryId === null) return null;
  const record = nationPresentationOrNull(countryId);
  if (record === null) return null;
  return {
    officialName: record.flavor.name,
    diplomacy: record.flavor.diplomacy,
    military: record.flavor.military,
    economy: record.flavor.economy,
    strategicRegions: record.dossier.strategicRegions,
    doctrine: record.dossier.doctrine,
    budgetCategory: record.dossier.budgetCategory,
    shipbuildingCapacity: record.dossier.shipbuildingCapacity,
    likelyRivals: record.dossier.likelyRivals,
  };
}

/**
 * Binds the engine projection to the decoded presentation content (theatre
 * grouping and authored nation profiles). Without injected content the briefing
 * degrades to relationship-only placement rather than failing.
 */
export function worldSituationSource(projection: OpeningBriefingProjection): WorldSituationSource {
  const loaded = hasPresentationContent();
  return {
    projection,
    theaters: loaded ? presentationRegions() : [],
    areaTheater: loaded ? areaRegion() : {},
    homeAreaId: loaded ? nationHomeArea(projection.nationId) : null,
    profileFor,
  };
}
