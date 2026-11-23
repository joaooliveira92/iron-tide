import { describe, expect, it } from "vite-plus/test";
import { directionBp } from "@bluewave/combat/movement";
import { computeInitialMovementStates } from "@bluewave/combat/simulation";

const BBOX = { minX: 0, minY: 0, maxX: 20_000_000_000, maxY: 10_000_000_000 };

const unit = (assetId: string, sideId: "ATTACKER" | "DEFENDER") => ({
  assetId,
  sideId,
  orderedSpeedBpKnots: 1,
  designedSpeedBpKnots: 1,
  turningRateMdegS: 1,
});

const distanceUm = (a: readonly [number, number], b: readonly [number, number]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1]);

describe("computeInitialMovementStates short-range start", () => {
  const units = [
    unit("r", "ATTACKER"),
    unit("d1", "DEFENDER"),
    unit("d2", "DEFENDER"),
    unit("d3", "DEFENDER"),
    unit("d4", "DEFENDER"),
  ];

  it("changes nothing when no start range is given", () => {
    expect(computeInitialMovementStates(BBOX, units)).toEqual(
      computeInitialMovementStates(BBOX, units, undefined),
    );
  });

  it("places every opposing ship within the start range of the lead ship", () => {
    const startRangeUm = 4_000_000_000;
    const out = computeInitialMovementStates(BBOX, units, { startRangeUm });
    for (const id of ["d1", "d2", "d3", "d4"]) {
      expect(distanceUm(out.r!.position, out[id]!.position)).toBeLessThanOrEqual(startRangeUm);
    }
    expect(out.r!.position[0]).toBeLessThan(out.d1!.position[0]);
    expect(out.r!.heading).toBe(0);
    expect(out.d1!.heading).toBe(180);
  });

  it("keeps every pair within range when both lines are full", () => {
    const startRangeUm = 1_200_000_000;
    const attackers = ["a1", "a2", "a3", "a4"].map((id) => unit(id, "ATTACKER"));
    const defenders = ["d1", "d2", "d3", "d4"].map((id) => unit(id, "DEFENDER"));
    const out = computeInitialMovementStates(BBOX, [...attackers, ...defenders], {
      startRangeUm,
    });
    for (const a of attackers) {
      for (const d of defenders) {
        expect(distanceUm(out[a.assetId]!.position, out[d.assetId]!.position)).toBeLessThanOrEqual(
          startRangeUm,
        );
      }
    }
  });

  it("centres the engagement in the area", () => {
    const out = computeInitialMovementStates(BBOX, units, { startRangeUm: 4_000_000_000 });
    expect((out.r!.position[0] + out.d1!.position[0]) / 2).toBe(10_000_000_000);
  });
});

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
