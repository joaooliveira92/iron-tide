import type { NationRailRow } from "./nation-rail-state.js";

export type NationRailFilter = "all" | "war" | "allied" | "tense";
export type NationRailSort = "name" | "tension";
export type NationRailGroupId = "enemies" | "allies" | "partners" | "neutral";

export const PROVISIONAL_TENSION_ALERT = 8;
export const PROVISIONAL_TENSION_ELEVATED = 5;

export interface NationRailGroup {
  readonly id: NationRailGroupId;
  readonly label: string;
  readonly rows: readonly NationRailRow[];
}

export interface NationRailSummary {
  readonly war: number;
  readonly allied: number;
  readonly tense: number;
  readonly attention: number;
}

export interface NationRailArrangement {
  readonly player: NationRailRow | null;
  readonly groups: readonly NationRailGroup[];
}

const GROUPS: readonly { readonly id: NationRailGroupId; readonly label: string }[] = [
  { id: "enemies", label: "Enemies" },
  { id: "allies", label: "Allies" },
  { id: "partners", label: "Pact and trade partners" },
  { id: "neutral", label: "Neutral" },
];

function isTense(row: NationRailRow): boolean {
  return row.tension !== null && row.tension >= PROVISIONAL_TENSION_ALERT;
}

export function needsAttention(row: NationRailRow): boolean {
  return !row.isPlayer && (row.relation === "war" || row.blockade || isTense(row));
}

export function tensionLevel(tension: number): "calm" | "elevated" | "critical" {
  if (tension >= PROVISIONAL_TENSION_ALERT) return "critical";
  if (tension >= PROVISIONAL_TENSION_ELEVATED) return "elevated";
  return "calm";
}

function groupOf(row: NationRailRow): NationRailGroupId {
  if (row.relation === "war") return "enemies";
  if (row.relation === "alliance") return "allies";
  if (row.relation === "pact" || row.relation === "trade") return "partners";
  return "neutral";
}

export function summarizeNationRail(rows: readonly NationRailRow[]): NationRailSummary {
  const others = rows.filter((row) => !row.isPlayer);
  return {
    war: others.filter((row) => row.relation === "war").length,
    allied: others.filter((row) => row.relation === "alliance").length,
    tense: others.filter(isTense).length,
    attention: others.filter(needsAttention).length,
  };
}

export function describeNationRailSummary(summary: NationRailSummary): string {
  return [
    summary.war > 0 ? `${String(summary.war)} at war` : null,
    summary.allied > 0 ? `${String(summary.allied)} allied` : null,
    summary.tense > 0 ? `${String(summary.tense)} tense` : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");
}

function matches(row: NationRailRow, filter: NationRailFilter): boolean {
  if (filter === "war") return row.relation === "war";
  if (filter === "allied") return row.relation === "alliance";
  if (filter === "tense") return isTense(row);
  return true;
}

function compare(sort: NationRailSort) {
  return (a: NationRailRow, b: NationRailRow): number => {
    const attention = Number(needsAttention(b)) - Number(needsAttention(a));
    if (attention !== 0) return attention;
    if (sort === "tension") {
      const byTension = (b.tension ?? -1) - (a.tension ?? -1);
      if (byTension !== 0) return byTension;
    }
    return a.name.localeCompare(b.name);
  };
}

export function arrangeNationRail(
  rows: readonly NationRailRow[],
  filter: NationRailFilter,
  sort: NationRailSort,
): NationRailArrangement {
  const player = rows.find((row) => row.isPlayer) ?? null;
  const others = rows.filter((row) => !row.isPlayer && matches(row, filter)).sort(compare(sort));
  return {
    player,
    groups: GROUPS.map((group) => ({
      ...group,
      rows: others.filter((row) => groupOf(row) === group.id),
    })).filter((group) => group.rows.length > 0),
  };
}
