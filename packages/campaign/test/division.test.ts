import { BluewaveError, SafeInt, isBluewaveError } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import {
  applyDivisionCommand,
  assertDivisionInvariants,
  type CanonicalShipType,
  DD_DIVISION_MAX_SHIPS,
  DIVISION_FLAGSHIP_INVALID,
  DIVISION_FORMATIONS,
  DIVISION_LOCATION_CONFLICT,
  DIVISION_MAX_SHIPS,
  DIVISION_PENALTIES,
  DIVISION_ROLES,
  DIVISION_SHIP_TYPE_INCOMPATIBLE,
  DIVISION_SIZE_LIMIT_EXCEEDED,
  DIVISION_STATE_INVARIANT_FAILED,
  type DivisionAssetView,
  divisionCanonicalType,
  INITIAL_DIVISION_COHESION,
  INITIAL_DIVISION_EXPERIENCE,
  isDivisionTypeCompatible,
  type PermanentDivision,
  VACANT,
} from "../src/division.js";

function makeDivision(overrides: Partial<PermanentDivision> = {}): PermanentDivision {
  return {
    divisionId: "div_1",
    nationId: "gb",
    shipOrder: ["s1"],
    flagshipShipId: "s1",
    commanderOfficerId: VACANT,
    divisionRole: "CORE",
    preferredFormation: "LINE_AHEAD",
    experience: SafeInt(INITIAL_DIVISION_EXPERIENCE),
    cohesion: SafeInt(INITIAL_DIVISION_COHESION),
    locationAreaId: "area_north_sea",
    creationMonth: "1880-01",
    lastReorganizationMonth: "1880-01",
    provenanceRefs: [],
    rulesetVersion: "1.0",
    aggregateHash: "",
    ...overrides,
  };
}

function asset(
  shipId: string,
  shipType: CanonicalShipType,
  loc = "area_north_sea",
): DivisionAssetView {
  return { shipId, shipType, locationAreaId: loc, isUnderConstruction: false };
}

