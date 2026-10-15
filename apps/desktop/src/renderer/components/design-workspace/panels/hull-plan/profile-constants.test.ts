import { describe, expect, it } from "vite-plus/test";
import { PLAN_W, stationX } from "./geometry.js";
import {
  BOTTOM_PAD,
  LENGTH_PX,
  PROFILE_H,
  PROFILE_W,
  TOP_PAD,
  X_BOW,
  X_STERN,
  along,
} from "./profile-constants.js";

describe("profile constants", () => {
  it("shares the plan's width so both views align horizontally", () => {
    expect(PROFILE_W).toBe(PLAN_W);
    expect(X_BOW).toBe(stationX(0));
    expect(X_STERN).toBe(stationX(1000));
    expect(LENGTH_PX).toBe(X_STERN - X_BOW);
    expect(LENGTH_PX).toBeGreaterThan(0);
  });

  it("gives the drawing a positive height with room above and below", () => {
    expect(PROFILE_H).toBeGreaterThan(TOP_PAD + BOTTOM_PAD);
  });

  it("along maps a fraction of the waterline to px, without clamping", () => {
    expect(along(0)).toBe(0);
    expect(along(1)).toBe(LENGTH_PX);
    expect(along(0.5)).toBeCloseTo(LENGTH_PX / 2, 9);
    expect(along(2)).toBe(LENGTH_PX * 2);
  });
});
