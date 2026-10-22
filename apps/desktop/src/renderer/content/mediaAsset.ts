export type NationAssetKind = "nation_flag" | "nation_ensign" | "ship_silhouette";

export type ProvenanceLabel =
  | "CANONICAL_CONTENT"
  | "MANUAL_EXPLICIT"
  | "DESIGN_DECISION"
  | "SCENARIO_OVERRIDE";

export type MediaAsset = {
  assetId: string;
  kind: NationAssetKind;
  url: string;
  label: string;
  provenance: ProvenanceLabel;
};
