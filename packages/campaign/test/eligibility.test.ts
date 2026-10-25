import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import {
  evaluateShipGates,
  GATE_REASON_TAGS,
  isShipEligible,
  SHIP_USES,
  type GateReasonTag,
  type Ship,
  type ShipUse,
} from "../src/index.js";

function ship(over: Partial<Ship> = {}): Ship {
  return {
    id: "s",
    name: "s",
    classId: "c",
    nationId: "uk",
    locationAreaId: "lon",
    designVersionId: "d",
    hitPoints: SafeInt(10),
    maxHitPoints: SafeInt(10),
    speed: SafeInt(1),
    firepower: SafeInt(1),
    armor: SafeInt(1),
    isUnderConstruction: false,
    constructionProgress: SafeInt(0),
    constructionTotalWork: SafeInt(0),
    readiness: "ACTIVE",
    crewQuality: SafeInt(100),
    ...over,
  };
}

const tags = (s: Ship, use: ShipUse): GateReasonTag[] =>
  evaluateShipGates(s, use).map((reason) => reason._tag);

interface Row {
  readonly name: string;
  readonly ship: Ship;
  readonly expected: Record<ShipUse, GateReasonTag[]>;
}

const rows: Row[] = [
  {
    name: "an active unassigned ship",
    ship: ship(),
    expected: { SAIL: [], ENTER_BATTLE: [], HOLD_STATION: [], TAKE_MISSION: [] },
  },
  {
    name: "a hull under construction in work-up",
    ship: ship({ isUnderConstruction: true, readiness: "WORKING_UP" }),
    expected: {
      SAIL: ["UnderConstruction"],
      ENTER_BATTLE: ["UnderConstruction", "WorkingUp"],
      HOLD_STATION: ["UnderConstruction", "WorkingUp"],
      TAKE_MISSION: ["UnderConstruction", "WorkingUp"],
    },
  },
  {
    name: "a ship under rebuild",
    ship: ship({ availability: "UNAVAILABLE" }),
    expected: {
      SAIL: ["Unavailable"],
      ENTER_BATTLE: ["Unavailable"],
      HOLD_STATION: ["Unavailable"],
      TAKE_MISSION: ["Unavailable"],
    },
  },
  {
    name: "a ship under repair and rebuild",
    ship: ship({ readiness: "REPAIR", availability: "UNAVAILABLE" }),
    expected: {
      SAIL: ["Unavailable"],
      ENTER_BATTLE: ["Unavailable", "InRepair"],
      HOLD_STATION: ["Unavailable", "InRepair"],
      TAKE_MISSION: ["Unavailable", "InRepair"],
    },
  },
  {
    name: "a reserve ship",
    ship: ship({ readiness: "RESERVE" }),
    expected: {
      SAIL: [],
      ENTER_BATTLE: ["InReserve"],
      HOLD_STATION: ["InReserve"],
      TAKE_MISSION: ["InReserve"],
    },
  },
  {
    name: "a mothballed ship",
    ship: ship({ readiness: "MOTHBALLED" }),
    expected: {
      SAIL: [],
      ENTER_BATTLE: ["Mothballed"],
      HOLD_STATION: ["Mothballed"],
      TAKE_MISSION: ["Mothballed"],
    },
  },
  {
    name: "a ship reserved for a battle",
    ship: ship({ inBattleId: "b1" }),
    expected: {
      SAIL: [],
      ENTER_BATTLE: ["InBattle"],
      HOLD_STATION: [],
      TAKE_MISSION: ["InBattle"],
    },
  },
  {
    name: "a ship on foreign station",
    ship: ship({ stationAssignment: "FOREIGN_STATION" }),
    expected: {
      SAIL: ["AssignmentForbidsUse"],
      ENTER_BATTLE: [],
      HOLD_STATION: ["Assigned"],
      TAKE_MISSION: ["Assigned"],
    },
  },
];

describe("evaluateShipGates", () => {
  for (const row of rows) {
    for (const use of SHIP_USES) {
      it(`${row.name} for ${use}`, () => {
        expect(tags(row.ship, use)).toEqual(row.expected[use]);
        expect(isShipEligible(row.ship, use)).toBe(row.expected[use].length === 0);
      });
    }
  }

  it("keeps every emitted tag inside the closed enum", () => {
    for (const row of rows) {
      for (const use of SHIP_USES) {
        for (const tag of tags(row.ship, use)) expect(GATE_REASON_TAGS).toContain(tag);
      }
    }
  });
});
