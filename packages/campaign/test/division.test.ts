import { SafeInt } from "@bluewave/contracts";
import { CAMPAIGN_DIVISION_FORMATIONS, CAMPAIGN_DIVISION_ROLES } from "@bluewave/content-schema";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { Option } from "effect";
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
import { buildSeededDivisions, DIVISION_SEED_CODES } from "../src/divisions.js";
import type { Officer } from "../src/officers.js";
import type { FleetState, Ship } from "../src/state.js";

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
    expect(Option.getOrNull(divisionCanonicalType(["BB", "B"]))).toBe("BB");
    expect(Option.getOrNull(divisionCanonicalType(["BC", "CA"]))).toBe("BC");
    expect(Option.getOrNull(divisionCanonicalType(["DD"]))).toBe("DD");
    expect(Option.isNone(divisionCanonicalType([]))).toBe(true);
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

  it("each invariant failure carries its own _tag equal to its code", () => {
    const d = makeDivision({ shipOrder: ["a", "b"], flagshipShipId: "a" });
    try {
      assertDivisionInvariants(d, [asset("a", "BB"), asset("b", "DD")]);
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toMatchObject({
        _tag: DIVISION_SHIP_TYPE_INCOMPATIBLE,
        message: DIVISION_SHIP_TYPE_INCOMPATIBLE,
        divisionId: d.divisionId,
      });
    }
  });
});

function makeShip(id: string, nationId: string, locationAreaId: string): Ship {
  return {
    id,
    name: id,
    classId: "Test",
    nationId,
    locationAreaId,
    designVersionId: "",
    hitPoints: SafeInt(1),
    maxHitPoints: SafeInt(1),
    speed: SafeInt(1),
    firepower: SafeInt(1),
    armor: SafeInt(1),
    isUnderConstruction: false,
    constructionProgress: SafeInt(0),
    constructionTotalWork: SafeInt(0),
    readiness: "ACTIVE",
    crewQuality: SafeInt(100),
  };
}

function makeFleet(nationId: string, locationAreaId: string, shipIds: string[]): FleetState {
  return {
    id: `fleet_${nationId}_${locationAreaId}`,
    nationId,
    name: locationAreaId,
    locationAreaId,
    ships: shipIds.map((id) => makeShip(id, nationId, locationAreaId)),
  };
}

function makeOfficer(nationId: string, index: number): Officer {
  return {
    id: `off_${nationId}_${String(index)}`,
    name: "Test",
    rank: "CAPTAIN",
    skill: SafeInt(50),
  };
}

const SEED_CONTEXT = {
  nationId: "uk",
  fleets: [
    makeFleet("uk", "eng_home", ["s1", "s2"]),
    makeFleet("uk", "med", ["s3"]),
    makeFleet("france", "fra_med", ["f1"]),
  ],
  officers: [makeOfficer("uk", 1), makeOfficer("uk", 2)],
  rulesetVersion: "1.0",
  creationMonth: "1880-01",
} as const;

function seed(
  record: Record<string, unknown>,
  context: typeof SEED_CONTEXT = SEED_CONTEXT,
): { divisions: PermanentDivision[]; collector: DiagnosticCollector } {
  const collector = new DiagnosticCollector();
  const divisions = buildSeededDivisions([record], context, collector);
  return { divisions, collector };
}

