import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import {
  deriveShipConditions,
  SHIP_CONDITIONS,
  type Ship,
  type ShipCondition,
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

interface Row {
  readonly name: string;
  readonly ship: Ship;
  readonly expected: readonly ShipCondition[];
}

const ROWS: readonly Row[] = [
  { name: "a fit active ship has none", ship: ship(), expected: [] },
  {
    name: "crew below the active ceiling is understrength",
    ship: ship({ crewQuality: SafeInt(95) }),
    expected: ["UnderStrength"],
  },
  {
    name: "a reserve ship at its own ceiling is not understrength",
    ship: ship({ readiness: "RESERVE", crewQuality: SafeInt(70) }),
    expected: [],
  },
  {
    name: "a mothballed ship below its ceiling is understrength",
    ship: ship({ readiness: "MOTHBALLED", crewQuality: SafeInt(10) }),
    expected: ["UnderStrength"],
  },
  {
    name: "a ship above its state's ceiling is not understrength",
    ship: ship({ readiness: "MOTHBALLED", crewQuality: SafeInt(100) }),
    expected: [],
  },
  {
    name: "lost hit points are damage",
    ship: ship({ hitPoints: SafeInt(9) }),
    expected: ["Damaged"],
  },
  {
    name: "degraded availability is damage",
    ship: ship({ availability: "DEGRADED" }),
    expected: ["Damaged"],
  },
  {
    name: "a foreign station is detached",
    ship: ship({ stationAssignment: "FOREIGN_STATION" }),
    expected: ["Detached"],
  },
  {
    name: "an exercise is not a detachment",
    ship: ship({ stationAssignment: "EXERCISE" }),
    expected: [],
  },
  {
    name: "unavailable is out of action",
    ship: ship({ availability: "UNAVAILABLE" }),
    expected: ["OutOfAction"],
  },
  {
    name: "repair is out of action",
    ship: ship({ readiness: "REPAIR", repairMonthsRemaining: SafeInt(3) }),
    expected: ["OutOfAction"],
  },
  {
    name: "repair and a yard project read the same",
    ship: ship({ readiness: "REPAIR", availability: "UNAVAILABLE" }),
    expected: ["OutOfAction"],
  },
  {
    name: "conditions combine in a fixed order",
    ship: ship({
      readiness: "REPAIR",
      hitPoints: SafeInt(2),
      crewQuality: SafeInt(40),
      stationAssignment: "FOREIGN_STATION",
    }),
    expected: ["UnderStrength", "Detached", "Damaged", "OutOfAction"],
  },
  {
    name: "a hull under construction has no conditions",
    ship: ship({
      isUnderConstruction: true,
      readiness: "WORKING_UP",
      crewQuality: SafeInt(0),
      hitPoints: SafeInt(0),
    }),
    expected: [],
  },
];

describe("derived ship conditions", () => {
  it.each(ROWS)("$name", ({ ship: subject, expected }) => {
    expect(deriveShipConditions(subject)).toEqual(expected);
  });

  it("only ever returns conditions from the closed list, in list order", () => {
    for (const row of ROWS) {
      const derived = deriveShipConditions(row.ship);
      const positions = derived.map((condition) => SHIP_CONDITIONS.indexOf(condition));
      expect(positions.every((index) => index >= 0)).toBe(true);
      expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    }
  });

  it("does not read or change the primary lifecycle", () => {
    const subject = ship({ readiness: "WORKING_UP", crewQuality: SafeInt(10) });
    const before = JSON.stringify(subject);
    deriveShipConditions(subject);
    expect(JSON.stringify(subject)).toBe(before);
  });
});
