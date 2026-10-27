import { describe, expect, it } from "vite-plus/test";

import { cameraAltitudeMetres } from "./geo-math.js";
import {
  edgeIndicator,
  horizonAngleRadians,
  initialBearingDegrees,
  isBeyondHorizon,
} from "./horizon.js";

describe("horizon", () => {
  it("is zero on the surface and approaches 90 degrees far away", () => {
    expect(horizonAngleRadians(0)).toBe(0);
    expect(horizonAngleRadians(1e12) * (180 / Math.PI)).toBeGreaterThan(89.9);
  });

  it("culls points on the far side and keeps points near the centre", () => {
    const altitude = cameraAltitudeMetres(1.4, 30, 868);
    expect(isBeyondHorizon([10, 30], [10, 31], altitude)).toBe(false);
    expect(isBeyondHorizon([10, 30], [-170, -30], altitude)).toBe(true);
    expect(isBeyondHorizon([10, 30], [178.44, -18.14], altitude)).toBe(true);
  });

  it("flips exactly at the horizon angle and honours a hysteresis margin", () => {
    const altitude = cameraAltitudeMetres(2, 0, 868);
    const horizon = (horizonAngleRadians(altitude) * 180) / Math.PI;
    expect(isBeyondHorizon([0, 0], [horizon - 0.01, 0], altitude)).toBe(false);
    expect(isBeyondHorizon([0, 0], [horizon + 0.01, 0], altitude)).toBe(true);
    expect(isBeyondHorizon([0, 0], [horizon + 0.01, 0], altitude, 0.01)).toBe(false);
  });

  it("is deterministic across repeated calls", () => {
    const altitude = cameraAltitudeMetres(3, 45, 868);
    const first = [0, 1, 2, 3].map((n) => isBeyondHorizon([n, 45], [100 + n, 10], altitude));
    const second = [0, 1, 2, 3].map((n) => isBeyondHorizon([n, 45], [100 + n, 10], altitude));
    expect(second).toEqual(first);
  });
});

describe("bearings and edge indicators", () => {
  it("computes cardinal initial bearings", () => {
    expect(initialBearingDegrees([0, 0], [0, 10])).toBeCloseTo(0, 9);
    expect(initialBearingDegrees([0, 0], [10, 0])).toBeCloseTo(90, 9);
    expect(initialBearingDegrees([0, 0], [0, -10])).toBeCloseTo(180, 9);
    expect(initialBearingDegrees([0, 0], [-10, 0])).toBeCloseTo(270, 9);
  });

  it("places the indicator on the inset viewport edge in the target direction", () => {
    const viewport = { width: 1000, height: 600 };
    const east = edgeIndicator(90, 0, viewport, 20);
    expect(east.x).toBeCloseTo(980, 9);
    expect(east.y).toBeCloseTo(300, 9);
    const north = edgeIndicator(0, 0, viewport, 20);
    expect(north.x).toBeCloseTo(500, 9);
    expect(north.y).toBeCloseTo(20, 9);
  });

  it("rotates with the map bearing", () => {
    const viewport = { width: 1000, height: 600 };
    const rotated = edgeIndicator(90, 90, viewport, 20);
    expect(rotated.x).toBeCloseTo(500, 9);
    expect(rotated.y).toBeCloseTo(20, 9);
  });

  it("stays inside the viewport for every bearing", () => {
    const viewport = { width: 1000, height: 600 };
    for (let bearing = 0; bearing < 360; bearing += 7) {
      const result = edgeIndicator(bearing, 13, viewport, 24);
      expect(result.x).toBeGreaterThanOrEqual(24 - 1e-9);
      expect(result.x).toBeLessThanOrEqual(976 + 1e-9);
      expect(result.y).toBeGreaterThanOrEqual(24 - 1e-9);
      expect(result.y).toBeLessThanOrEqual(576 + 1e-9);
    }
  });
});
