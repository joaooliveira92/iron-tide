import type {
  PresentationCoordinatesDto,
  PresentationFlavorDto,
} from "../../shared/content-contract.js";
import type { MediaAsset } from "./mediaAsset.js";
import { PLAYABLE_SLOT_COUNTRY_IDS, type PlayableSlotCountryId } from "./nationAssetManifest.js";
import { nationPresentation } from "./presentationContent.js";
import {
  type NationAssetManifest,
  type NationAssetRequest,
  type ResolvedNationAsset,
  resolveNationAsset,
} from "./resolveNationAsset.js";

export type NationColours =
  | {
      status: "resolved";
      asset: MediaAsset;
      kind: "nation_flag" | "nation_ensign";
    }
  | { status: "unavailable"; countryId: string };

export type NationPresentation = Readonly<{
  countryId: PlayableSlotCountryId;
  name: string;
  code: string;
  coordinates: PresentationCoordinatesDto;
  flavor: PresentationFlavorDto;
  nationalColours: NationColours;
  shipArtwork: ResolvedNationAsset;
  markerColour: string;
}>;

export type NationPresentationResult =
  | { status: "resolved"; nation: NationPresentation }
  | { status: "unavailable"; countryId: string };

export function resolveNationPresentation(
  request: NationAssetRequest,
  manifest?: NationAssetManifest,
): NationPresentationResult {
  if (!isPlayableSlotCountryId(request.countryId)) {
    return { status: "unavailable", countryId: request.countryId };
  }

  const countryId = request.countryId;
  const record = nationPresentation(countryId);
  const flag = resolveNationAsset(request, "nation_flag", manifest);
  const ensign = resolveNationAsset(request, "nation_ensign", manifest);
  const nationalColours: NationColours =
    flag.status === "resolved"
      ? { status: "resolved", asset: flag.asset, kind: "nation_flag" }
      : ensign.status === "resolved"
        ? { status: "resolved", asset: ensign.asset, kind: "nation_ensign" }
        : { status: "unavailable", countryId };

  return {
    status: "resolved",
    nation: Object.freeze({
      countryId,
      name: record.flavor.name,
      code: record.code,
      coordinates: record.coordinates,
      flavor: record.flavor,
      nationalColours,
      shipArtwork: resolveNationAsset(request, "ship_silhouette", manifest),
      markerColour: record.markerColour,
    }),
  };
}

export function getNationPresentation(countryId: PlayableSlotCountryId): NationPresentation {
  const result = resolveNationPresentation({ countryId });
  if (result.status === "unavailable") {
    throw new Error(`Missing presentation content for playable nation: ${countryId}`);
  }
  return result.nation;
}

export function isPlayableSlotCountryId(value: string): value is PlayableSlotCountryId {
  return (PLAYABLE_SLOT_COUNTRY_IDS as readonly string[]).includes(value);
}
