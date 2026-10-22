import generatedV1 from "../assets/starting-fleet-method/inherit-an-existing-navy-1.jpg";
import disabledV1 from "../assets/starting-fleet-method/build-the-legacy-fleet-manually-1.jpg";
import historicalV1 from "../assets/starting-fleet-method/curated-historical-inspired-fleet-1.jpg";

export type FleetMethodArtworkId = "generated" | "disabled" | "historical";

export const FLEET_METHOD_ARTWORK: Readonly<Record<FleetMethodArtworkId, string>> = {
  generated: generatedV1,
  disabled: disabledV1,
  historical: historicalV1,
};

export function getFleetMethodArtwork(artworkId: FleetMethodArtworkId): string {
  return FLEET_METHOD_ARTWORK[artworkId];
}
