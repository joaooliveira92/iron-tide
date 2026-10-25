import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import { divisionAggregateHash, type PermanentDivision } from "../src/division.js";
import { applyDivisionDoctrineChange, divisionSpeedAdvisory } from "../src/divisionDoctrine.js";
import type { Ship } from "../src/state.js";

const PENALTIES = {
  roleChange: { cohesion: 10, experience: 2 },
  formationChange: { cohesion: 5, experience: 0 },
} as const;

function division(over: Partial<PermanentDivision> = {}): PermanentDivision {
  const base: PermanentDivision = {
    divisionId: "d1",
    nationId: "GBR",
    shipOrder: ["s1", "s2"],
    flagshipShipId: "s1",
    commanderOfficerId: "VACANT",
    divisionRole: "CORE",
    preferredFormation: "LINE_AHEAD",
    experience: SafeInt(20),
    cohesion: SafeInt(30),
    locationAreaId: "a-1",
    creationMonth: "1880-01",
    lastReorganizationMonth: "1880-01",
    provenanceRefs: [],
    rulesetVersion: "1.0",
    aggregateHash: "",
    ...over,
  };
  return { ...base, aggregateHash: divisionAggregateHash(base) };
}

describe("applyDivisionDoctrineChange", () => {
  it("changes the role, stamps the reorganisation month and charges only the role penalty", () => {
    const result = applyDivisionDoctrineChange(
      division(),
      { divisionRole: "SUPPORT" },
      "1880-03",
      PENALTIES,
    );
    expect(result.changedRole).toBe(true);
    expect(result.changedFormation).toBe(false);
    expect(result.division.divisionRole).toBe("SUPPORT");
    expect(result.division.lastReorganizationMonth).toBe("1880-03");
    expect(result.division.cohesion as number).toBe(20);
    expect(result.division.experience as number).toBe(18);
    expect(result.division.aggregateHash).toBe(divisionAggregateHash(result.division));
  });

  it("charges only the formation penalty for a formation change", () => {
    const result = applyDivisionDoctrineChange(
      division(),
      { preferredFormation: "LINE_ABREAST" },
      "1880-03",
      PENALTIES,
    );
    expect(result.division.preferredFormation).toBe("LINE_ABREAST");
    expect(result.division.cohesion as number).toBe(25);
    expect(result.division.experience as number).toBe(20);
  });

  it("charges both penalties when both change and clamps at zero", () => {
    const result = applyDivisionDoctrineChange(
      division({ cohesion: SafeInt(12) }),
      { divisionRole: "SCREEN", preferredFormation: "SCREEN" },
      "1880-03",
      PENALTIES,
    );
    expect(result.division.cohesion as number).toBe(0);
    expect(result.division.experience as number).toBe(18);
  });

  it("returns the division untouched when nothing changes", () => {
    const d = division();
    const result = applyDivisionDoctrineChange(
      d,
      { divisionRole: "CORE", preferredFormation: "LINE_AHEAD" },
      "1880-03",
      PENALTIES,
    );
    expect(result.division).toBe(d);
  });

  it("changes the doctrine without cost when no penalties are supplied", () => {
    const result = applyDivisionDoctrineChange(division(), { divisionRole: "SUPPORT" }, "1880-03");
    expect(result.division.cohesion as number).toBe(30);
    expect(result.division.lastReorganizationMonth).toBe("1880-03");
  });
});

describe("divisionSpeedAdvisory", () => {
  const ships = (speeds: Record<string, number>) =>
    new Map(
      Object.entries(speeds).map(([id, speed]) => [id, { id, speed: SafeInt(speed) } as Ship]),
    );

  it("names the slowest ship when the members differ in speed", () => {
    expect(divisionSpeedAdvisory(division(), ships({ s1: 17, s2: 12 }))).toEqual({
      slowestShipId: "s2",
      slowestSpeed: 12,
      fastestSpeed: 17,
    });
  });

  it("is silent for a uniform division or one with no known members", () => {
    expect(divisionSpeedAdvisory(division(), ships({ s1: 14, s2: 14 }))).toBeNull();
    expect(divisionSpeedAdvisory(division(), ships({}))).toBeNull();
  });
});
