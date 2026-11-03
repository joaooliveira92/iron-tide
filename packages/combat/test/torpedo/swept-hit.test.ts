import { describe, it, expect } from "vite-plus/test";
import {
  intersectsCollisionGeometry,
  sweptPathIntersectsCollisionGeometry,
} from "@bluewave/combat/torpedoes";

const M = 1_000_000;

describe("sweptPathIntersectsCollisionGeometry", () => {
  it("hits a target crossed mid-segment that the end-point test misses", () => {
    const from: [number, number] = [0, 0];
    const to: [number, number] = [1_000 * M, 0];
    const centre: [number, number] = [500 * M, 40 * M];
    expect(intersectsCollisionGeometry(to, centre, 50)).toBe(false);
    expect(sweptPathIntersectsCollisionGeometry(from, to, centre, 50)).toBe(true);
  });

  it("misses when the segment passes outside the radius", () => {
    expect(
      sweptPathIntersectsCollisionGeometry([0, 0], [1_000 * M, 0], [500 * M, 60 * M], 50),
    ).toBe(false);
  });

  it("does not hit targets behind the start or beyond the end", () => {
    expect(sweptPathIntersectsCollisionGeometry([0, 0], [100 * M, 0], [-80 * M, 0], 50)).toBe(
      false,
    );
    expect(sweptPathIntersectsCollisionGeometry([0, 0], [100 * M, 0], [200 * M, 0], 50)).toBe(
      false,
    );
  });

  it("degenerates to the point test for a zero-length segment and is inclusive on the radius", () => {
    expect(sweptPathIntersectsCollisionGeometry([0, 0], [0, 0], [50 * M, 0], 50)).toBe(true);
    expect(sweptPathIntersectsCollisionGeometry([0, 0], [0, 0], [51 * M, 0], 50)).toBe(false);
  });
});
