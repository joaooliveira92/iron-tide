import {
  DD_DIVISION_MAX_SHIPS,
  DIVISION_FORMATIONS,
  DIVISION_PENALTIES,
  INITIAL_DIVISION_COHESION,
  INITIAL_DIVISION_EXPERIENCE,
  DIVISION_MAX_SHIPS,
  DIVISION_ROLES,
  isShipOperational,
  VACANT,
  type CampaignSnapshot,
} from "@bluewave/campaign";

/**
 * The Fleet-organization (division editor) view: the player's permanent
 * divisions with ship names, and the finished ships not yet assigned to one.
 * A pure, deterministic derivation over the immutable snapshot (same contract as
 * `buildWorldMapView`), flat plain objects only — it crosses the IPC boundary.
 *
 * The engine is the authority on what is legal (ship-type compatibility, size
 * limits, same-location rule): this view exposes the vocabulary and limits and
 * the desktop lets the engine's own validator give the verdict.
 */

export interface DivisionShipView {
  readonly shipId: string;
  readonly name: string;
}

export interface UnassignedShipView extends DivisionShipView {
  readonly classId: string;
  readonly areaId: string;
  readonly areaName: string;
}

/** The officer commanding a division (ADR-0065). */
export interface DivisionCommanderView {
  readonly officerId: string;
  readonly name: string;
  readonly rank: string;
  /** Command rating, 30..90. */
  readonly skill: number;
}

export interface DivisionView {
  readonly divisionId: string;
  readonly role: string;
  readonly formation: string;
  readonly flagshipShipId: string;
  readonly flagshipName: string;
  /** True while no officer commands the division (ADR-0065). */
  readonly commanderVacant: boolean;
  /** The commanding officer; absent while vacant (or if the officer is missing from the corps). */
  readonly commander?: DivisionCommanderView;
  /** 0..100 */
  readonly experience: number;
  /** 0..100 */
  readonly cohesion: number;
  readonly areaId: string;
  readonly areaName: string;
  readonly ships: readonly DivisionShipView[];
}

/** What a reorganization costs a division (positive numbers; engine DESIGN-26 penalties). */
export interface DivisionPenalty {
  readonly experience: number;
  readonly cohesion: number;
}

export interface DivisionScreenView {
  readonly divisions: readonly DivisionView[];
  readonly unassignedShips: readonly UnassignedShipView[];
  readonly roles: readonly string[];
  readonly formations: readonly string[];
  readonly maxShips: number;
  readonly maxDestroyers: number;
  /** Experience and cohesion a brand-new division starts with. */
  readonly initial: DivisionPenalty;
  /** Costs, so the UI can state them before the player commits to a change. */
  readonly penalties: {
    readonly addShip: DivisionPenalty;
    readonly removeShip: DivisionPenalty;
    readonly changeFlagship: DivisionPenalty;
    readonly reorder: DivisionPenalty;
  };
}

const cost = (p: { readonly experience: number; readonly cohesion: number }): DivisionPenalty => ({
  experience: Math.abs(p.experience),
  cohesion: Math.abs(p.cohesion),
});

/**
 * Ids sort by code unit, never by locale: a deterministic view must order the same on every
 * machine, and `localeCompare` depends on the host's language settings.
 */
const byId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export function buildDivisionScreenView(
  snapshot: CampaignSnapshot,
  nationId: string,
): DivisionScreenView | null {
  const nation = snapshot.nations.get(nationId);
  if (nation === undefined) return null;

  const areaName = (id: string): string =>
    snapshot.world.areas.find((area) => area.id === id)?.name ?? id;

  const shipsById = new Map<string, { name: string; classId: string; areaId: string }>();
  for (const fleet of nation.fleets) {
    for (const ship of fleet.ships) {
      if (!isShipOperational(ship)) continue;
      shipsById.set(ship.id, {
        name: ship.name,
        classId: ship.classId,
        areaId: fleet.locationAreaId,
      });
    }
  }
  const nameOf = (id: string): string => shipsById.get(id)?.name ?? id;

  const officersById = new Map((nation.officers ?? []).map((officer) => [officer.id, officer]));

  const divisions: DivisionView[] = [...nation.divisions]
    .sort((a, b) => byId(a.divisionId, b.divisionId))
    .map((division) => {
      const officer = officersById.get(division.commanderOfficerId);
      return {
        divisionId: division.divisionId,
        role: division.divisionRole,
        formation: division.preferredFormation,
        flagshipShipId: division.flagshipShipId,
        flagshipName: nameOf(division.flagshipShipId),
        commanderVacant: division.commanderOfficerId === VACANT,
        ...(officer === undefined
          ? {}
          : {
              commander: {
                officerId: officer.id,
                name: officer.name,
                rank: officer.rank,
                skill: Number(officer.skill),
              },
            }),
        experience: Number(division.experience),
        cohesion: Number(division.cohesion),
        areaId: division.locationAreaId,
        areaName: areaName(division.locationAreaId),
        ships: division.shipOrder.map((shipId) => ({ shipId, name: nameOf(shipId) })),
      };
    });

  const assigned = new Set(nation.divisions.flatMap((division) => division.shipOrder));
  const unassignedShips: UnassignedShipView[] = [...shipsById.entries()]
    .filter(([shipId]) => !assigned.has(shipId))
    .map(([shipId, info]) => ({
      shipId,
      name: info.name,
      classId: info.classId,
      areaId: info.areaId,
      areaName: areaName(info.areaId),
    }))
    .sort((a, b) => byId(a.areaId, b.areaId) || byId(a.shipId, b.shipId));

  return {
    divisions,
    unassignedShips,
    roles: DIVISION_ROLES,
    formations: DIVISION_FORMATIONS,
    maxShips: DIVISION_MAX_SHIPS,
    maxDestroyers: DD_DIVISION_MAX_SHIPS,
    initial: { experience: INITIAL_DIVISION_EXPERIENCE, cohesion: INITIAL_DIVISION_COHESION },
    penalties: {
      addShip: cost(DIVISION_PENALTIES.addShip),
      removeShip: cost(DIVISION_PENALTIES.removeNonFlagship),
      changeFlagship: cost(DIVISION_PENALTIES.flagshipChange),
      reorder: cost(DIVISION_PENALTIES.reorderWithoutFlagship),
    },
  };
}
