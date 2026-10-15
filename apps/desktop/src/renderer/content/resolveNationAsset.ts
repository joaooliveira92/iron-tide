import type { MediaAsset, NationAssetKind } from "./mediaAsset.js";
import { NATION_ASSET_MANIFEST } from "./nationAssetManifest.js";

/**
 * The nation identity layers an asset may be bound to, most specific first
 * (CONTEXT.md §4 "Nation Identity Layers"). Assets resolve through these layers
 * rather than through the stable `playable_slot`, so one slot can show
 * era- and regime-specific art without its selection identity changing.
 */
export type NationAssetLayer = "scenario_nation_instance" | "political_regime" | "country_identity";

/**
 * Which nation to resolve art for. Only `countryId` is required; the upper
 * layers are supplied when the caller knows them, and are skipped when they
 * carry no override for the requested kind. The 1880 tracer only exercises the
 * country level, but the signature admits the full chain (ADR-0003).
 */
export type NationAssetRequest = {
  countryId: string;
  regimeId?: string;
  instanceId?: string;
};

/** Assets keyed by identity-layer id, then by kind. */
export type NationAssetManifest = {
  countries: Record<string, Partial<Record<NationAssetKind, MediaAsset>>>;
  regimes: Record<string, Partial<Record<NationAssetKind, MediaAsset>>>;
  instances: Record<string, Partial<Record<NationAssetKind, MediaAsset>>>;
};

/**
 * Either the resolved asset (tagged with the layer that answered) or an explicit
 * unavailable placeholder. A missing asset is a content error surfaced as
 * `unavailable` — it is *never* filled in with another nation's art
 * (CONTEXT.md §5 "Asset Resolution").
 */
export type ResolvedNationAsset =
  | { status: "resolved"; asset: MediaAsset; layer: NationAssetLayer }
  | { status: "unavailable"; countryId: string; kind: NationAssetKind };

/**
 * Resolve one nation's asset of a given kind, walking the identity layers from
 * most specific to the country default. Pure: same request, same manifest, same
 * answer — and it touches no campaign state.
 */
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
