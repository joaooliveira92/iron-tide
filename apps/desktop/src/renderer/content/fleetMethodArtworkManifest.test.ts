import { CANONICAL_SCENARIOS } from "@bluewave/campaign";
import { describe, expect, it } from "vite-plus/test";
import { FLEET_METHOD_ARTWORK } from "./fleetMethodArtworkManifest.js";

describe("fleet method artwork manifest", () => {
  it("answers for exactly the engine's supported legacy fleet mode ids", () => {
    const manifestIds = new Set(Object.keys(FLEET_METHOD_ARTWORK));
    expect(manifestIds.size).toBeGreaterThan(0);
    for (const scenario of CANONICAL_SCENARIOS) {
      expect(new Set(scenario.supportedLegacyFleetModeIds)).toEqual(manifestIds);
    }
  });
});
