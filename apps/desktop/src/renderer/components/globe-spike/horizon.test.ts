import { describe, expect, it } from "vite-plus/test";

import { cameraAltitudeMetres } from "./geo-math.js";
import { lonLatToSphere } from "./geo-math.js";
import {
  HORIZON_TOLERANCE_RADIANS,
  cameraDistanceInSphereRadii,
  cameraPositionInSphereRadii,
  classifyHorizon,
  edgeIndicator,
  horizonAngleRadians,
  horizonMarginRadians,
  initialBearingDegrees,
  isBeyondHorizon,
  projectionMode,
  type GlobeCamera,
  type LonLat,
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

function segmentReachesPointUnobstructed(camera: GlobeCamera, point: LonLat): boolean {
  const cam = cameraPositionInSphereRadii(camera);
  const p = lonLatToSphere(point[0], point[1]);
  const dx = p[0] - cam[0];
  const dy = p[1] - cam[1];
  const dz = p[2] - cam[2];
  const a = dx * dx + dy * dy + dz * dz;
  const b = 2 * (cam[0] * dx + cam[1] * dy + cam[2] * dz);
  const c = cam[0] * cam[0] + cam[1] * cam[1] + cam[2] * cam[2] - 1;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return false;
  const nearRoot = (-b - Math.sqrt(discriminant)) / (2 * a);
  return nearRoot >= 1 - 1e-9;
}

function lcg(seed: number): () => number {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

describe("globe horizon visibility", () => {
  const base: GlobeCamera = {
    centre: [10, 30],
    zoom: 2,
    pitchDegrees: 0,
    bearingDegrees: 0,
    viewportHeightPx: 868,
  };

  it("matches the closed-form cone for a camera straight above the centre", () => {
    const distance = cameraDistanceInSphereRadii(base);
    const expected = Math.acos(1 / (1 + distance));
    const sub: LonLat = [10, 30];
    expect(horizonMarginRadians(base, sub)).toBeCloseTo(-expected, 12);
    const onLimb: LonLat = [10, 30 + (expected * 180) / Math.PI];
    expect(horizonMarginRadians(base, onLimb)).toBeCloseTo(0, 12);
  });

  it("has a camera distance that follows the documented zoom and field-of-view relation", () => {
    const doubled = cameraDistanceInSphereRadii({ ...base, zoom: base.zoom + 1 });
    expect(doubled).toBeCloseTo(cameraDistanceInSphereRadii(base) / 2, 12);
    const wide = cameraDistanceInSphereRadii({ ...base, fovRadians: 1.2 });
    const narrow = cameraDistanceInSphereRadii({ ...base, fovRadians: 0.5 });
    expect(narrow).toBeGreaterThan(wide);
  });

  it("is invariant to bearing when the camera looks straight down", () => {
    const margins = [0, 77, 181, 359].map((bearingDegrees) =>
      horizonMarginRadians({ ...base, bearingDegrees }, [100, -20]),
    );
    for (const margin of margins) expect(margin).toBeCloseTo(margins[0] ?? 0, 12);
  });

  it("moves the visible cap away from the centre when the camera is pitched", () => {
    const flat = cameraPositionInSphereRadii(base);
    const pitched = cameraPositionInSphereRadii({ ...base, pitchDegrees: 60 });
    const flatDirection = lonLatToSphere(10, 30);
    const cosine =
      (pitched[0] * flatDirection[0] +
        pitched[1] * flatDirection[1] +
        pitched[2] * flatDirection[2]) /
      Math.hypot(pitched[0], pitched[1], pitched[2]);
    expect(Math.acos(cosine)).toBeGreaterThan(0.05);
    expect(Math.hypot(...flat)).not.toBeCloseTo(Math.hypot(...pitched), 3);
  });

  it("disagrees with the centre-only cone by more than a degree at 60 degrees of pitch", () => {
    const pitched = { ...base, zoom: 1.4, pitchDegrees: 60 };
    const legacyAltitude = cameraDistanceInSphereRadii(pitched) * 6371008.8;
    let widestDisagreementDegrees = 0;
    for (let bearing = 0; bearing < 360; bearing += 5) {
      const camera = { ...pitched, bearingDegrees: bearing };
      for (let angle = 40; angle <= 100; angle += 0.25) {
        const radians = (bearing * Math.PI) / 180;
        const point: LonLat = [
          10 + angle * Math.sin(radians),
          Math.max(-89, Math.min(89, 30 + angle * Math.cos(radians))),
        ];
        const legacyBeyond = isBeyondHorizon(camera.centre, point, legacyAltitude);
        const exactBeyond = classifyHorizon(camera, point) === "back";
        if (legacyBeyond !== exactBeyond) {
          widestDisagreementDegrees = Math.max(
            widestDisagreementDegrees,
            Math.abs((horizonMarginRadians(camera, point) * 180) / Math.PI),
          );
        }
      }
    }
    expect(widestDisagreementDegrees).toBeGreaterThan(1);
  });

  it("agrees with an independent ray-casting test across altitudes, latitudes, bearings, pitches and fields of view", () => {
    const next = lcg(20260427);
    let checked = 0;
    let transitional = 0;
    for (let index = 0; index < 4000; index++) {
      const camera: GlobeCamera = {
        centre: [next() * 360 - 180, next() * 170 - 85],
        zoom: next() * 10,
        pitchDegrees: next() * 60,
        bearingDegrees: next() * 360,
        viewportHeightPx: 400 + next() * 1200,
        fovRadians: ((20 + next() * 50) * Math.PI) / 180,
      };
      const point: LonLat = [next() * 360 - 180, next() * 178 - 89];
      const margin = horizonMarginRadians(camera, point);
      if (Math.abs(margin) < 1e-7) {
        transitional += 1;
        continue;
      }
      const reference = segmentReachesPointUnobstructed(camera, point);
      expect(margin < 0).toBe(reference);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(3900);
    expect(transitional).toBeLessThan(100);
  });

  it("classifies front, horizon and back around the tolerance", () => {
    const distance = cameraDistanceInSphereRadii(base);
    const limbDegrees = (Math.acos(1 / (1 + distance)) * 180) / Math.PI;
    const toleranceDegrees = (HORIZON_TOLERANCE_RADIANS * 180) / Math.PI;
    expect(classifyHorizon(base, [10, 30 + limbDegrees - 2 * toleranceDegrees])).toBe("front");
    expect(classifyHorizon(base, [10, 30 + limbDegrees])).toBe("horizon");
    expect(classifyHorizon(base, [10, 30 + limbDegrees + 2 * toleranceDegrees])).toBe("back");
    expect(classifyHorizon(base, [-170, -30])).toBe("back");
    expect(classifyHorizon(base, [10, 30])).toBe("front");
  });

  it("changes class monotonically while a point rotates across the limb", () => {
    let previous = -1;
    let flips = 0;
    const order = { front: 0, horizon: 1, back: 2 } as const;
    for (let step = 0; step <= 2000; step++) {
      const longitude = 10 + step * 0.05;
      const current = order[classifyHorizon(base, [longitude, 30])];
      if (previous !== -1 && current !== previous) flips += 1;
      previous = current;
      if (longitude > 190) break;
    }
    expect(flips).toBeLessThanOrEqual(2);
  });

  it("separates the geometric horizon from the projection mode", () => {
    expect(projectionMode(3)).toBe("globe");
    expect(projectionMode(11)).toBe("globe");
    expect(projectionMode(11.5)).toBe("transition");
    expect(projectionMode(12)).toBe("planar");
    const deep = { ...base, zoom: 12.5 };
    expect(classifyHorizon(deep, [10.01, 30.01])).toBe("front");
    expect(classifyHorizon(deep, [190, -30])).toBe("back");
  });
});
