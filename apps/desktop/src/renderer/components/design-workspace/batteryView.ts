import {
  batterySummary,
  mountNames,
  type BatteryRow,
  type DesignDraft,
  type DraftEdit,
  type MountSide,
  type PartCatalogueEntry,
  type WorkshopView,
} from "@bluewave/ship-design";
import { formatCalibreInches } from "../../lib/presentation-format/index.js";

export interface BatteryMount {
  readonly instanceId: string;
  readonly name: string;
  readonly side: MountSide;
  readonly stationPermille: number;
  readonly componentId: string;
}

export interface BatteryCard {
  readonly row: BatteryRow;
  readonly title: string;
  readonly mounts: readonly BatteryMount[];
}

const ROLE_TITLE = {
  MAIN: "Main battery",
  SECONDARY: "Secondary battery",
  TERTIARY: "Tertiary battery",
  TORPEDO: "Torpedo tubes",
} as const;

export function batteryTitle(row: BatteryRow): string {
  return row.role === "TORPEDO"
    ? ROLE_TITLE.TORPEDO
    : `${ROLE_TITLE[row.role]}, ${formatCalibreInches(row.caliberUm)}`;
}

export function batteryCards(view: WorkshopView, draft: DesignDraft): BatteryCard[] {
  const placed = new Map(draft.placements.map((p) => [p.instanceId, p]));
  return batterySummary(view.compiled.components, draft.placements).map((row) => {
    const placements = row.instanceIds.flatMap((id) => {
      const p = placed.get(id);
      return p ? [p] : [];
    });
    const names = mountNames(placements);
    return {
      row,
      title: batteryTitle(row),
      mounts: placements.map((p) => ({
        instanceId: p.instanceId,
        name: names.get(p.instanceId) ?? p.instanceId,
        side: p.side ?? "CENTRE",
        stationPermille: p.stationPermille,
        componentId: p.componentId,
      })),
    };
  });
}

export function batterySymmetry(card: {
  readonly mounts: readonly { readonly side: MountSide; readonly componentId: string }[];
}): "symmetric" | "asymmetric" | null {
  const wing = (side: "PORT" | "STBD") =>
    card.mounts
      .filter((m) => m.side === side)
      .map((m) => m.componentId)
      .sort()
      .join("|");
  if (!card.mounts.some((m) => m.side === "PORT" || m.side === "STBD")) return null;
  return wing("PORT") === wing("STBD") ? "symmetric" : "asymmetric";
}

export function mountNameMap(cards: readonly BatteryCard[]): Map<string, string> {
  return new Map(
    cards.flatMap((c) => c.mounts.map((m): [string, string] => [m.instanceId, m.name])),
  );
}

export function clearBatteryEdit(row: BatteryRow): DraftEdit | null {
  return row.instanceIds.length === 0
    ? null
    : {
        kind: "batch",
        edits: row.instanceIds.map((instanceId) => ({ kind: "remove_placement", instanceId })),
      };
}

export function setRoundsEdit(
  row: BatteryRow,
  rounds: number,
  draft: DesignDraft,
  entryOf: (componentId: string) => PartCatalogueEntry | undefined,
): DraftEdit | null {
  const edits = row.instanceIds.flatMap((instanceId) => {
    const p = draft.placements.find((x) => x.instanceId === instanceId);
    const range = p ? entryOf(p.componentId)?.parameters?.rounds : undefined;
    if (!p || !range) return [];
    const value = Math.min(range.max, Math.max(range.min, Math.round(rounds)));
    return (p.params?.rounds ?? range.min) === value
      ? []
      : [{ kind: "set_param" as const, instanceId, param: "rounds", value }];
  });
  return edits.length === 0 ? null : { kind: "batch", edits };
}
