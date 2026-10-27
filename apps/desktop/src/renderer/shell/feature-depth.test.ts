import { describe, expect, it } from "vite-plus/test";
import { CAMPAIGN_SCREEN_REGISTRY } from "./campaign-screen-registry.js";
import { FEATURE_DEPTH, MAX_CLICK_DEPTH } from "./feature-depth.js";

describe("click-depth ledger (N-1, N-5)", () => {
  it("keeps every feature within the 3-click budget", () => {
    const tooDeep = FEATURE_DEPTH.filter((entry) => entry.path.length > MAX_CLICK_DEPTH);
    expect(tooDeep.map((entry) => entry.feature)).toEqual([]);
  });

  it("has a non-empty path and unique id for every feature", () => {
    const ids = FEATURE_DEPTH.map((entry) => entry.feature);
    expect(new Set(ids).size).toBe(ids.length);
    expect(FEATURE_DEPTH.every((entry) => entry.path.length > 0)).toBe(true);
  });

  it("covers every always-registered production screen", () => {
    const covered = new Set(FEATURE_DEPTH.map((entry) => entry.screen));
    const production = CAMPAIGN_SCREEN_REGISTRY.filter(
      (screen) => !["simulation", "tactical-sandbox", "debugging"].includes(screen.id),
    );
    expect(production.filter((screen) => !covered.has(screen.id)).map((s) => s.id)).toEqual([]);
  });

  it("excludes dev-only screens from the ledger (N-3)", () => {
    const devOnly = ["tactical-sandbox", "debugging"];
    expect(FEATURE_DEPTH.filter((e) => e.screen !== null && devOnly.includes(e.screen))).toEqual(
      [],
    );
  });
});
