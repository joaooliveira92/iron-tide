import type { WorldMapChartProps } from "../world-map/WorldMapChart.js";

type Overlay = NonNullable<WorldMapChartProps["overlay"]>;

const byId = (left: { readonly id: string }, right: { readonly id: string }) =>
  left.id < right.id ? -1 : left.id > right.id ? 1 : 0;

export function buildEntityRows(overlay: Pick<Overlay, "ports" | "fleets">) {
  const ports = [...overlay.ports].sort(byId).map((port) => ({
    id: `port:${port.id}`,
    name: port.name,
    kind: "port" as const,
    areaId: port.area,
  }));
  const fleets = [...overlay.fleets].sort(byId).map((fleet) => ({
    id: `fleet:${fleet.id}`,
    name: fleet.name,
    kind: "fleet" as const,
    areaId: fleet.area,
  }));
  return [...ports, ...fleets];
}
