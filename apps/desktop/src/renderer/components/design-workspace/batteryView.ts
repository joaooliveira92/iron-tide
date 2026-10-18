import {
  batterySummary,
  mountNames,
  UM_PER_INCH,
  type BatteryRow,
  type DesignDraft,
  type DraftEdit,
  type MountSide,
  type PartCatalogueEntry,
  type WorkshopView,
} from "@bluewave/ship-design";

export interface BatteryMount {
  readonly instanceId: string;
  /** Conventional name: A, B, X, Y for centreline mounts; "Port 1" for wings. */
  readonly name: string;
  readonly side: MountSide;
  readonly stationPermille: number;
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

/** Battery heading: role and calibre in inches, e.g. "Main battery, 12.0-inch". Tubes have no calibre. */
export function batteryTitle(row: BatteryRow): string {
  return row.role === "TORPEDO"
    ? ROLE_TITLE.TORPEDO
    : `${ROLE_TITLE[row.role]}, ${(row.caliberUm / UM_PER_INCH).toFixed(1)}-inch`;
}

/** The design's batteries with each mount named by the naval convention. Pure: reads only the compiled view and the draft. */
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
      })),
    };
  });
}

/** instanceId -> mount name across every battery, for labelling rows and drawings. */
export function mountNameMap(cards: readonly BatteryCard[]): Map<string, string> {
  return new Map(
    cards.flatMap((c) => c.mounts.map((m): [string, string] => [m.instanceId, m.name])),
  );
}

/** Removes every mount of the battery as one undoable edit; null for an empty battery. */
export function clearBatteryEdit(row: BatteryRow): DraftEdit | null {
  return row.instanceIds.length === 0
    ? null
    : {
        kind: "batch",
        edits: row.instanceIds.map((instanceId) => ({ kind: "remove_placement", instanceId })),
      };
}

/**
 * Sets rounds per gun on every mount of the battery as one undoable edit, clamping each mount to its own allowed range
 * (`entryOf` resolves an instance to its catalogue entry). Mounts with no `rounds` parameter are left alone; null when nothing changes.
 */
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
