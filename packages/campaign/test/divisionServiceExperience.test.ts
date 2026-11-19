import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import { divisionAggregateHash, type PermanentDivision } from "../src/division.js";
import { growDivisionServiceExperience } from "../src/divisionServiceExperience.js";
import type { Ship } from "../src/state.js";

const RULES = { monthlyGrowth: 1, cap: 40 } as const;
const MONTH = "1880-03";

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
  } as PermanentDivision;
  return { ...base, aggregateHash: divisionAggregateHash(base) };
}

function ships(over: Record<string, Partial<Ship>> = {}): Map<string, Ship> {
  return new Map(
    ["s1", "s2"].map((id) => [
      id,
      { id, readiness: "ACTIVE", isUnderConstruction: false, ...over[id] } as Ship,
    ]),
  );
}

describe("growDivisionServiceExperience", () => {
  it("adds the monthly growth to a settled division and refreshes the aggregate hash", () => {
    const grown = growDivisionServiceExperience(division(), ships(), MONTH, RULES);
    expect(grown.experience as number).toBe(21);
    expect(grown.aggregateHash).toBe(divisionAggregateHash(grown));
    expect(grown.cohesion as number).toBe(30);
  });

  it("stops in the month the division was reorganised", () => {
    const d = division({ lastReorganizationMonth: MONTH });
    expect(growDivisionServiceExperience(d, ships(), MONTH, RULES)).toBe(d);
  });

  it("stops while any member is not ACTIVE, is unavailable, is under construction or is missing", () => {
    const d = division();
    for (const over of [
      { s2: { readiness: "RESERVE" } },
      { s2: { readiness: "REPAIR" } },
      { s2: { availability: "UNAVAILABLE" } },
      { s2: { isUnderConstruction: true } },
    ] as Record<string, Partial<Ship>>[]) {
      expect(growDivisionServiceExperience(d, ships(over), MONTH, RULES)).toBe(d);
    }
    const missing = ships();
    missing.delete("s2");
    expect(growDivisionServiceExperience(d, missing, MONTH, RULES)).toBe(d);
  });

  it("clamps at the cap and never lowers experience already earned above it", () => {
    expect(
      growDivisionServiceExperience(division({ experience: SafeInt(39) }), ships(), MONTH, {
        monthlyGrowth: 3,
        cap: 40,
      }).experience,
    ).toBe(40);
    const above = division({ experience: SafeInt(55) });
    expect(growDivisionServiceExperience(above, ships(), MONTH, RULES)).toBe(above);
    const atCap = division({ experience: SafeInt(40) });
    expect(growDivisionServiceExperience(atCap, ships(), MONTH, RULES)).toBe(atCap);
  });

  it("never leaves the 0..100 range even with a cap of 100", () => {
    const grown = growDivisionServiceExperience(
      division({ experience: SafeInt(99) }),
      ships(),
      MONTH,
      { monthlyGrowth: 5, cap: 100 },
    );
    expect(grown.experience as number).toBe(100);
  });
});
