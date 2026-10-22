import type { MediaAsset, NationAssetKind } from "./mediaAsset.js";
import { NATION_ASSET_MANIFEST } from "./nationAssetManifest.js";

export type NationAssetLayer = "scenario_nation_instance" | "political_regime" | "country_identity";

export type NationAssetRequest = {
  countryId: string;
  regimeId?: string;
  instanceId?: string;
};

export type NationAssetManifest = {
  countries: Record<string, Partial<Record<NationAssetKind, MediaAsset>>>;
  regimes: Record<string, Partial<Record<NationAssetKind, MediaAsset>>>;
  instances: Record<string, Partial<Record<NationAssetKind, MediaAsset>>>;
};

export type ResolvedNationAsset =
  | { status: "resolved"; asset: MediaAsset; layer: NationAssetLayer }
  | { status: "unavailable"; countryId: string; kind: NationAssetKind };

export function resolveNationAsset(
  request: NationAssetRequest,
  kind: NationAssetKind,
  manifest: NationAssetManifest = NATION_ASSET_MANIFEST,
): ResolvedNationAsset {
  const chain: [NationAssetLayer, MediaAsset | undefined][] = [
    [
      "scenario_nation_instance",
      request.instanceId ? manifest.instances[request.instanceId]?.[kind] : undefined,
    ],
    ["political_regime", request.regimeId ? manifest.regimes[request.regimeId]?.[kind] : undefined],
    ["country_identity", manifest.countries[request.countryId]?.[kind]],
  ];

  for (const [layer, asset] of chain) {
    if (asset) return { status: "resolved", asset, layer };
  }
  return { status: "unavailable", countryId: request.countryId, kind };
}
