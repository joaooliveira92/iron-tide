import type {
  BattleHistoryEntry,
  BattleHistoryView,
  DivisionView,
} from "@bluewave/campaign-engine";
import type { DeferredFeature } from "../../components/shared/DeferredFeaturesPanel.js";
import { humanizeId } from "../../lib/humanize-id.js";
import { DEFERRED_SUBMARINE_ITEMS } from "./fleet-screen-state.js";

const CAUSE_LABELS: Readonly<Record<string, string>> = {
  gunfire: "sunk by gunfire",
  fire: "lost to fire",
  flooding: "lost to flooding",
  torpedo: "sunk by torpedo",
};

export interface LossRow {
  readonly key: string;
  readonly name: string;
  readonly classLabel: string;
  readonly cause: string | null;
  readonly month: string;
  readonly areaName: string;
}

export function playerLossRows(battles: readonly BattleHistoryEntry[]): readonly LossRow[] {
  const rows: (LossRow & { readonly sequence: number })[] = [];
  for (const battle of battles) {
    battle.lostShips.forEach((ship, index) => {
      if (!ship.ownedByPlayer) return;
      rows.push({
        key: `${battle.battleId}-${index}`,
        name: ship.name,
        classLabel: humanizeId(ship.classId),
        cause: ship.cause === null ? null : (CAUSE_LABELS[ship.cause] ?? ship.cause),
        month: ship.month,
        areaName: battle.areaName,
        sequence: battle.sequence,
      });
    });
  }
  return rows
    .sort((a, b) => (a.month < b.month ? 1 : a.month > b.month ? -1 : b.sequence - a.sequence))
    .map(({ sequence: _sequence, ...row }) => row);
}

export type PlayerLossesView =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "ready"; readonly rows: readonly LossRow[] };

export type LossesInput =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "ready"; readonly history: BattleHistoryView };

export function playerLossesView(state: LossesInput): PlayerLossesView {
  if (state.status === "loading") return { status: "loading" };
  if (state.status === "error") return { status: "error", message: state.message };
  return { status: "ready", rows: playerLossRows(state.history.battles) };
}

export interface OfficerRow {
  readonly divisionId: string;
  readonly divisionLabel: string;
  readonly officer: string | null;
  readonly rankLabel: string | null;
  readonly skill: number | null;
}

export function officerRows(divisions: readonly DivisionView[]): readonly OfficerRow[] {
  return divisions.map((division) => ({
    divisionId: division.divisionId,
    divisionLabel: division.flagshipName,
    officer: division.commander?.name ?? null,
    rankLabel: division.commander === undefined ? null : humanizeId(division.commander.rank),
    skill: division.commander?.skill ?? null,
  }));
}

export const DEFERRED_FLEET_ITEMS: readonly DeferredFeature[] = [
  ...DEFERRED_SUBMARINE_ITEMS,
  {
    id: "air-groups",
    name: "Air groups",
    reason: "Naval aircraft exist only in tactical combat; the campaign has no air-group state.",
  },
  {
    id: "aircraft-types",
    name: "Aircraft types",
    reason: "There is no campaign-level aircraft roster or content for 1880.",
  },
  {
    id: "fleet-exercise",
    name: "Fleet exercise",
    reason: "No training mechanic or command exists in the engine yet.",
  },
  {
    id: "ship-scrapping",
    name: "Scrapped ships",
    reason: "The engine records ships sunk in battle, but has no scrapping command or record.",
  },
];
