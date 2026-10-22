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

export interface DivisionShipView {
  readonly shipId: string;
  readonly name: string;
}

export interface UnassignedShipView extends DivisionShipView {
  readonly classId: string;
  readonly areaId: string;
  readonly areaName: string;
}

export interface DivisionCommanderView {
  readonly officerId: string;
  readonly name: string;
  readonly rank: string;
  readonly skill: number;
}

export interface DivisionView {
  readonly divisionId: string;
  readonly role: string;
  readonly formation: string;
  readonly flagshipShipId: string;
  readonly flagshipName: string;
  readonly commanderVacant: boolean;
  readonly commander?: DivisionCommanderView;
  readonly experience: number;
  readonly cohesion: number;
  readonly areaId: string;
  readonly areaName: string;
  readonly ships: readonly DivisionShipView[];
}

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
  readonly initial: DivisionPenalty;
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
