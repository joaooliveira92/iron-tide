import { describe, expect, it } from "vite-plus/test";
import {
  KNOWN_MINEFIELD_VIEW_INVALID,
  decodeKnownMinefieldView,
  segmentCrossesMinefield,
  steerClearOfHazards,
  steerClearOfLand,
} from "@bluewave/combat/collision";
import type { TerrainView } from "@bluewave/combat/terrain";

const M = 1_000_000;

const field = decodeKnownMinefieldView({
  minefields: [{ id: "mf-1", xM: 650, yM: 0, radiusM: 100 }],
});

describe("known minefield view", () => {
  it("rejects excess properties, non-integers and non-positive radii", () => {
    const bad = [
      { minefields: [{ id: "a", xM: 0, yM: 0, radiusM: 10, hidden: true }] },
      { minefields: [{ id: "a", xM: 0.5, yM: 0, radiusM: 10 }] },
      { minefields: [{ id: "a", xM: 0, yM: 0, radiusM: 0 }] },
      { minefields: [{ id: "", xM: 0, yM: 0, radiusM: 10 }] },
      { minefields: [], extra: 1 },
      {
        minefields: [
          { id: "a", xM: 0, yM: 0, radiusM: 10 },
          { id: "a", xM: 5, yM: 5, radiusM: 1 },
        ],
      },
      null,
    ];
    for (const value of bad) {
      expect(() => decodeKnownMinefieldView(value)).toThrow(
        expect.objectContaining({ message: KNOWN_MINEFIELD_VIEW_INVALID }),
      );
    }
  });

  it("detects a segment that passes through, ends in, or only grazes a field", () => {
    expect(segmentCrossesMinefield(field, [0, 0], [1_000 * M, 0])).toBe(true);
    expect(segmentCrossesMinefield(field, [0, 0], [500 * M, 0])).toBe(false);
    expect(segmentCrossesMinefield(field, [0, 0], [650 * M, 0])).toBe(true);
    expect(segmentCrossesMinefield(field, [0, 100 * M], [1_000 * M, 100 * M])).toBe(true);
    expect(segmentCrossesMinefield(field, [0, 101 * M], [1_000 * M, 101 * M])).toBe(false);
    expect(segmentCrossesMinefield(field, [0, 0], [0, 0])).toBe(false);
  });
});

describe("minefield look-ahead", () => {
  it("keeps the heading when the next 60 seconds miss every known field", () => {
    expect(
      steerClearOfHazards({
        minefields: field,
        position: [0, 0],
        heading: 180,
        speedBp: 20_000,
      }),
    ).toBe(180);
  });

  it("turns away by the smallest angle, increasing heading first", () => {
    const turned = steerClearOfHazards({
      minefields: field,
      position: [0, 0],
      heading: 0,
      speedBp: 20_000,
    });
    expect(turned).toBeGreaterThan(0);
    expect(turned).toBeLessThan(90);
    expect(
      steerClearOfHazards({
        minefields: field,
        position: [0, 0],
        heading: turned - 1,
        speedBp: 20_000,
      }),
    ).toBe(turned);
  });

  it("keeps the heading for a stationary ship", () => {
    expect(
      steerClearOfHazards({ minefields: field, position: [0, 0], heading: 0, speedBp: 0 }),
    ).toBe(0);
  });

  it("avoids land and minefields together", () => {
    const terrain: TerrainView = {
      land: [
        {
          id: "north",
          vertices: [
            { xM: -2000, yM: 60 },
            { xM: 2000, yM: 60 },
            { xM: 2000, yM: 2000 },
            { xM: -2000, yM: 2000 },
          ],
        },
      ],
      shallows: [],
      exclusions: [],
    };
    const both = steerClearOfHazards({
      terrain,
      minefields: field,
      position: [0, 0],
      heading: 0,
      speedBp: 20_000,
    });
    const landOnly = steerClearOfLand({ terrain, position: [0, 0], heading: 0, speedBp: 20_000 });
    expect(landOnly).toBe(0);
    expect(both).not.toBe(0);
    expect(both).toBeGreaterThan(180);
  });

  it("leaves land-only steering unchanged when no minefield view is supplied", () => {
    expect(steerClearOfHazards({ position: [0, 0], heading: 37, speedBp: 20_000 })).toBe(37);
  });
});
