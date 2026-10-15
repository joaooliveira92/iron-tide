import { describe, expect, it } from "vite-plus/test";
import type { SearchTarget } from "./global-search-state.js";
import { filterSearchTargets } from "./global-search-state.js";

const targets: readonly SearchTarget[] = [
  { id: "overview", label: "Overview" },
  { id: "construction", label: "Construction" },
  { id: "fleet", label: "Fleet" },
  { id: "tactical-sandbox", label: "Tactical Sandbox" },
];

describe("filterSearchTargets", () => {
  it("returns nothing for an empty query", () => {
    expect(filterSearchTargets(targets, "")).toEqual([]);
    expect(filterSearchTargets(targets, "   ")).toEqual([]);
  });

  it("matches case-insensitively on a substring", () => {
    expect(filterSearchTargets(targets, "fleet")).toEqual([{ id: "fleet", label: "Fleet" }]);
    expect(filterSearchTargets(targets, "SAND")).toEqual([
      { id: "tactical-sandbox", label: "Tactical Sandbox" },
    ]);
  });

  it("can match multiple targets", () => {
    expect(filterSearchTargets(targets, "c")).toEqual([
      { id: "construction", label: "Construction" },
      { id: "tactical-sandbox", label: "Tactical Sandbox" },
    ]);
  });

  it("returns nothing when no target matches", () => {
    expect(filterSearchTargets(targets, "zeppelin")).toEqual([]);
  });
});
