import { describe, expect, it } from "vite-plus/test";
import { FLEET_MOVE_MESSAGES } from "./fleet-move-messages.js";

const MOVE_PROBLEM_TAGS = [
  "UnknownNation",
  "FleetNotOwned",
  "ForeignStationPosted",
  "NoCommissionedShip",
  "ShipUnderRebuild",
  "UnknownArea",
  "LandArea",
  "AlreadyThere",
  "NoSeaRoute",
] as const;

const BLOCKED_CODES = [
  "FOREIGN_STATION_ASSIGNED",
  "SHIP_NOT_OPERATIONAL",
  "SHIP_UNAVAILABLE",
] as const;

describe("fleet move messages", () => {
  it("has a catalogue entry for every movement problem tag", () => {
    for (const tag of MOVE_PROBLEM_TAGS) {
      expect(FLEET_MOVE_MESSAGES).toHaveProperty([`fleet.move.reason.${tag}`]);
    }
  });

  it("has a catalogue entry for every fleet-level blocked code", () => {
    for (const code of BLOCKED_CODES) {
      expect(FLEET_MOVE_MESSAGES).toHaveProperty([`fleet.move.blocked.${code}`]);
    }
  });
});
