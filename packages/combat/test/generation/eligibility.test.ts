import { describe, it, expect } from "vite-plus/test";
import { gatherEligibleAssets } from "../../src/generation/eligibility.js";
import {
  SHIP_WORKING_UP_BATTLE_INELIGIBLE,
  SHIP_ALREADY_RESERVED_FOR_BATTLE,
  FUEL_BATTLE_INELIGIBLE,
  BATTLE_RANGE_INELIGIBLE,
} from "../../src/generation/reasonCodes.js";
import { buildShip } from "../fixtures/generation-fixture.js";

function input(
  ships: ReturnType<typeof buildShip>[],
  extra: Partial<Parameters<typeof gatherEligibleAssets>[0]> = {},
) {
  return {
    ships,
    sideId: "ATTACKER",
    nationId: "GBR",
    areaId: "area_battle",
    reservedAssetIds: new Set<string>(),
    resolveStrength: () => 30,
    resolveShipType: () => "BB",
    resolveReadiness: () => 80,
    ...extra,
  };
}

describe("eligible-asset gathering (AC-6)", () => {
  it("excludes working-up, reserved, and out-of-area ships with reason codes", () => {
    const ships = [
      buildShip({
        id: "a",
        classId: "battleship",
        shipType: "BB",
        locationAreaId: "area_battle",
        firepower: 30,
        hitPoints: 100,
      }),
      buildShip({
        id: "b",
        classId: "battleship",
        shipType: "BB",
        locationAreaId: "area_battle",
        firepower: 30,
        hitPoints: 100,
        underConstruction: true,
      }),
      buildShip({
        id: "c",
        classId: "battleship",
        shipType: "BB",
        locationAreaId: "area_other",
        firepower: 30,
        hitPoints: 100,
      }),
      buildShip({
        id: "d",
        classId: "battleship",
        shipType: "BB",
        locationAreaId: "area_battle",
        firepower: 30,
        hitPoints: 100,
      }),
    ];
    const { eligible, exclusions } = gatherEligibleAssets(
      input(ships, { reservedAssetIds: new Set(["d"]) }),
    );
    expect(eligible.map((e) => e.assetId)).toEqual(["a"]);
    const byId = new Map(exclusions.map((e) => [e.assetId, e.reason]));
    expect(byId.get("b")).toBe(SHIP_WORKING_UP_BATTLE_INELIGIBLE);
    expect(byId.get("c")).toBe(BATTLE_RANGE_INELIGIBLE);
    expect(byId.get("d")).toBe(SHIP_ALREADY_RESERVED_FOR_BATTLE);
  });

  it("excludes low-readiness with FUEL_BATTLE_INELIGIBLE", () => {
    const ships = [
      buildShip({
        id: "a",
        classId: "battleship",
        shipType: "BB",
        locationAreaId: "area_battle",
        firepower: 30,
        hitPoints: 100,
      }),
    ];
    const { eligible, exclusions } = gatherEligibleAssets(
      input(ships, { resolveReadiness: () => 40 }),
    );
    expect(eligible).toEqual([]);
    expect(exclusions[0]?.reason).toBe(FUEL_BATTLE_INELIGIBLE);
  });

  it("orders complete divisions before unattached, then divisionId, position, assetId", () => {
    const ships = [
      buildShip({
        id: "solo",
        classId: "battleship",
        shipType: "BB",
        locationAreaId: "area_battle",
        firepower: 30,
        hitPoints: 100,
      }),
      buildShip({
        id: "div_b_2",
        classId: "battleship",
        shipType: "BB",
        locationAreaId: "area_battle",
        firepower: 30,
        hitPoints: 100,
      }),
      buildShip({
        id: "div_a_1",
        classId: "battleship",
        shipType: "BB",
        locationAreaId: "area_battle",
        firepower: 30,
        hitPoints: 100,
      }),
    ];
    const { eligible } = gatherEligibleAssets(
      input(ships, {
        divisionIdFor: (id) => (id.startsWith("div") ? `div_${id.split("_")[1]}` : undefined),
        divisionPositionFor: (id) => (id.startsWith("div") ? Number(id.split("_")[2]) : undefined),
      }),
    );
    expect(eligible.map((e) => e.assetId)).toEqual(["div_a_1", "div_b_2", "solo"]);
  });

  it("gathering consumes no randomness (deterministic order)", () => {
    const ships = [
      buildShip({
        id: "x",
        classId: "battleship",
        shipType: "BB",
        locationAreaId: "area_battle",
        firepower: 30,
        hitPoints: 100,
      }),
      buildShip({
        id: "y",
        classId: "battleship",
        shipType: "BB",
        locationAreaId: "area_battle",
        firepower: 30,
        hitPoints: 100,
      }),
    ];
    const a = gatherEligibleAssets(input(ships));
    const b = gatherEligibleAssets(input(ships));
    expect(a.eligible.map((e) => e.assetId)).toEqual(b.eligible.map((e) => e.assetId));
  });
});