describe("buildSeededDivisions (N-1 ticket 07)", () => {
  const valid = {
    id: "div_uk_home",
    nationId: "uk",
    shipOrder: ["s1", "s2"],
    commanderOfficerId: "off_uk_1",
    divisionRole: "CORE",
    preferredFormation: "LINE_AHEAD",
  };

  it("keeps one vocabulary for the schema and the engine", () => {
    expect([...DIVISION_ROLES]).toEqual([...CAMPAIGN_DIVISION_ROLES]);
    expect([...DIVISION_FORMATIONS]).toEqual([...CAMPAIGN_DIVISION_FORMATIONS]);
  });

  it("builds a valid division with flagship-first order and DESIGN-26 initial values", () => {
    const { divisions, collector } = seed(valid);
    expect(collector.hasErrors).toBe(false);
    expect(divisions).toHaveLength(1);
    const division = divisions[0]!;
    expect(division.divisionId).toBe("div_uk_home");
    expect(division.nationId).toBe("uk");
    expect(division.flagshipShipId).toBe("s1");
    expect(division.commanderOfficerId).toBe("off_uk_1");
    expect(division.locationAreaId).toBe("eng_home");
    expect(division.experience).toBe(SafeInt(INITIAL_DIVISION_EXPERIENCE));
    expect(division.cohesion).toBe(SafeInt(INITIAL_DIVISION_COHESION));
    expect(division.creationMonth).toBe("1880-01");
    expect(division.lastReorganizationMonth).toBe("1880-01");
    expect(division.rulesetVersion).toBe("1.0");
    expect(division.aggregateHash).toBeTruthy();
  });

  it("is deterministic and yields an id-ordered list", () => {
    const a = seed(valid).divisions;
    const b = seed(valid).divisions;
    expect(a).toEqual(b);
    const collector = new DiagnosticCollector();
    const many = buildSeededDivisions(
      [
        { ...valid, id: "div_b", shipOrder: ["s2"], commanderOfficerId: "off_uk_2" },
        { ...valid, id: "div_a", shipOrder: ["s1"], commanderOfficerId: "off_uk_1" },
      ],
      SEED_CONTEXT,
      collector,
    );
    expect(many.map((d) => d.divisionId)).toEqual(["div_a", "div_b"]);
  });

  it("rejects a ship claimed by two seeded divisions", () => {
    const collector = new DiagnosticCollector();
    const divisions = buildSeededDivisions(
      [
        { ...valid, id: "div_a", shipOrder: ["s1"] },
        { ...valid, id: "div_b", shipOrder: ["s1"], commanderOfficerId: VACANT },
      ],
      SEED_CONTEXT,
      collector,
    );
    expect(divisions.map((d) => d.divisionId)).toEqual(["div_a"]);
    expect(collector.errors.map((e) => e.code)).toContain(DIVISION_SEED_CODES.ship);
  });

  it("rejects an officer commanding two seeded divisions", () => {
    const collector = new DiagnosticCollector();
    const divisions = buildSeededDivisions(
      [
        { ...valid, id: "div_a", shipOrder: ["s1"] },
        { ...valid, id: "div_b", shipOrder: ["s2"] },
      ],
      SEED_CONTEXT,
      collector,
    );
    expect(divisions.map((d) => d.divisionId)).toEqual(["div_a"]);
    expect(collector.errors.map((e) => e.code)).toContain(DIVISION_SEED_CODES.officer);
  });

  it("accepts VACANT for a commander", () => {
    const { divisions, collector } = seed({ ...valid, commanderOfficerId: VACANT });
    expect(collector.hasErrors).toBe(false);
    expect(divisions[0]!.commanderOfficerId).toBe(VACANT);
  });

  const failures: ReadonlyArray<{ name: string; record: Record<string, unknown>; code: string }> = [
    {
      name: "unknown ship",
      record: { ...valid, shipOrder: ["s1", "missing"] },
      code: DIVISION_SEED_CODES.ship,
    },
    {
      name: "empty shipOrder",
      record: { ...valid, shipOrder: [] },
      code: DIVISION_SEED_CODES.ship,
    },
    {
      name: "non-colocated ships",
      record: { ...valid, shipOrder: ["s1", "s3"] },
      code: DIVISION_SEED_CODES.location,
    },
    {
      name: "another nation's ship",
      record: { ...valid, shipOrder: ["f1"] },
      code: DIVISION_SEED_CODES.nation,
    },
    {
      name: "unknown officer",
      record: { ...valid, commanderOfficerId: "off_uk_99" },
      code: DIVISION_SEED_CODES.officer,
    },
    {
      name: "unknown role",
      record: { ...valid, divisionRole: "BOGUS" },
      code: DIVISION_SEED_CODES.role,
    },
    {
      name: "unknown formation",
      record: { ...valid, preferredFormation: "BOGUS" },
      code: DIVISION_SEED_CODES.formation,
    },
  ];

  for (const { name, record, code } of failures) {
    it(`rejects ${name} with a _tag-discriminated diagnostic (never a default)`, () => {
      const collector = new DiagnosticCollector();
      const divisions = buildSeededDivisions([record], SEED_CONTEXT, collector);
      expect(divisions).toHaveLength(0);
      expect(collector.errors.map((e) => e.code)).toContain(code);
      expect(collector.errors.map((e) => e.stage)).toContain("campaign-compile");
    });
  }
});
