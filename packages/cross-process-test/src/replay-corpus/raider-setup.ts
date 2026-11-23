import type { CampaignSnapshot, NationState, Ship } from "@bluewave/campaign";

type Fleet = NationState["fleets"][number];

const RAIDER_NATION = "austria_hungary";
const RAIDER_SHIP = "aut_custoza";
const PATROL_NATION = "italy";
const PATROL_SHIP = "ita_duilio";
const CRUISER_DESIGN = "des_iw_japan_myoko";

function retype(
  snapshot: CampaignSnapshot,
  nationId: string,
  shipId: string,
  change: (ship: Ship) => Ship,
  place: (fleet: Fleet) => Fleet,
): Map<string, NationState> {
  const nations = new Map(snapshot.nations);
  const nation = nations.get(nationId);
  if (nation === undefined) return nations;
  nations.set(nationId, {
    ...nation,
    fleets: nation.fleets.map((fleet) =>
      fleet.ships.some((ship) => ship.id === shipId)
        ? place({
            ...fleet,
            ships: fleet.ships.map((ship) => (ship.id === shipId ? change(ship) : ship)),
          })
        : fleet,
    ),
  });
  return nations;
}

export function raiderInterception(snapshot: CampaignSnapshot): CampaignSnapshot {
  const patrolFleet = snapshot.nations
    .get(PATROL_NATION)
    ?.fleets.find((fleet) => fleet.ships.some((ship) => ship.id === PATROL_SHIP));
  if (patrolFleet === undefined) return snapshot;
  const area = patrolFleet.locationAreaId;
  const withRaider = {
    ...snapshot,
    nations: retype(
      snapshot,
      RAIDER_NATION,
      RAIDER_SHIP,
      (ship) => ({
        ...ship,
        designVersionId: CRUISER_DESIGN,
        stationAssignment: "RAIDER",
        locationAreaId: area,
      }),
      (fleet) => ({ ...fleet, locationAreaId: area }),
    ),
  };
  return {
    ...withRaider,
    nations: retype(
      withRaider,
      PATROL_NATION,
      PATROL_SHIP,
      (ship) => ({
        ...ship,
        designVersionId: CRUISER_DESIGN,
        stationAssignment: "TRADE_PROTECTION",
      }),
      (fleet) => fleet,
    ),
  };
}