describe("PermanentDivision aggregate (AC-2)", () => {
  it("§29.1: size 1..5, or 1..6 when all DD", () => {
    const ok6Dd = makeDivision({ shipOrder: ["a", "b", "c", "d", "e", "f"], flagshipShipId: "a" });
    expect(() =>
      assertDivisionInvariants(
        ok6Dd,
        ["a", "b", "c", "d", "e", "f"].map((id) => asset(id, "DD")),
      ),
    ).not.toThrow();

    const ok6Mixed = makeDivision({
      shipOrder: ["a", "b", "c", "d", "e", "f"],
      flagshipShipId: "a",
    });
    expect(() =>
      assertDivisionInvariants(
        ok6Mixed,
        ["a", "b", "c", "d", "e", "f"].map((id) => asset(id, "BB")),
      ),
    ).toThrow(new RegExp(DIVISION_SIZE_LIMIT_EXCEEDED));

    const tooMany = makeDivision({
      shipOrder: ["a", "b", "c", "d", "e", "f", "g"],
      flagshipShipId: "a",
    });
    expect(() =>
      assertDivisionInvariants(
        tooMany,
        ["a", "b", "c", "d", "e", "f", "g"].map((id) => asset(id, "DD")),
      ),
    ).toThrow(new RegExp(DIVISION_SIZE_LIMIT_EXCEEDED));
  });

  it("§29.2: size limit violated -> DIVISION_SIZE_LIMIT_EXCEEDED", () => {
    expect(DIVISION_MAX_SHIPS).toBe(5);
    expect(DD_DIVISION_MAX_SHIPS).toBe(6);
  });

  it("§29.3: type compatibility BB/B mix allowed, mixed CL+BB rejected", () => {
    expect(isDivisionTypeCompatible(["BB"], "B")).toBe(true);
    expect(isDivisionTypeCompatible(["BB"], "CL")).toBe(false);
    expect(isDivisionTypeCompatible(["CA"], "BC")).toBe(true);
    expect(isDivisionTypeCompatible(["CL"], "DD")).toBe(false);
  });

  it("§29.4 / §4: incompatible mix -> DIVISION_SHIP_TYPE_INCOMPATIBLE", () => {
    const d = makeDivision({ shipOrder: ["a", "b"], flagshipShipId: "a" });
    expect(() => assertDivisionInvariants(d, [asset("a", "BB"), asset("b", "DD")])).toThrow(
      new RegExp(DIVISION_SHIP_TYPE_INCOMPATIBLE),
    );
    // BB+B mix is legal
    expect(() => assertDivisionInvariants(d, [asset("a", "BB"), asset("b", "B")])).not.toThrow();
  });

  it("§29.5: co-location -> DIVISION_LOCATION_CONFLICT", () => {
    const d = makeDivision({ shipOrder: ["a", "b"], flagshipShipId: "a" });
    expect(() =>
      assertDivisionInvariants(d, [
        asset("a", "BB", "area_north_sea"),
        asset("b", "BB", "area_med"),
      ]),
    ).toThrow(new RegExp(DIVISION_LOCATION_CONFLICT));
  });

  it("§29.7-8 / §8: first-in-order flagship, else DIVISION_FLAGSHIP_INVALID", () => {
    const d = makeDivision({ shipOrder: ["a", "b"], flagshipShipId: "b" });
    expect(() => assertDivisionInvariants(d, [asset("a", "BB"), asset("b", "BB")])).toThrow(
      new RegExp(DIVISION_FLAGSHIP_INVALID),
    );
    expect(divisionCanonicalType(["BB", "B"])).toBe("BB");
    expect(divisionCanonicalType(["BC", "CA"])).toBe("BC");
  });

  it("§29.10: new division begins at 20 experience / 30 cohesion", () => {
    expect(INITIAL_DIVISION_EXPERIENCE).toBe(20);
    expect(INITIAL_DIVISION_COHESION).toBe(30);
    const created = applyDivisionCommand(
      makeDivision(),
      { type: "create", shipId: "s1", creationMonth: "1880-01" },
      "1880-01",
    );
    expect(created.division.experience).toBe(SafeInt(20));
    expect(created.division.cohesion).toBe(SafeInt(30));
    expect(created.division.aggregateHash).toBeTruthy();
  });

  it("§29.11 / §12: penalties applied exactly", () => {
    const d = applyDivisionCommand(makeDivision(), { type: "add_ship", shipId: "s2" }, "1880-02");
    expect(d.penaltiesApplied).toEqual({
      experience: DIVISION_PENALTIES.addShip.experience,
      cohesion: DIVISION_PENALTIES.addShip.cohesion,
    });
    expect(d.division.experience).toBe(SafeInt(20 - 5));
    expect(d.division.cohesion).toBe(SafeInt(30 - 10));

    const rem = applyDivisionCommand(
      makeDivision({ shipOrder: ["a", "b"], flagshipShipId: "a" }),
      { type: "remove_ship", shipId: "b" },
      "1880-02",
    );
    expect(rem.penaltiesApplied).toEqual({
      experience: DIVISION_PENALTIES.removeNonFlagship.experience,
      cohesion: DIVISION_PENALTIES.removeNonFlagship.cohesion,
    });
  });

  it("§8: flagship change re-canonicalizes order and applies penalty", () => {
    const d = makeDivision({ shipOrder: ["a", "b", "c"], flagshipShipId: "a" });
    const r = applyDivisionCommand(
      d,
      { type: "change_flagship", newFlagshipShipId: "c" },
      "1880-02",
    );
    expect(r.division.shipOrder[0]).toBe("c");
    expect(r.division.flagshipShipId).toBe("c");
    expect(r.division.cohesion).toBe(SafeInt(30 - 10));
  });

  it("§12: reorder ships without flagship change applies cohesion only", () => {
    const d = makeDivision({ shipOrder: ["a", "b", "c"], flagshipShipId: "a" });
    const r = applyDivisionCommand(d, { type: "reorder", shipOrder: ["a", "c", "b"] }, "1880-02");
    expect(r.division.shipOrder).toEqual(["a", "c", "b"]);
    expect(r.division.flagshipShipId).toBe("a");
    expect(r.reorgReason).toBe("REORDER");
    expect(r.penaltiesApplied).toEqual({
      experience: DIVISION_PENALTIES.reorderWithoutFlagship.experience,
      cohesion: DIVISION_PENALTIES.reorderWithoutFlagship.cohesion,
    });
    expect(r.division.experience).toBe(SafeInt(INITIAL_DIVISION_EXPERIENCE));
    expect(r.division.cohesion).toBe(SafeInt(INITIAL_DIVISION_COHESION - 3));
  });

  it("§3: dissolve leaves zero-member (handled by caller as removal)", () => {
    const r = applyDivisionCommand(makeDivision(), { type: "dissolve" }, "1880-02");
    expect(r.division.shipOrder).toEqual([]);
    expect(r.division.flagshipShipId).toBe("NONE");
  });

  it("roles and formations are the canonical sets", () => {
    expect(DIVISION_ROLES).toEqual(["INDEPENDENT", "CORE", "SUPPORT", "SCOUT", "SCREEN", "PATROL"]);
    expect(DIVISION_FORMATIONS).toEqual(["LINE_AHEAD", "LINE_ABREAST", "SEARCH_LINE", "SCREEN"]);
  });

  it("empty division -> DIVISION_STATE_INVARIANT_FAILED", () => {
    const d = makeDivision({ shipOrder: [], flagshipShipId: "NONE" });
    expect(() => assertDivisionInvariants(d, [])).toThrow(
      new RegExp(DIVISION_STATE_INVARIANT_FAILED),
    );
  });

  it("invariant failures are BluewaveError with code", () => {
    const d = makeDivision({ shipOrder: ["a", "b"], flagshipShipId: "a" });
    try {
      assertDivisionInvariants(d, [asset("a", "BB"), asset("b", "DD")]);
      expect(true).toBe(false);
    } catch (e) {
      expect(isBluewaveError(e)).toBe(true);
      expect((e as BluewaveError).message).toContain(DIVISION_SHIP_TYPE_INCOMPATIBLE);
    }
  });
});
