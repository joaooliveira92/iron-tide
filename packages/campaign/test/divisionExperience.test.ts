import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import { divisionAggregateHash, type PermanentDivision } from "../src/division.js";
import {
  applyDivisionExperienceRequest,
  battleExperienceRequests,
} from "../src/divisionExperience.js";

function division(
  divisionId: string,
  nationId: string,
  shipOrder: string[],
  experience = 20,
): PermanentDivision {
  const base = {
    divisionId,
    nationId,
    shipOrder,
    flagshipShipId: shipOrder[0]!,
    experience: SafeInt(experience),
    cohesion: SafeInt(30),
  } as PermanentDivision;
  return { ...base, aggregateHash: divisionAggregateHash(base) };
}

describe("applyDivisionExperienceRequest", () => {
  it("adds the points, clamps to 100 and refreshes the hash", () => {
    const applied = applyDivisionExperienceRequest(division("d", "GBR", ["a"], 98), { points: 5 });
    expect(applied.after as number).toBe(100);
    expect(applied.before as number).toBe(98);
    expect(applied.division.aggregateHash).toBe(divisionAggregateHash(applied.division));
  });

  it("returns the same division when nothing would change", () => {
    const full = division("d", "GBR", ["a"], 100);
    expect(applyDivisionExperienceRequest(full, { points: 5 }).division).toBe(full);
    const plain = division("d", "GBR", ["a"], 20);
    expect(applyDivisionExperienceRequest(plain, { points: 0 }).division).toBe(plain);
  });
});

describe("battleExperienceRequests", () => {
  const divisions = [
    division("z-late", "GBR", ["a"]),
    division("a-early", "GBR", ["b", "x"]),
    division("idle", "GBR", ["c"]),
    division("french", "FRA", ["f"]),
  ];

  it("asks once per division with a participating ship, in nation then division order", () => {
    const requests = battleExperienceRequests({
      battleId: "battle-1",
      participantShipIds: new Set(["a", "b", "x", "f"]),
      divisions,
      points: 3,
    });
    expect(requests.map((r) => [r.nationId, r.divisionId])).toEqual([
      ["FRA", "french"],
      ["GBR", "a-early"],
      ["GBR", "z-late"],
    ]);
    expect(requests.every((r) => r.reason === "BATTLE_PARTICIPATION" && r.points === 3)).toBe(true);
    expect(requests.every((r) => r.sourceId === "battle-1")).toBe(true);
  });

  it("asks for nothing when no points are granted", () => {
    expect(
      battleExperienceRequests({
        battleId: "battle-1",
        participantShipIds: new Set(["a"]),
        divisions,
        points: 0,
      }),
    ).toEqual([]);
  });
});
