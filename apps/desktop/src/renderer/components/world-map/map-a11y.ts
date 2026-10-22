export interface AreaOwnershipRow {
  readonly id: string;
  readonly name: string;
  readonly owner: string | null;
  readonly fleets: number;
  readonly possessions: number;
  readonly selected: boolean;
  readonly strength: string | null;
  readonly unavailable: boolean;
}

export function describeArea(row: AreaOwnershipRow): string {
  const owner = row.owner === null ? "unclaimed" : `held by ${row.owner}`;
  const fleets =
    row.fleets === 0 ? "no fleets" : row.fleets === 1 ? "1 fleet" : `${row.fleets} fleets`;
  const strength = row.strength === null ? "" : `, ${row.strength}`;
  const unavailable = row.unavailable ? ", no campaign data" : "";
  return `${row.name}: ${owner}, ${fleets}${strength}${unavailable}`;
}

export function buildOwnershipRows(
  areas: readonly { readonly id: string; readonly name: string }[],
  ownerOf: (areaId: string) => string | null,
  fleetCountOf: (areaId: string) => number,
  possessionCountOf: (areaId: string) => number,
  selected: string | null,
  strengthOf: (areaId: string) => string | null = () => null,
  unavailableOf: (areaId: string) => boolean = () => false,
): AreaOwnershipRow[] {
  return areas
    .map((area) => ({
      id: area.id,
      name: area.name,
      owner: ownerOf(area.id),
      fleets: fleetCountOf(area.id),
      possessions: possessionCountOf(area.id),
      selected: area.id === selected,
      strength: strengthOf(area.id),
      unavailable: unavailableOf(area.id),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function filterAreaRows(
  rows: readonly AreaOwnershipRow[],
  query: string,
): readonly AreaOwnershipRow[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return rows;
  return rows.filter(
    (row) =>
      row.name.toLowerCase().includes(needle) ||
      (row.owner ?? "unclaimed").toLowerCase().includes(needle),
  );
}

export type AreaMetric = "ships" | "possessions";

export function areaMetricText(row: AreaOwnershipRow, metric: AreaMetric): string | null {
  const count = metric === "ships" ? row.fleets : row.possessions;
  if (count === 0) return null;
  const noun =
    metric === "ships"
      ? count === 1
        ? "fleet"
        : "fleets"
      : count === 1
        ? "possession"
        : "possessions";
  return `${count} ${noun}`;
}
