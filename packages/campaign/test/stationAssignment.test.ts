import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import type { Ship, ShipReadinessState } from "../src/index.js";
import {
  STATION_ASSIGNMENT_REASONS,
  setShipReadiness,
  stationAssignmentProblems,
  withStationAssignment,
} from "../src/stationAssignment.js";

function ship(id: string, over: Partial<Ship> = {}): Ship {
  return {
    id,
    name: id,
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

const nation = (ships: Ship[]) => ({ fleets: [{ ships }] });

describe("stationAssignmentProblems", () => {
  const ships = [
    ship("ok"),
    ship("foreign", { nationId: "fra" }),
    ship("building", { isUnderConstruction: true, readiness: "WORKING_UP" }),
    ship("rebuild", { availability: "UNAVAILABLE" }),
    ship("reserve", { readiness: "RESERVE" }),
    ship("workup", { readiness: "WORKING_UP" }),
    ship("assigned", { stationAssignment: "FOREIGN_STATION" }),
  ];
  const n = nation(ships);

  it("accepts eligible ships to assign and clear", () => {
    expect(stationAssignmentProblems(n, "uk", ["ok"], "assign")).toEqual([]);
    expect(stationAssignmentProblems(n, "uk", ["assigned"], "clear")).toEqual([]);
  });

  it("gives each ineligible ship one typed reason, sorted by ship id", () => {
    expect(
      stationAssignmentProblems(
        n,
        "uk",
        ["workup", "assigned", "reserve", "rebuild", "building", "foreign", "ghost"],
        "assign",
      ),
    ).toEqual([
      { shipId: "assigned", reason: "ALREADY_ASSIGNED" },
      { shipId: "building", reason: "UNDER_CONSTRUCTION" },
      { shipId: "foreign", reason: "NOT_OWNED" },
      { shipId: "ghost", reason: "NOT_OWNED" },
      { shipId: "rebuild", reason: "NOT_OPERATIONAL" },
      { shipId: "reserve", reason: "NOT_ACTIVE" },
      { shipId: "workup", reason: "NOT_ACTIVE" },
    ]);
  });

  it("rejects clearing a ship that is not assigned", () => {
    expect(stationAssignmentProblems(n, "uk", ["ok"], "clear")).toEqual([
      { shipId: "ok", reason: "NOT_ASSIGNED" },
    ]);
  });

  it("rejects an empty or duplicated batch", () => {
    expect(stationAssignmentProblems(n, "uk", [], "assign")).toEqual([
      { shipId: "", reason: "EMPTY_BATCH" },
    ]);
    expect(stationAssignmentProblems(n, "uk", ["ok", "ok"], "assign")).toEqual([
      { shipId: "ok", reason: "DUPLICATE_SHIP" },
    ]);
  });

  it("exports the reason vocabulary", () => {
    expect([...STATION_ASSIGNMENT_REASONS].sort()).toEqual(
      [
        "ALREADY_ASSIGNED",
        "DUPLICATE_SHIP",
        "EMPTY_BATCH",
        "NOT_ACTIVE",
        "NOT_ASSIGNED",
        "NOT_OPERATIONAL",
        "NOT_OWNED",
        "UNDER_CONSTRUCTION",
        "UNKNOWN_STATION",
      ].sort(),
    );
  });
});

describe("setShipReadiness", () => {
  it.each(["RESERVE", "MOTHBALLED", "REPAIR", "WORKING_UP"] as ShipReadinessState[])(
    "clears the assignment when leaving ACTIVE for %s",
    (to) => {
      const out = setShipReadiness(ship("a", { stationAssignment: "FOREIGN_STATION" }), to);
      expect(out.clearedAssignment).toBe(true);
      expect(out.ship.readiness).toBe(to);
      expect("stationAssignment" in out.ship).toBe(false);
    },
  );

  it("keeps the assignment when staying ACTIVE and reports nothing cleared without one", () => {
    const kept = setShipReadiness(ship("a", { stationAssignment: "FOREIGN_STATION" }), "ACTIVE");
    expect(kept.clearedAssignment).toBe(false);
    expect(kept.ship.stationAssignment).toBe("FOREIGN_STATION");
    const none = setShipReadiness(ship("b"), "RESERVE");
    expect(none.clearedAssignment).toBe(false);
  });
});

describe("named foreign station", () => {
  const stations = ["bombay", "cape"];
  const n = nation([
    ship("ok"),
    ship("any", { stationAssignment: "FOREIGN_STATION" }),
    ship("at-cape", { stationAssignment: "FOREIGN_STATION", stationAreaId: "cape" }),
    ship("exercise", { stationAssignment: "EXERCISE" }),
  ]);
  const named = (stationAreaId: string) => ({ stationAreaId, knownStationAreaIds: stations });

  it("accepts a known station and rejects an unknown one for the whole batch", () => {
    expect(stationAssignmentProblems(n, "uk", ["ok"], "assign", named("bombay"))).toEqual([]);
    expect(stationAssignmentProblems(n, "uk", ["ok"], "assign", named("lon"))).toEqual([
      { shipId: "", reason: "UNKNOWN_STATION" },
    ]);
  });

  it("treats an absent station as Any station and never checks the station list", () => {
    expect(
      stationAssignmentProblems(n, "uk", ["ok"], "assign", { knownStationAreaIds: [] }),
    ).toEqual([]);
    expect(stationAssignmentProblems(n, "uk", ["ok"], "assign")).toEqual([]);
  });

  it("lets a posted ship be re-targeted but not re-posted to the same target", () => {
    expect(stationAssignmentProblems(n, "uk", ["any"], "assign", named("bombay"))).toEqual([]);
    expect(stationAssignmentProblems(n, "uk", ["at-cape"], "assign", named("bombay"))).toEqual([]);
    expect(
      stationAssignmentProblems(n, "uk", ["at-cape"], "assign", { knownStationAreaIds: stations }),
    ).toEqual([]);
    expect(stationAssignmentProblems(n, "uk", ["at-cape"], "assign", named("cape"))).toEqual([
      { shipId: "at-cape", reason: "ALREADY_ASSIGNED" },
    ]);
    expect(stationAssignmentProblems(n, "uk", ["any"], "assign")).toEqual([
      { shipId: "any", reason: "ALREADY_ASSIGNED" },
    ]);
    expect(stationAssignmentProblems(n, "uk", ["exercise"], "assign", named("cape"))).toEqual([
      { shipId: "exercise", reason: "ALREADY_ASSIGNED" },
    ]);
  });

  it("writes the station on assign, drops it on Any station and on clear", () => {
    const posted = withStationAssignment(ship("a"), "assign", "cape");
    expect(posted.stationAssignment).toBe("FOREIGN_STATION");
    expect(posted.stationAreaId).toBe("cape");
    const any = withStationAssignment(posted, "assign");
    expect(any.stationAssignment).toBe("FOREIGN_STATION");
    expect("stationAreaId" in any).toBe(false);
    const cleared = withStationAssignment(posted, "clear");
    expect("stationAssignment" in cleared).toBe(false);
    expect("stationAreaId" in cleared).toBe(false);
  });

  it("drops the station when readiness leaves ACTIVE", () => {
    const out = setShipReadiness(
      ship("a", { stationAssignment: "FOREIGN_STATION", stationAreaId: "cape" }),
      "RESERVE",
    );
    expect("stationAreaId" in out.ship).toBe(false);
  });
});
