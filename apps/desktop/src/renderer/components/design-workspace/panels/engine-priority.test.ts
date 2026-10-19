import { describe, expect, it } from "vite-plus/test";
import { enginePriorityTrade } from "./engine-priority.js";

describe("enginePriorityTrade", () => {
  it("says balanced at 0 and names the direction and strength elsewhere", () => {
    expect(enginePriorityTrade(0)).toMatch(/^Balanced/);
    expect(enginePriorityTrade(5_000)).toMatch(/^50% toward speed.*breaks down more/);
    expect(enginePriorityTrade(-10_000)).toMatch(/^100% toward reliability.*heavier/);
  });
});
