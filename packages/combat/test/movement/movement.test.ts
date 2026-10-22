import { describe, it, expect } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import { assertFixedPointMovement, type MovementState } from "../../src/movement/index.js";

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

describe("AC-1 movement state invariant", () => {
  it("accepts a fully-integer MovementState", () => {
    expect(() => assertFixedPointMovement(base())).not.toThrow();
  });

  it("rejects a non-integer position", () => {
    const s = base();
    s.position[0] = 1.5;
    let err: BluewaveError | undefined;
    try {
      assertFixedPointMovement(s);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe("TACTICAL_STATE_INVARIANT_FAILED");
    expect(err!.context.field).toBe("positionX");
  });

  it("rejects a non-integer currentSpeed", () => {
    const s = base();
    s.currentSpeed = 10_000.5;
    let err: BluewaveError | undefined;
    try {
      assertFixedPointMovement(s);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe("TACTICAL_STATE_INVARIANT_FAILED");
    expect(err!.context.field).toBe("currentSpeed");
  });

  it("rejects out-of-range heading", () => {
    const s = base();
    s.heading = 360;
    let err: BluewaveError | undefined;
    try {
      assertFixedPointMovement(s);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe("TACTICAL_STATE_INVARIANT_FAILED");
    expect(err!.context.field).toBe("heading");
  });

  it("rejects a negative speed", () => {
    const s = base();
    s.currentSpeed = -1;
    let err: BluewaveError | undefined;
    try {
      assertFixedPointMovement(s);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe("TACTICAL_STATE_INVARIANT_FAILED");
  });

  it("is reversible-to-invariant (does not mutate input on failure)", () => {
    const s = base();
    s.heading = 400;
    const before = JSON.stringify(s);
    try {
      assertFixedPointMovement(s);
    } catch {}
    expect(JSON.stringify(s)).toBe(before);
  });
});
