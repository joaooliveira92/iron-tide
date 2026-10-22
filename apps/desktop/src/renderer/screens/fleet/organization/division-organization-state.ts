import type {
  DivisionPenalty,
  DivisionScreenView,
  DivisionView,
  UnassignedShipView,
} from "@bluewave/campaign-engine";
import type {
  DivisionCommandOutcome,
  DivisionScreenProjection,
} from "../../../../shared/division-contract.js";
import type { RequestLifecycle } from "../../../lib/command-screen-workflow.js";
import { humanizeId } from "../../../lib/humanize-id.js";

export interface DivisionOrganizationState extends RequestLifecycle {
  readonly divisions: readonly DivisionView[];
  readonly unassignedShips: readonly UnassignedShipView[];
  readonly roles: readonly string[];
  readonly formations: readonly string[];
  readonly maxShips: number;
  readonly initial: DivisionPenalty;
  readonly penalties: DivisionScreenView["penalties"];
}

export function initialDivisionOrganizationState(): DivisionOrganizationState {
  return {
    revision: 0,
    divisions: [],
    unassignedShips: [],
    roles: [],
    formations: [],
    maxShips: 5,
    initial: { experience: 0, cohesion: 0 },
    penalties: {
      addShip: { experience: 0, cohesion: 0 },
      removeShip: { experience: 0, cohesion: 0 },
      changeFlagship: { experience: 0, cohesion: 0 },
      reorder: { experience: 0, cohesion: 0 },
    },
    pendingRequest: null,
    requiresRefresh: false,
    notice: null,
  };
}

export function projectDivisionOrganization(
  projection: DivisionScreenProjection,
): Partial<DivisionOrganizationState> {
  return {
    divisions: projection.divisions,
    unassignedShips: projection.unassignedShips,
    roles: projection.roles,
    formations: projection.formations,
    maxShips: projection.maxShips,
    initial: projection.initial,
    penalties: projection.penalties,
  };
}

const COMMAND_LABELS: Record<DivisionCommandOutcome["bodyType"], string> = {
  CreateDivision: "Create division",
  AddShipToDivision: "Add ship",
  RemoveShipFromDivision: "Remove ship",
  ChangeDivisionFlagship: "Change flagship",
  ReorderDivisionShips: "Reorder ships",
  DissolveDivision: "Dissolve division",
};

export function acceptDivisionCommand(value: DivisionCommandOutcome): {
  readonly patch: Partial<DivisionOrganizationState>;
  readonly notice: string;
} {
  return {
    patch: {},
    notice: `${COMMAND_LABELS[value.bodyType]} queued. The engine applies it when you advance the month.`,
  };
}

export function roleLabel(role: string): string {
  return humanizeId(role);
}

export function formationLabel(formation: string): string {
  return humanizeId(formation);
}

export function divisionTitle(division: Pick<DivisionView, "role" | "flagshipName">): string {
  return `${roleLabel(division.role)} division — ${division.flagshipName}`;
}

export function shipsAvailableToAdd(
  division: Pick<DivisionView, "areaId" | "ships">,
  unassigned: readonly UnassignedShipView[],
  maxShips: number,
): readonly UnassignedShipView[] {
  if (division.ships.length >= maxShips) return [];
  return unassigned.filter((ship) => ship.areaId === division.areaId);
}

export interface AreaGroup {
  readonly areaId: string;
  readonly areaName: string;
  readonly ships: readonly UnassignedShipView[];
}

export function groupUnassignedByArea(unassigned: readonly UnassignedShipView[]): AreaGroup[] {
  const groups = new Map<string, { areaName: string; ships: UnassignedShipView[] }>();
  for (const ship of unassigned) {
    const group = groups.get(ship.areaId) ?? { areaName: ship.areaName, ships: [] };
    group.ships.push(ship);
    groups.set(ship.areaId, group);
  }
  return [...groups.entries()]
    .map(([areaId, group]) => ({ areaId, areaName: group.areaName, ships: group.ships }))
    .sort((a, b) => a.areaName.localeCompare(b.areaName));
}

export function costText(cost: DivisionPenalty): string {
  const parts: string[] = [];
  if (cost.experience > 0) parts.push(`${cost.experience} experience`);
  if (cost.cohesion > 0) parts.push(`${cost.cohesion} cohesion`);
  return parts.length === 0 ? "is free" : `costs ${parts.join(" and ")}`;
}

export function canRemoveShip(division: Pick<DivisionView, "ships">): boolean {
  return division.ships.length > 1;
}
