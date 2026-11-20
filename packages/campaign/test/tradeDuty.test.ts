import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import type { Ship } from "../src/index.js";
import { ASSIGNMENT_ALLOWED_USES, isShipEligible } from "../src/eligibility.js";
import { tradeDutyProblems, withTradeDuty } from "../src/tradeDuty.js";

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

describe("trade duty assignment", () => {
  const n = nation([
    ship("ok"),
    ship("foreign", { nationId: "fra" }),
    ship("building", { isUnderConstruction: true, readiness: "WORKING_UP" }),
    ship("reserve", { readiness: "RESERVE" }),
    ship("posted", { stationAssignment: "FOREIGN_STATION" }),
    ship("exercising", { stationAssignment: "EXERCISE" }),
    ship("escort", { stationAssignment: "TRADE_PROTECTION" }),
    ship("hunter", { stationAssignment: "RAIDER" }),
  ]);

  it("accepts active unassigned ships and a switch between trade duties", () => {
    expect(tradeDutyProblems(n, "uk", ["ok"], "TRADE_PROTECTION")).toEqual([]);
    expect(tradeDutyProblems(n, "uk", ["ok"], "RAIDER")).toEqual([]);
    expect(tradeDutyProblems(n, "uk", ["escort"], "RAIDER")).toEqual([]);
    expect(tradeDutyProblems(n, "uk", ["hunter"], "TRADE_PROTECTION")).toEqual([]);
  });

  it("clears only ships that hold a trade duty", () => {
    expect(tradeDutyProblems(n, "uk", ["escort", "hunter"], "NONE")).toEqual([]);
    expect(tradeDutyProblems(n, "uk", ["ok", "posted"], "NONE")).toEqual([
      { shipId: "ok", reason: "NOT_ASSIGNED" },
      { shipId: "posted", reason: "NOT_ASSIGNED" },
    ]);
  });

  it("rejects ships that are not free to take a duty", () => {
    expect(
      tradeDutyProblems(
        n,
        "uk",
        ["foreign", "building", "reserve", "posted", "exercising", "missing"],
        "TRADE_PROTECTION",
      ),
    ).toEqual([
      { shipId: "building", reason: "UNDER_CONSTRUCTION" },
      { shipId: "exercising", reason: "ALREADY_ASSIGNED" },
      { shipId: "foreign", reason: "NOT_OWNED" },
      { shipId: "missing", reason: "NOT_OWNED" },
      { shipId: "posted", reason: "ALREADY_ASSIGNED" },
      { shipId: "reserve", reason: "NOT_ACTIVE" },
    ]);
  });

  it("rejects an empty or duplicated batch", () => {
    expect(tradeDutyProblems(n, "uk", [], "RAIDER")).toEqual([
      { shipId: "", reason: "EMPTY_BATCH" },
    ]);
    expect(tradeDutyProblems(n, "uk", ["ok", "ok"], "RAIDER")).toEqual([
      { shipId: "ok", reason: "DUPLICATE_SHIP" },
    ]);
  });

  it("sets and clears the assignment, leaving no station area behind", () => {
    const posted = ship("a", { stationAssignment: "FOREIGN_STATION", stationAreaId: "x" });
    expect(withTradeDuty(ship("a"), "RAIDER").stationAssignment).toBe("RAIDER");
    const cleared = withTradeDuty(withTradeDuty(posted, "TRADE_PROTECTION"), "NONE");
    expect(cleared.stationAssignment).toBeUndefined();
    expect("stationAreaId" in cleared).toBe(false);
  });

  it("keeps a ship on trade duty out of battle and off the sea lanes", () => {
    expect(ASSIGNMENT_ALLOWED_USES.TRADE_PROTECTION).toEqual([]);
    expect(ASSIGNMENT_ALLOWED_USES.RAIDER).toEqual([]);
    expect(isShipEligible(ship("a", { stationAssignment: "RAIDER" }), "ENTER_BATTLE")).toBe(false);
    expect(isShipEligible(ship("a", { stationAssignment: "TRADE_PROTECTION" }), "SAIL")).toBe(
      false,
    );
  });
});
