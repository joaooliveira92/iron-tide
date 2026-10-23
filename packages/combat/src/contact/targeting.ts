import { BluewaveError } from "@bluewave/contracts";
export interface ContactTrack {
  contactId: string;
  estimatedIdentity: string;
  position: [number, number];
  course: number;
  speed: number;
  confidence: number;
  observationTime: string;
  source: string;
  uncertainty: number;
}

export function validateTargetOrder(
  contactId: string,
  knownTracks: Map<string, ContactTrack> | ContactTrack[],
  trueAssetId?: string,
) {
  const map = Array.isArray(knownTracks)
    ? new Map(knownTracks.map((c) => [c.contactId, c]))
    : knownTracks;
  if (!map.has(contactId)) {
    throw new BluewaveError("TACTICAL_FOG_OF_WAR_VIOLATION", {
      code: "TACTICAL_FOG_OF_WAR_VIOLATION",
      contactId,
      trueAssetId,
    });
  }
  const track = map.get(contactId)!;
  if (track.confidence <= 0)
    throw new BluewaveError("TACTICAL_FOG_OF_WAR_VIOLATION", {
      code: "TACTICAL_FOG_OF_WAR_VIOLATION",
      contactId,
    });
  return track;
}
