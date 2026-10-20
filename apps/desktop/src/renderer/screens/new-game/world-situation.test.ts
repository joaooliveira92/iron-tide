import { describe, expect, it } from "vite-plus/test";
import { JAPAN_RELATIONS, japanProjection } from "./world-situation-fixture.js";
import { worldSituationSource } from "./world-situation-source.js";
import {
  OVERSEAS_REACH_MIN_THEATERS,
  RELEVANCE_TIERS,
  adjacentPowerId,
  buildWorldSituation,
  deriveOutlook,
} from "./world-situation.js";

const build = (projection = japanProjection()) =>
  buildWorldSituation(worldSituationSource(projection));

describe("buildWorldSituation", () => {
  it("represents Japan as the active nation with its authored assessment", () => {
    const situation = build();
    expect(situation.player.nationId).toBe("japan");
    expect(situation.player.name).toBe("Empire of Japan");
    expect(situation.player.theaters.map((theater) => theater.id)).toEqual(["east_asia"]);
    expect(situation.player.assessment).toMatch(/Russian/);
  });

  it("places powers by theatre contact and reach, in a fixed tier order", () => {
    const { groups } = build();
    expect(groups.map((group) => group.tier)).toEqual([...RELEVANCE_TIERS]);
    const names = (tier: string) =>
      groups.find((group) => group.tier === tier)?.powers.map((power) => power.nationId);
    // Qing is strained next door (flashpoint), then the other powers holding east-Asian waters.
    expect(names("immediate")).toEqual(["qing", "uk", "russia"]);
    expect(names("wide_reach")).toEqual(["france"]);
    // The United States holds ground in only two theatres, neither of them yours.
    expect(names("distant")).toEqual(["usa", "austria_hungary", "brazil", "germany"]);
  });

  it("is deterministic and never mutates the projection", () => {
    const projection = japanProjection();
    const before = JSON.stringify(projection);
    const first = build(projection);
    const second = build({
      ...projection,
      foreignIntelligence: {
        ...projection.foreignIntelligence,
        relations: [...JAPAN_RELATIONS].reverse(),
      },
    });
    expect(JSON.stringify(projection)).toBe(before);
    expect(second.ordered.map((power) => power.nationId)).toEqual(
      first.ordered.map((power) => power.nationId),
    );
    expect(first.defaultSelectionId).toBe("qing");
  });

  it("keeps status, attitude, tension, outlook and confidence as separate facts", () => {
    const qing = build().ordered.find((power) => power.nationId === "qing");
    expect(qing).toMatchObject({
      status: "neutral",
      attitude: "strained",
      tension: 6,
      outlook: "flashpoint",
      nonAggressionPact: false,
    });
    // A neutral status at a neutral band are different concepts with different words.
    const uk = build().ordered.find((power) => power.nationId === "uk");
    expect(uk).toMatchObject({ status: "neutral", attitude: "neutral", outlook: "uncertain" });
  });

  it("never fabricates intelligence confidence", () => {
    for (const power of build().ordered) expect(power.confidence).toBeNull();
  });

  it("counts posture by status and by outlook", () => {
    const { posture } = build();
    expect(posture.byStatus).toEqual({ allied: 0, trade_agreement: 0, neutral: 8, at_war: 0 });
    expect(posture.byOutlook).toEqual({ flashpoint: 1, uncertain: 2, stable: 5 });
  });

  it("puts a power at war or near war in the immediate tier whatever its holdings", () => {
    const projection = japanProjection({
      relations: [
        {
          nationId: "brazil",
          name: "Empire of Brazil",
          relation: "at_war",
          tension: 10,
          nap: false,
          controlledAreas: [],
        },
        {
          nationId: "germany",
          name: "German Empire",
          relation: "neutral",
          tension: 8,
          nap: false,
          controlledAreas: [],
        },
      ],
    });
    const { groups } = build(projection);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.powers.map((power) => [power.nationId, power.reason])).toEqual([
      ["brazil", "at_war"],
      ["germany", "high_tension"],
    ]);
  });

  it("degrades to relationship-only placement when a player has no placeable holdings", () => {
    const situation = build(japanProjection({ playerAreas: [] }));
    expect(situation.player.theaters).toEqual([]);
    expect(situation.ordered.every((power) => power.sharedHoldings.length === 0)).toBe(true);
    expect(situation.groups.some((group) => group.tier === "immediate")).toBe(false);
  });

  it("returns an empty, selectable-nothing situation for an empty dataset", () => {
    const situation = build(japanProjection({ relations: [] }));
    expect(situation.ordered).toEqual([]);
    expect(situation.groups).toEqual([]);
    expect(situation.defaultSelectionId).toBeNull();
  });

  it("requires several theatres for wide reach", () => {
    expect(OVERSEAS_REACH_MIN_THEATERS).toBeGreaterThan(1);
  });
});

describe("deriveOutlook", () => {
  it("is exhaustive over the statuses and weighs proximity", () => {
    expect(deriveOutlook("at_war", 10, false)).toBe("flashpoint");
    expect(deriveOutlook("neutral", 8, false)).toBe("flashpoint");
    expect(deriveOutlook("neutral", 6, true)).toBe("flashpoint");
    expect(deriveOutlook("neutral", 6, false)).toBe("uncertain");
    expect(deriveOutlook("neutral", 4, true)).toBe("uncertain");
    expect(deriveOutlook("neutral", 4, false)).toBe("stable");
    expect(deriveOutlook("allied", 4, true)).toBe("stable");
    expect(deriveOutlook("trade_agreement", 1, true)).toBe("stable");
  });
});

describe("adjacentPowerId", () => {
  const ordered = [{ nationId: "a" }, { nationId: "b" }, { nationId: "c" }];
  it("moves, clamps and jumps without wrapping", () => {
    expect(adjacentPowerId(ordered, "a", "next")).toBe("b");
    expect(adjacentPowerId(ordered, "c", "next")).toBe("c");
    expect(adjacentPowerId(ordered, "a", "previous")).toBe("a");
    expect(adjacentPowerId(ordered, "b", "first")).toBe("a");
    expect(adjacentPowerId(ordered, "b", "last")).toBe("c");
    expect(adjacentPowerId(ordered, null, "next")).toBe("a");
    expect(adjacentPowerId([], "a", "next")).toBeNull();
  });
});
