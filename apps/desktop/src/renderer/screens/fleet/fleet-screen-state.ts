import type { DeferredFeature } from "../../components/shared/DeferredFeaturesPanel.js";
import type { MovementCommand } from "@bluewave/campaign-engine";
import type {
  FleetDivisionView,
  FleetScreenProjection,
  MovementCommandOutcome,
} from "../../../shared/fleet-contract.js";
import type { RequestLifecycle } from "../../lib/command-screen-workflow.js";

/**
 * Presentation state for the fleet movement screen. Divisions, geography, and
 * commands are copied from engine responses — the screen never decides whether
 * a route is adjacent, accessible, or otherwise legal.
 */
export interface FleetScreenState extends RequestLifecycle {
  readonly month: FleetScreenProjection["month"] | null;
  readonly playerNationId: string | null;
  readonly divisions: FleetScreenProjection["divisions"];
  readonly areas: FleetScreenProjection["areas"];
  readonly areaEdges: FleetScreenProjection["areaEdges"];
  readonly ports: FleetScreenProjection["ports"];
  readonly movementCommands: readonly MovementCommand[];
}

export function initialFleetScreenState(): FleetScreenState {
  return {
    revision: 0,
    month: null,
    playerNationId: null,
    divisions: [],
    areas: [],
    areaEdges: [],
    ports: [],
    movementCommands: [],
    pendingRequest: null,
    requiresRefresh: false,
    notice: null,
  };
}

/**
 * Map a fleet projection's domain fields into the state. The command screen
 * module owns the lifecycle fields (revision, pending, refresh, notice).
 */
export function projectFleetScreen(projection: FleetScreenProjection): Partial<FleetScreenState> {
  return {
    month: projection.month,
    playerNationId: projection.playerNationId,
    divisions: projection.divisions,
    areas: projection.areas,
    areaEdges: projection.areaEdges,
    ports: projection.ports,
    movementCommands: projection.movementCommands,
  };
}

/**
 * The route the engine currently holds for a division, if any. A superseded or
 * cancelled command stays in the workspace for audit but is no longer pending.
 */
export function pendingRouteFor(
  movementCommands: readonly MovementCommand[],
  divisionId: string,
): MovementCommand | null {
  return (
    movementCommands.find(
      (command) => command.divisionId === divisionId && command.status === "submitted",
    ) ?? null
  );
}

/**
 * The selection to carry into a fresh projection: keep the current division while it still
 * exists, otherwise fall back to the first one (or none). Stops a refresh that drops a
 * division from leaving a dangling selection behind.
 */
export function nextDivisionSelection(
  current: string | null,
  divisions: readonly FleetDivisionView[],
): string | null {
  if (current !== null && divisions.some((division) => division.divisionId === current)) {
    return current;
  }
  return divisions[0]?.divisionId ?? null;
}

export function acceptMovementCommand(value: MovementCommandOutcome): {
  readonly patch: Partial<FleetScreenState>;
  readonly notice: string;
} {
  return {
    patch: { movementCommands: value.workspace.movementCommands },
    notice:
      value.command.status === "cancelled"
        ? "Order cancelled."
        : "Order queued. The fleet sails when you advance the month.",
  };
}

/**
 * RTW3 submarine items the engine cannot supply yet (docs/research/
 * rtw3-intel-and-submarines-engine-surface.md). The 1880 content has no
 * submarine hulls at all, so an empty roster would be correct for this era.
 */
export const DEFERRED_SUBMARINE_ITEMS: readonly DeferredFeature[] = [
  {
    id: "submarine-roster",
    name: "Submarine roster",
    reason: "The fleet view does not carry hull types, and 1880 content has no submarine designs.",
  },
  {
    id: "submarine-auto-build",
    name: "Auto-build submarines",
    reason: "There is no campaign setting or command for it yet.",
  },
];

export interface AreaOverviewRow {
  readonly areaId: string;
  readonly name: string;
  /** Names of the player's ports in this area. */
  readonly ports: readonly string[];
  /** Names of the player's divisions (fleets) currently in this area. */
  readonly divisions: readonly string[];
  /** Areas reachable in one hop, by name. */
  readonly neighbours: readonly string[];
}

/**
 * Area overview (RTW3 "Area overview"): per strategic area, what the player has
 * there and what it borders. Derived only from the Fleet screen's own data.
 */
