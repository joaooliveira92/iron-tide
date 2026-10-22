import { describe, it, expect } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import type { PermanentDivision } from "@bluewave/campaign";
import { projectPermanentDivision } from "@bluewave/combat/tactical";
import { promoteTacticalUnit } from "@bluewave/combat/tactical";
import { makeDesign, makeShip } from "../fixtures/unit-fixture.js";

function unitsFor(shipIds: string[]) {
  return shipIds.map((id, _i) =>
    promoteTacticalUnit(
      makeShip({ id, name: `Ship ${id}`, locationAreaId: "area_north_sea" }),
      makeDesign(),
      { sideId: "ATTACKER", preBattleStateHash: `state-${id}` },
    ),
  );
}

function div(overrides: Partial<PermanentDivision> = {}): PermanentDivision {
  return {
    divisionId: "div_1",
    nationId: "gb",
    shipOrder: ["s1", "s2"],
    flagshipShipId: "s1",
    commanderOfficerId: "VACANT",
    divisionRole: "CORE",
    preferredFormation: "LINE_AHEAD",
    experience: SafeInt(20),
    cohesion: SafeInt(30),
    locationAreaId: "area_north_sea",
    creationMonth: "1880-01",
    lastReorganizationMonth: "1880-01",
    provenanceRefs: [],
    rulesetVersion: "1.0",
    aggregateHash: "h",
    ...overrides,
  };
}

describe("permanent division projection (AC-7)", () => {
  it("preserves a complete eligible division as one tactical division", () => {
    const units = unitsFor(["s1", "s2"]);
    const r = projectPermanentDivision(div(), units, "b1", "ATTACKER", "1.0");
    expect(r.tacticalDivisions).toHaveLength(1);
    const td = r.tacticalDivisions[0]!;
    expect(td.orderedTacticalUnitIds).toEqual(["s1", "s2"]);
    expect(td.tacticalFlagshipId).toBe("s1");
    expect(td.sourcePermanentDivisionIds).toEqual(["div_1"]);
    expect(td.initialExperience).toBe(SafeInt(20));
    expect(td.initialCohesion).toBe(SafeInt(30));
    expect(r.adjustments).toEqual([]);
  });

  it("removes ineligible/missing ships with adjustment reasons (never mutates permanent)", () => {
    const units = unitsFor(["s1"]);
    const r = projectPermanentDivision(div(), units, "b1", "ATTACKER", "1.0");
    expect(r.adjustments.length).toBeGreaterThan(0);
    expect(r.adjustments[0]!.shipId).toBe("s2");
    expect(r.adjustments[0]!.reason).toBe("SHIP_OUT_OF_AREA");
    expect(r.tacticalDivisions[0]!.orderedTacticalUnitIds).toEqual(["s1"]);
  });

  it("flagships follow preserved campaign order; provenance stays unique", () => {
    const units = unitsFor(["s1", "s2", "s3"]);
    const r = projectPermanentDivision(
      div({ shipOrder: ["s2", "s1", "s3"], flagshipShipId: "s2" }),
      units,
      "b1",
      "ATTACKER",
      "1.0",
    );
    expect(r.tacticalDivisions[0]!.tacticalFlagshipId).toBe("s2");
    const ids = r.tacticalDivisions[0]!.campaignAssetProvenanceIds;
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("tactical projection never mutates permanent membership", () => {
    const permanent = div();
    const units = unitsFor(["s1"]);
    projectPermanentDivision(permanent, units, "b1", "ATTACKER", "1.0");
    expect(permanent.shipOrder).toEqual(["s1", "s2"]);
    expect(permanent.flagshipShipId).toBe("s1");
  });
});
