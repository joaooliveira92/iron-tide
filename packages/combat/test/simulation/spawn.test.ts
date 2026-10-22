import { describe, expect, it } from "vite-plus/test";
import { directionBp } from "@bluewave/combat/movement";
import { computeInitialMovementStates } from "@bluewave/combat/simulation";

describe("computeInitialMovementStates heading convention", () => {
  const out = computeInitialMovementStates(
    { minX: 0, minY: 0, maxX: 20_000_000_000, maxY: 10_000_000_000 },
    [
      {
        assetId: "a",
        sideId: "ATTACKER",
        orderedSpeedBpKnots: 1,
        designedSpeedBpKnots: 1,
        turningRateMdegS: 1,
      },
      {
        assetId: "d",
        sideId: "DEFENDER",
        orderedSpeedBpKnots: 1,
        designedSpeedBpKnots: 1,
        turningRateMdegS: 1,
      },
    ],
  );
  it("attacker steams toward +X from the west edge, defender toward -X from the east edge", () => {
    expect(out.a!.heading).toBe(0);
    expect(out.d!.heading).toBe(180);
    expect(directionBp(out.a!.heading).cosBp).toBeGreaterThan(0);
    expect(directionBp(out.d!.heading).cosBp).toBeLessThan(0);
    expect(out.a!.position[0]).toBeLessThan(out.d!.position[0]);
  });
});
