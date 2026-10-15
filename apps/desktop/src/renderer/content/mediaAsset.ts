/**
 * Media Asset — presentation content, never authoritative state (CONTEXT.md §5,
 * docs/adr/0003-presentation-assets-and-flavor-text.md).
 *
 * An asset is a referenced visual identified by a stable asset id and resolved
 * from the content pack. Nothing here is stored in campaign.sqlite or enters the
 * campaign snapshot hash: replacing the art must never move a simulation
 * outcome. Components reference assets by id through the manifest, never by
 * filename.
 */

/** The named asset kinds (CONTEXT.md §5 "Media Asset"). */
export type NationAssetKind = "nation_flag" | "nation_ensign" | "ship_silhouette";

/** Provenance labels from CONTEXT.md §5 that presentation assets may carry. */
export type ProvenanceLabel =
  | "CANONICAL_CONTENT"
  | "MANUAL_EXPLICIT"
  | "DESIGN_DECISION"
  | "SCENARIO_OVERRIDE";

export type MediaAsset = {
  /** Stable content-pack id — the only handle callers should persist or log. */
  assetId: string;
  kind: NationAssetKind;
  /** Resolved URL for the bundled file. Bundler-owned; never hand-written. */
  url: string;
  /** Human-readable description, used as the image's accessible name. */
  label: string;
  provenance: ProvenanceLabel;
};