export function buildAreaOverview(
  areas: readonly { readonly id: string; readonly name: string }[],
  areaEdges: readonly { readonly fromAreaId: string; readonly toAreaId: string }[],
  ports: readonly { readonly name: string; readonly areaId: string }[],
  divisions: readonly { readonly fleetName: string; readonly areaId: string }[],
): AreaOverviewRow[] {
  const nameOf = new Map(areas.map((area) => [area.id, area.name]));
  const neighbours = new Map<string, Set<string>>();
  for (const edge of areaEdges) {
    for (const [from, to] of [
      [edge.fromAreaId, edge.toAreaId],
      [edge.toAreaId, edge.fromAreaId],
    ] as const) {
      const set = neighbours.get(from) ?? new Set<string>();
      set.add(nameOf.get(to) ?? to);
      neighbours.set(from, set);
    }
  }
  const byName = (a: string, b: string) => a.localeCompare(b);
  return areas
    .map((area) => ({
      areaId: area.id,
      name: area.name,
      ports: ports
        .filter((port) => port.areaId === area.id)
        .map((port) => port.name)
        .sort(byName),
      divisions: divisions
        .filter((division) => division.areaId === area.id)
        .map((division) => division.fleetName)
        .sort(byName),
      neighbours: [...(neighbours.get(area.id) ?? [])].sort(byName),
    }))
    .sort((a, b) => byName(a.name, b.name));
}

export interface MovementCommandRow {
  readonly commandId: string;
  readonly divisionName: string;
  readonly fromName: string;
  readonly toName: string;
  readonly status: MovementCommand["status"];
  readonly submittedAtRevision: number;
}

/**
 * Resolve a movement command's ids to display names for the table. Mirrors the
 * `playerLossRows`/`officerRows` projection convention: a pure function resolves, the
 * component renders. The caller's resolvers own the id fallback.
 */
export function movementCommandRows(
  commands: readonly MovementCommand[],
  nameOfArea: (areaId: string) => string,
  nameOfDivision: (divisionId: string) => string,
): MovementCommandRow[] {
  return commands.map((command) => ({
    commandId: command.commandId,
    divisionName: nameOfDivision(command.divisionId),
    fromName: nameOfArea(command.fromAreaId),
    toName: nameOfArea(command.toAreaId),
    status: command.status,
    submittedAtRevision: command.submittedAtRevision,
  }));
}

export interface DivisionPickerRow {
  readonly divisionId: string;
  readonly fleetName: string;
  readonly areaName: string;
  readonly ships: FleetDivisionView["ships"];
}

/** Resolve each division's area to a display name for the division picker. */
export function divisionPickerRows(
  divisions: readonly FleetDivisionView[],
  nameOfArea: (areaId: string) => string,
): DivisionPickerRow[] {
  return divisions.map((division) => ({
    divisionId: division.divisionId,
    fleetName: division.fleetName,
    areaName: nameOfArea(division.areaId),
    ships: division.ships,
  }));
}

export interface OrderStatusView {
  /** Selected division's fleet name, or null when none is selected. */
  readonly divisionName: string | null;
  /** Where that division is, or null when none is selected. */
  readonly locationName: string | null;
  readonly routeFromName: string | null;
  readonly routeToName: string | null;
}

/**
 * Resolve the order panel's status line once: the selected division, where it is, and its
 * pending route (if any) as display names, so the summary component renders only strings.
 */
export function orderStatusView(
  selectedDivision: FleetDivisionView | null,
  pendingRoute: MovementCommand | null,
  nameOfArea: (areaId: string) => string,
): OrderStatusView {
  if (selectedDivision === null) {
    return { divisionName: null, locationName: null, routeFromName: null, routeToName: null };
  }
  return {
    divisionName: selectedDivision.fleetName,
    locationName: nameOfArea(selectedDivision.areaId),
    routeFromName: pendingRoute === null ? null : nameOfArea(pendingRoute.fromAreaId),
    routeToName: pendingRoute === null ? null : nameOfArea(pendingRoute.toAreaId),
  };
}

/**
 * Areas a division can be ordered to: those one route hop from where it is (routes are
 * two-way). The engine's `MoveFleet` validator still decides each order; this only keeps
 * the picker to destinations that can pass it.
 */
export function reachableAreas(
  areas: readonly { readonly id: string; readonly name: string }[],
  areaEdges: readonly { readonly fromAreaId: string; readonly toAreaId: string }[],
  fromAreaId: string,
): { readonly id: string; readonly name: string }[] {
  const next = new Set<string>();
  for (const edge of areaEdges) {
    if (edge.fromAreaId === fromAreaId) next.add(edge.toAreaId);
    if (edge.toAreaId === fromAreaId) next.add(edge.fromAreaId);
  }
  return areas
    .filter((area) => next.has(area.id))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
}
