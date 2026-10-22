import { describe, expect, it } from "vite-plus/test";
import type { NationRailRelation, NationRailRow } from "./nation-rail-state.js";
import {
  arrangeNationRail,
  describeNationRailSummary,
  needsAttention,
  summarizeNationRail,
  tensionLevel,
} from "./nation-rail-view.js";

function row(
  nationId: string,
  relation: NationRailRelation,
  extra: Partial<NationRailRow> = {},
): NationRailRow {
  return {
    nationId,
    name: nationId,
    isPlayer: relation === "self",
    relation,
    relationLabel: relation,
    blockade: false,
    warScore: null,
    tension: null,
    since: null,
    flagUrl: null,
    ...extra,
  };
}

const rows = [
  row("uk", "self"),
  row("austria", "peace", { tension: 2 }),
  row("france", "war", { tension: 10 }),
  row("germany", "alliance", { tension: 1 }),
  row("italy", "trade", { tension: 3 }),
  row("russia", "peace", { tension: 8 }),
  row("spain", "peace", { tension: 4, blockade: true }),
];

describe("nation rail view", () => {
  it("flags war, blockade and high tension as needing attention, never the player", () => {
    expect(rows.filter(needsAttention).map((r) => r.nationId)).toEqual([
      "france",
      "russia",
      "spain",
    ]);
  });

  it("summarises the rail without counting the player", () => {
    const summary = summarizeNationRail(rows);
    expect(summary).toEqual({ war: 1, allied: 1, tense: 2, attention: 3 });
    expect(describeNationRailSummary(summary)).toBe("1 at war · 1 allied · 2 tense");
    expect(describeNationRailSummary({ war: 0, allied: 0, tense: 0, attention: 0 })).toBe("");
  });

  it("groups by stance, attention first, alphabetical within", () => {
    const { player, groups } = arrangeNationRail(rows, "all", "name");
    expect(player?.nationId).toBe("uk");
    expect(groups.map((g) => [g.id, g.rows.map((r) => r.nationId)])).toEqual([
      ["enemies", ["france"]],
      ["allies", ["germany"]],
      ["partners", ["italy"]],
      ["neutral", ["russia", "spain", "austria"]],
    ]);
  });

  it("sorts by tension within groups", () => {
    const { groups } = arrangeNationRail(rows, "all", "tension");
    expect(groups.find((g) => g.id === "neutral")?.rows.map((r) => r.nationId)).toEqual([
      "russia",
      "spain",
      "austria",
    ]);
  });

  it("filters while keeping the player and dropping empty groups", () => {
    const war = arrangeNationRail(rows, "war", "name");
    expect(war.player?.nationId).toBe("uk");
    expect(war.groups.map((g) => g.id)).toEqual(["enemies"]);
    const tense = arrangeNationRail(rows, "tense", "name");
    expect(tense.groups.flatMap((g) => g.rows.map((r) => r.nationId))).toEqual([
      "france",
      "russia",
    ]);
  });

  it("buckets tension", () => {
    expect([0, 5, 7, 8, 10].map(tensionLevel)).toEqual([
      "calm",
      "elevated",
      "elevated",
      "critical",
      "critical",
    ]);
  });
});
