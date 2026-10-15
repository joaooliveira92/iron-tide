import { TENSION_LABELS } from "@bluewave/campaign-engine";
import { describe, expect, it } from "vite-plus/test";
import {
  RELATION_PRESENTATION,
  TENSION_PRESENTATION,
  sortRelationsByTension,
} from "./new-game-briefing-presentation.js";

const RELATIONS = ["neutral", "allied", "at_war", "trade_agreement"] as const;

describe("new-game briefing presentation", () => {
  it("has an icon, label and colour class for every relation kind", () => {
    for (const relation of RELATIONS) {
      const entry = RELATION_PRESENTATION[relation];
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.icon).toBeTruthy();
      expect(entry.className.length).toBeGreaterThan(0);
    }
    expect(Object.keys(RELATION_PRESENTATION).sort()).toEqual([...RELATIONS].sort());
  });

  it("has an icon and colours for every engine tension band", () => {
    for (const band of TENSION_LABELS) {
      const entry = TENSION_PRESENTATION[band];
      expect(entry.icon).toBeTruthy();
      expect(entry.text.length).toBeGreaterThan(0);
      expect(entry.bar.length).toBeGreaterThan(0);
    }
    expect(Object.keys(TENSION_PRESENTATION).sort()).toEqual([...TENSION_LABELS].sort());
  });
});

describe("sortRelationsByTension", () => {
  function row(nationId: string, name: string, tension: number) {
    return { nationId, name, relation: "neutral" as const, tension };
  }

  it("orders most-hostile first, ties broken by name", () => {
    const sorted = sortRelationsByTension([
      row("fr", "France", 2),
      row("de", "Germany", 10),
      row("jp", "Japan", 6),
      row("ah", "Austria", 6),
    ]);
    expect(sorted.map((relation) => relation.nationId)).toEqual(["de", "ah", "jp", "fr"]);
  });

  it("does not mutate the projection's array", () => {
    const input = [row("fr", "France", 2), row("de", "Germany", 10)];
    const snapshot = [...input];
    sortRelationsByTension(input);
    expect(input).toEqual(snapshot);
  });
});
