export const FLEET_MOVE_MESSAGES = {
  "fleet.move.blocked.FOREIGN_STATION_ASSIGNED":
    "{fleet} has a ship on foreign station. Clear its assignment before ordering the fleet to move.",
  "fleet.move.blocked.SHIP_NOT_OPERATIONAL": "{fleet} has no commissioned ship.",
  "fleet.move.blocked.SHIP_UNAVAILABLE":
    "{fleet} has a ship under rebuild and cannot sail with it.",
  "fleet.move.reason.UnknownNation": "That nation does not exist.",
  "fleet.move.reason.FleetNotOwned": "That fleet is not under your command.",
  "fleet.move.reason.ForeignStationPosted":
    "A ship on foreign station is routed by the month; clear its assignment first.",
  "fleet.move.reason.NoCommissionedShip": "No commissioned ship can sail.",
  "fleet.move.reason.ShipUnderRebuild": "A ship under rebuild cannot sail.",
  "fleet.move.reason.UnknownArea": "That area does not exist.",
  "fleet.move.reason.LandArea": "That area is land; ships cannot sail there.",
  "fleet.move.reason.AlreadyThere": "The ships are already in that area.",
  "fleet.move.reason.NoSeaRoute": "No sea route leads from the ships' area to that area.",
  "fleet.move.reason.ShipNotInFleet": "That ship is not in the fleet being ordered.",
} as const;
