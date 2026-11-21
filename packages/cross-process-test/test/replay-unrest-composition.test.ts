import { describe, expect, it } from "vite-plus/test";

import { fleetManagementOptions } from "../src/replay-corpus/corpus.js";
import { REPLAY_SCENARIOS } from "../src/replay-corpus/index.js";

describe("corpus composition carries the unrest rules production wires", () => {
  it("passes unrest rules by default", () => {
    const unrest = fleetManagementOptions().unrest;
    expect(unrest).toBeDefined();
    expect(unrest?.revolutionThreshold).toBeGreaterThan(0);
  });

  it("passes the same unrest rules under every scenario setup", () => {
    const base = fleetManagementOptions().unrest;
    for (const scenario of REPLAY_SCENARIOS) {
      expect(
        fleetManagementOptions(scenario.playerNationId, scenario.setup).unrest,
        scenario.id,
      ).toEqual(base);
    }
  });
});
