import type {
  DesignDraft,
  DraftEdit,
  PartCatalogueEntry,
  PlacementSpec,
  ZoneId,
} from "@bluewave/ship-design";
import { zoneAtStation, type PlanTarget, type ZoneSpan } from "./plan-targeting.js";

export const NUDGE_PERMILLE = { step: 10, large: 50 } as const;

export type PlanEdit =
  | { readonly ok: true; readonly edit: DraftEdit }
  | { readonly ok: false; readonly reason: string };

const SIDED_CATEGORIES: readonly string[] = [
  "MAIN_GUN",
  "SECONDARY_GUN",
  "DUAL_PURPOSE_GUN",
  "TORPEDO_TUBE",
];
export const hasSide = (entry: PartCatalogueEntry | undefined): boolean =>
  entry !== undefined && SIDED_CATEGORIES.includes(entry.category);

const words = (s: string) => s.replaceAll("_", " ").toLowerCase();
const refuse = (reason: string): PlanEdit => ({ ok: false, reason });

function zoneProblem(entry: PartCatalogueEntry | undefined, zoneId: ZoneId | null): string | null {
  if (zoneId === null) return "There is no zone at that point.";
  const allowed = entry?.allowedZones;
  if (allowed !== undefined && !allowed.includes(zoneId))
    return `${entry?.displayName ?? "That fitting"} cannot go in the ${words(zoneId)} zone.`;
  return null;
}

export function nextInstanceId(
  draft: Pick<DesignDraft, "placements">,
  componentId: string,
): string {
  let n = 1;
  while (draft.placements.some((p) => p.instanceId === `${componentId}_${n}`)) n++;
  return `${componentId}_${n}`;
}

export function placeEdit(
  entry: PartCatalogueEntry,
  target: PlanTarget,
  draft: Pick<DesignDraft, "placements">,
): PlanEdit {
  const problem = zoneProblem(entry, target.zoneId);
  if (problem !== null || target.zoneId === null)
    return refuse(problem ?? "There is no zone at that point.");
  return {
    ok: true,
    edit: {
      kind: "add_placement",
      placement: {
        instanceId: nextInstanceId(draft, entry.id),
        componentId: entry.id,
        zoneId: target.zoneId,
        stationPermille: target.stationPermille,
        ...(hasSide(entry) ? { side: target.side } : {}),
      },
    },
  };
}

export function moveEdit(
  placement: PlacementSpec,
  entry: PartCatalogueEntry | undefined,
  target: PlanTarget,
): PlanEdit {
  const problem = zoneProblem(entry, target.zoneId);
  if (problem !== null || target.zoneId === null)
    return refuse(problem ?? "There is no zone at that point.");
  const move: DraftEdit = {
    kind: "move_placement",
    instanceId: placement.instanceId,
    zoneId: target.zoneId,
    stationPermille: target.stationPermille,
  };
  const sideChanged = hasSide(entry) && (placement.side ?? "CENTRE") !== target.side;
  return {
    ok: true,
    edit: sideChanged
      ? {
          kind: "batch",
          edits: [move, { kind: "set_side", instanceId: placement.instanceId, side: target.side }],
        }
      : move,
  };
}

export function nudgeEdit(
  placement: PlacementSpec,
  entry: PartCatalogueEntry | undefined,
  zones: readonly ZoneSpan[],
  deltaPermille: number,
): PlanEdit {
  const station = Math.min(1000, Math.max(0, placement.stationPermille + deltaPermille));
  if (station === placement.stationPermille)
    return refuse("The fitting is already at the end of the hull.");
  const zoneId = zoneAtStation(zones, station);
  const problem = zoneProblem(entry, zoneId);
  if (problem !== null || zoneId === null)
    return refuse(problem ?? "There is no zone at that point.");
  return {
    ok: true,
    edit: {
      kind: "move_placement",
      instanceId: placement.instanceId,
      zoneId,
      stationPermille: station,
    },
  };
}
