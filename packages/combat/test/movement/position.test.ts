import { describe, it, expect } from "vite-plus/test";
import {
  advancePosition,
  resolvePropulsion,
  resolveTurning,
  reciprocalCourse,
  resolveCollisionsGrounding,
  type MovementState,
} from "../../src/movement/index.js";

function base(): MovementState {
  return {
    position: [0, 0],
    heading: 0,
    orderedSpeed: 10_000,
    currentSpeed: 10_000,
    acceleration: 0,
    turningRate: 1_000,
    collisionRadius: 5_000_000,
    propulsionState: "steam",
    machineryReliability: 10_000,
    fuelState: "coal",
    formationStation: "LEAD",
  };
}

describe("AC-2 position advance", () => {
  it("advances deterministically along heading 0 (east) at constant speed", () => {
    const s = base();
    const pos = advancePosition({ state: s, dtSeconds: 60 });
    expect(Number.isInteger(pos[0])).toBe(true);
    expect(pos[1]).toBe(0);
    expect(pos[0]).toBe(10 * 514444 * 60);
  });

  it("advances north (heading 90) along y", () => {
    const s = base();
    s.heading = 90;
    const pos = advancePosition({ state: s, dtSeconds: 60 });
    expect(Math.abs(pos[0])).toBeLessThanOrEqual(1);
    expect(pos[1]).toBeGreaterThan(0);
  });

  it("is reversible-to-invariant (input state unchanged)", () => {
    const s = base();
    const before = JSON.stringify(s);
    advancePosition({ state: s, dtSeconds: 60 });
    expect(JSON.stringify(s)).toBe(before);
  });

  it("rejects a non-positive dt", () => {
    const s = base();
    let err: Error | undefined;
    try {
      advancePosition({ state: s, dtSeconds: 0 });
    } catch (e) {
      err = e as Error;
    }
    expect(err).toBeDefined();
  });
});

describe("AC-3 propulsion", () => {
  it("approaches orderedSpeed at bounded thrust acceleration", () => {
    const next = resolvePropulsion({ currentSpeed: 0, orderedSpeed: 20_000, dtSeconds: 60 });
    expect(next).toBe(0 + 40 * 60);
    expect(next).toBeLessThan(20_000);
  });

  it("holds speed at orderedSpeed without overshoot", () => {
    const next = resolvePropulsion({ currentSpeed: 10_000, orderedSpeed: 10_000, dtSeconds: 60 });
    expect(next).toBe(10_000);
  });

  it("brakes toward a lower orderedSpeed", () => {
    const next = resolvePropulsion({ currentSpeed: 20_000, orderedSpeed: 10_000, dtSeconds: 10 });
    expect(next).toBe(20_000 - 60 * 10);
  });

  it("clamps at attainable max", () => {
    const next = resolvePropulsion({
      currentSpeed: 19_400,
      orderedSpeed: 25_000,
      dtSeconds: 10,
      attainableMaxBpKnots: 19_500,
    });
    expect(next).toBe(19_500);
  });
});

describe("AC-4 turning", () => {
  it("rate-limits heading toward orderedHeading", () => {
    const next = resolveTurning({
      heading: 0,
      orderedHeading: 90,
      dtSeconds: 10,
      turningRateMdegS: 1_000,
    });
    expect(next).toBe(10);
  });

  it("reaches orderedHeading when time is sufficient", () => {
    const next = resolveTurning({
      heading: 0,
      orderedHeading: 90,
      dtSeconds: 120,
      turningRateMdegS: 1_000,
    });
    expect(next).toBe(90);
  });

  it("turns the shorter way (from 350 to 10)", () => {
    const next = resolveTurning({
      heading: 350,
      orderedHeading: 10,
      dtSeconds: 60,
      turningRateMdegS: 1_000,
    });
    expect(next).toBe(10);
  });

  it("reciprocal course is exactly 180 degrees away (battleTurnAway reuse)", () => {
    expect(reciprocalCourse(60)).toBe(240);
    expect(reciprocalCourse(0)).toBe(180);
  });
});

describe("AC-6 collisions/grounding hook", () => {
  it("emits a successful empty record with no partial mutation", () => {
    const r = resolveCollisionsGrounding();
    expect(r.phase).toBe("resolve_collisions_grounding");
    expect(r.success).toBe(true);
    expect(r.empty).toBe(true);
    expect(r.records).toEqual([]);
  });
});
