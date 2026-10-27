import { describe, expect, it } from "vite-plus/test";

import {
  BLEND_END_ZOOM,
  BLEND_START_ZOOM,
  EARTH_RADIUS_METRES,
  cameraAltitudeMetres,
  globeBlend,
  greatCircleAngleRadians,
  lonLatToMercatorPixel,
  lonLatToSphere,
  maxSegmentAngleRadians,
  mercatorPixelToLonLat,
  metresPerPixel,
  normalizeLongitude,
  sphereToLonLat,
  subdivideRhumb,
  subdivisionCount,
  zoomForCameraAltitude,
} from "./geo-math.js";
import { GeoMathError } from "./globe-spike-errors.js";

const LATITUDES = [0, 30, 60, 75, -45];
const ZOOMS = [0, 1.4, 5, 11, 11.5, 12, 14, 18, 22];

describe("camera altitude and zoom", () => {
  it("round-trips zoom through altitude to better than 1e-12", () => {
    for (const latitude of LATITUDES) {
      for (const zoom of ZOOMS) {
        const altitude = cameraAltitudeMetres(zoom, latitude, 900);
        expect(Math.abs(zoomForCameraAltitude(altitude, latitude, 900) - zoom)).toBeLessThan(1e-12);
      }
    }
  });

  it("halves metres per pixel for each zoom level and scales with cos(latitude)", () => {
    expect(metresPerPixel(5, 0) / metresPerPixel(6, 0)).toBeCloseTo(2, 12);
    expect(metresPerPixel(8, 60) / metresPerPixel(8, 0)).toBeCloseTo(0.5, 12);
  });

  it("needs a higher camera for the same zoom at a larger viewport", () => {
    expect(cameraAltitudeMetres(10, 0, 1800)).toBeCloseTo(2 * cameraAltitudeMetres(10, 0, 900), 6);
  });
});

describe("sphere and Mercator conversions", () => {
  it("round-trips lon/lat through the unit sphere", () => {
    for (const [lon, lat] of [
      [0, 0],
      [-5.35, 36.14],
      [179.9, -60],
      [139.65, 35.45],
      [-157.86, 78],
    ] as const) {
      const [backLon, backLat] = sphereToLonLat(lonLatToSphere(lon, lat));
      expect(backLon).toBeCloseTo(lon, 9);
      expect(backLat).toBeCloseTo(lat, 9);
    }
  });

  it("keeps unit length on the sphere", () => {
    const [x, y, z] = lonLatToSphere(33.08, 68.97);
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 14);
  });

  it("round-trips lon/lat through Mercator pixels at every zoom", () => {
    for (const zoom of ZOOMS) {
      const [x, y] = lonLatToMercatorPixel(14.51, 35.9, zoom);
      const [lon, lat] = mercatorPixelToLonLat(x, y, zoom);
      expect(lon).toBeCloseTo(14.51, 8);
      expect(lat).toBeCloseTo(35.9, 8);
    }
  });

  it("clamps latitudes beyond the Mercator limit instead of returning infinity", () => {
    const [, y] = lonLatToMercatorPixel(0, 90, 3);
    expect(Number.isFinite(y)).toBe(true);
  });

  it("agrees with the sphere at the camera centre scale", () => {
    const a = greatCircleAngleRadians([0, 0], [0, 1]) * EARTH_RADIUS_METRES;
    expect(a).toBeCloseTo((Math.PI / 180) * EARTH_RADIUS_METRES, 3);
  });
});

describe("globe blend", () => {
  it("is 1 below the start, 0 above the end, and 0.5 midway", () => {
    expect(globeBlend(BLEND_START_ZOOM - 3)).toBe(1);
    expect(globeBlend(BLEND_START_ZOOM)).toBe(1);
    expect(globeBlend((BLEND_START_ZOOM + BLEND_END_ZOOM) / 2)).toBe(0.5);
    expect(globeBlend(BLEND_END_ZOOM)).toBe(0);
    expect(globeBlend(BLEND_END_ZOOM + 5)).toBe(0);
  });

  it("is monotonically non-increasing in zoom", () => {
    let previous = 1;
    for (let zoom = 0; zoom <= 20; zoom += 0.05) {
      const value = globeBlend(zoom);
      expect(value).toBeLessThanOrEqual(previous);
      previous = value;
    }
  });

  it("is a pure function of zoom, so a zoom-in/out cycle returns identical blend values", () => {
    const path = [10, 10.5, 11, 11.25, 11.5, 11.75, 12, 12.5];
    const forward = path.map((zoom) => globeBlend(zoom));
    const backward = [...path]
      .reverse()
      .map((zoom) => globeBlend(zoom))
      .reverse();
    expect(backward).toEqual(forward);
  });

  it("honours an adjustable range and rejects an empty one", () => {
    expect(globeBlend(10.75, { start: 10.5, end: 11 })).toBeCloseTo(0.5, 12);
    expect(() => globeBlend(10, { start: 12, end: 12 })).toThrow(GeoMathError);
  });
});

describe("dateline normalisation", () => {
  it("wraps longitudes into [-180, 180)", () => {
    expect(normalizeLongitude(190)).toBe(-170);
    expect(normalizeLongitude(-190)).toBe(170);
    expect(normalizeLongitude(-220.35)).toBeCloseTo(139.65, 12);
    expect(normalizeLongitude(360)).toBe(0);
    expect(normalizeLongitude(540)).toBe(180);
    expect(normalizeLongitude(-180)).toBe(-180);
  });

  it("is idempotent", () => {
    for (const lon of [-721, -180, -0.5, 0, 179.999, 180, 181, 1000]) {
      expect(normalizeLongitude(normalizeLongitude(lon))).toBe(normalizeLongitude(lon));
    }
  });

  it("rejects non-finite input", () => {
    expect(() => normalizeLongitude(Number.NaN)).toThrow(GeoMathError);
  });
});

describe("subdivision error budget", () => {
  it("matches the measured numerics at a 0.25 px error limit", () => {
    const equatorZ12 = (maxSegmentAngleRadians(12, 0, 0.25) * 180) / Math.PI;
    const latitude60Z12 = (maxSegmentAngleRadians(12, 60, 0.25) * 180) / Math.PI;
    expect(equatorZ12).toBeCloseTo(0.1403, 3);
    expect(latitude60Z12).toBeCloseTo(0.09917, 4);
  });

  it("produces more segments at higher zoom and never fewer than one", () => {
    const length = greatCircleAngleRadians([-4.14, 50.37], [-63.57, 44.65]);
    const coarse = subdivisionCount(length, 2, 47, 0.25);
    const fine = subdivisionCount(length, 10, 47, 0.25);
    expect(fine).toBeGreaterThan(coarse);
    expect(subdivisionCount(0, 5, 0, 0.25)).toBe(1);
  });

  it("subdivides deterministically with shared endpoints", () => {
    const a = subdivideRhumb([-4.14, 50.37], [-63.57, 44.65], 12);
    const b = subdivideRhumb([-4.14, 50.37], [-63.57, 44.65], 12);
    expect(a).toEqual(b);
    expect(a[0]).toEqual([-4.14, 50.37]);
    expect(a[12]?.[0]).toBeCloseTo(-63.57, 12);
    expect(a[12]?.[1]).toBeCloseTo(44.65, 9);
  });
});
