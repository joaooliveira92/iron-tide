import { describe, expect, it } from "vite-plus/test";
import { decodeCoastline, encodeCoastline } from "./coastline-codec.js";

describe("coastline codec", () => {
  it("round-trips polygons with holes losslessly at 0.01° precision", () => {
    const polygons = [
      [
        [-180, -90, 180, -90, 180, 90, -180, 90, -180, -90],
        [0, 0, 1.25, 0, 1.25, 1.25, 0, 0],
      ],
      [[-0.01, 0.01, 0.02, -0.02, 10.5, 20.75, -0.01, 0.01]],
    ];
    expect(decodeCoastline(encodeCoastline(polygons).buffer as ArrayBuffer)).toEqual(polygons);
  });

  it("rejects data without the magic header", () => {
    expect(() => decodeCoastline(new ArrayBuffer(16))).toThrow(/coastline/i);
  });

  it("round-trips an empty set", () => {
    expect(decodeCoastline(encodeCoastline([]).buffer as ArrayBuffer)).toEqual([]);
  });
});
