/**
 * Card artwork for the Starting-fleet method picker (spec §5b), presentation
 * content only — never authoritative state (mirrors
 * `preferenceArtworkManifest`).
 *
 * Asset filenames appear only here; callers resolve by a stable id, so renaming
 * a file can never break the screen. The ids match the engine's validated
 * `legacyFleetModeId`s (`packages/campaign/src/scenario.ts`).
 */
import generatedV1 from "../assets/starting-fleet-method/inherit-an-existing-navy-1.jpg";
import disabledV1 from "../assets/starting-fleet-method/build-the-legacy-fleet-manually-1.jpg";
import historicalV1 from "../assets/starting-fleet-method/curated-historical-inspired-fleet-1.jpg";

/** Fleet-method ids the artwork manifest answers for. */
export type FleetMethodArtworkId = "generated" | "disabled" | "historical";

export const FLEET_METHOD_ARTWORK: Readonly<Record<FleetMethodArtworkId, string>> = {
  generated: generatedV1,
  disabled: disabledV1,
  historical: historicalV1,
};

export function getFleetMethodArtwork(artworkId: FleetMethodArtworkId): string {
  return FLEET_METHOD_ARTWORK[artworkId];
}
