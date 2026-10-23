export type PlotView = "plot" | "bands";

export type PlotLayer = "rings" | "links" | "blockades" | "names";

export const PLOT_VIEWS: readonly {
  readonly id: PlotView;
  readonly label: string;
  readonly hint: string;
}[] = [
  { id: "plot", label: "Plot", hint: "You at the centre; the nearer a nation, the nearer war" },
  { id: "bands", label: "Bands", hint: "Every nation in a column by its tension" },
];

export const PLOT_LAYERS: readonly { readonly id: PlotLayer; readonly label: string }[] = [
  { id: "rings", label: "Range rings and bearings" },
  { id: "links", label: "Alliances, pacts and wars" },
  { id: "blockades", label: "Blockades" },
  { id: "names", label: "Nation names" },
];

export const DEFAULT_PLOT_LAYERS: ReadonlySet<PlotLayer> = new Set(
  PLOT_LAYERS.map((layer) => layer.id),
);

export function toggleLayer(
  layers: ReadonlySet<PlotLayer>,
  layer: PlotLayer,
): ReadonlySet<PlotLayer> {
  const next = new Set(layers);
  if (next.has(layer)) next.delete(layer);
  else next.add(layer);
  return next;
}
