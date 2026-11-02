import {
  ZONE_IDS,
  type DesignDraft,
  type MountSide,
  type PartCatalogueEntry,
  type ZoneId,
} from "@bluewave/ship-design";
import type { DrawingBoardContent } from "../../content.js";

export const zoneLabel = (z: string) => z.replaceAll("_", " ").toLowerCase();

export const isMountSide = (v: string): v is MountSide =>
  v === "CENTRE" || v === "PORT" || v === "STBD";

export function midStation(content: DrawingBoardContent, draft: DesignDraft, zone: ZoneId): number {
  const z = content.hullForms
    .find((f) => f.id === draft.hull.hullFormId)
    ?.zones.find((q) => q.id === zone);
  return z ? Math.floor((z.startPermille + z.endPermille) / 2) : 500;
}

export function allowedZonesFor(
  entry: Pick<PartCatalogueEntry, "allowedZones"> | undefined,
): readonly ZoneId[] {
  return (entry?.allowedZones as ZoneId[] | undefined) ?? [...ZONE_IDS];
}

export function addZoneFor(
  entry: Pick<PartCatalogueEntry, "allowedZones">,
  selectedZone: ZoneId,
): ZoneId {
  const zones = allowedZonesFor(entry);
  return zones.includes(selectedZone) ? selectedZone : zones[0]!;
}
