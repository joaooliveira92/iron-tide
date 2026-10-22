import { describe, it, expect } from "vite-plus/test";
import { BluewaveError, isBluewaveError } from "@bluewave/contracts";
import {
  computeRadarFactorBp,
  INVALID_AIR_DEFENSE_STATE,
  isRadarDirectedMediumAaGroup,
  RADAR_MEDIUM_AA_DIMINISHING_RETURNS_ACTIVE,
  RADAR_MEDIUM_AA_REDUNDANT_GROUP_ACTIVE,
  radarMediumAaMarginalMultiplierBp,
  radarSaturationMarkers,
} from "../../src/air-defense/index.js";

const ALL_REQUIRED = {
  layer: "MEDIUM_AA" as const,
  radarFireControlOperational: true,
  radarChannelAssigned: true,
  directorOperational: true,
  ammunitionAvailable: true,
  powerAvailable: true,
  distinctEngagementChannel: true,
};

describe("AC-9: §13 radar-directed medium-AA group predicate", () => {
  it("returns true only when every §13 predicate holds", () => {
    expect(isRadarDirectedMediumAaGroup(ALL_REQUIRED)).toBe(true);
  });

  it("each of the seven predicates is independently required (missing any one → ordinary medium AA)", () => {
    expect(isRadarDirectedMediumAaGroup({ ...ALL_REQUIRED, layer: "HEAVY_AA" })).toBe(false);
    expect(
      isRadarDirectedMediumAaGroup({ ...ALL_REQUIRED, radarFireControlOperational: false }),
    ).toBe(false);
    expect(isRadarDirectedMediumAaGroup({ ...ALL_REQUIRED, radarChannelAssigned: false })).toBe(
      false,
    );
    expect(isRadarDirectedMediumAaGroup({ ...ALL_REQUIRED, directorOperational: false })).toBe(
      false,
    );
    expect(isRadarDirectedMediumAaGroup({ ...ALL_REQUIRED, ammunitionAvailable: false })).toBe(
      false,
    );
    expect(isRadarDirectedMediumAaGroup({ ...ALL_REQUIRED, powerAvailable: false })).toBe(false);
    expect(
      isRadarDirectedMediumAaGroup({ ...ALL_REQUIRED, distinctEngagementChannel: false }),
    ).toBe(false);
  });
});

describe("AC-9: §14 radar saturation factor schedule", () => {
  it("matches the canonical §14 marginal sums exactly: groups 1..9", () => {
    const expected = [10_000, 20_000, 30_000, 40_000, 45_000, 50_000, 52_500, 55_000, 55_500];
    expected.forEach((value, index) => {
      const count = index + 1;
      expect(computeRadarFactorBp(count)).toBe(value);
      expect(Number(computeRadarFactorBp(count)) / 10_000).toBe(value / 10_000);
    });
  });

  it("continues the closed form above the 9th group: every further marginal is the 9+ value 500", () => {
    expect(computeRadarFactorBp(12)).toBe(55_500 + 3 * 500);
    for (let count = 10; count <= 20; count++) {
      let manual = 0;
      for (let n = 1; n <= count; n++) {
        manual += radarMediumAaMarginalMultiplierBp(n);
      }
      expect(computeRadarFactorBp(count)).toBe(manual);
    }
  });

  it("embeds the exact §14 rational in the numerator — the owning formula divides by 10_000 once", () => {
    expect(computeRadarFactorBp(4) / 10_000).toBe(4.0);
    expect(computeRadarFactorBp(9) / 10_000).toBe(5.55);
    expect(computeRadarFactorBp(12) / 10_000).toBe(5.7);
  });

  it("returns the NEUTRAL consumer-side factor 10_000 for a ship with no radar-directed group", () => {
    expect(computeRadarFactorBp(0)).toBe(10_000);
  });

  it("emits §28 markers only in the documented regimes: 5..8 diminishing, 9+ redundant", () => {
    expect(radarSaturationMarkers(0)).toEqual([]);
    expect(radarSaturationMarkers(4)).toEqual([]);
    expect(radarSaturationMarkers(5)).toEqual([RADAR_MEDIUM_AA_DIMINISHING_RETURNS_ACTIVE]);
    expect(radarSaturationMarkers(8)).toEqual([RADAR_MEDIUM_AA_DIMINISHING_RETURNS_ACTIVE]);
    expect(radarSaturationMarkers(9)).toEqual([RADAR_MEDIUM_AA_REDUNDANT_GROUP_ACTIVE]);
    expect(radarSaturationMarkers(12)).toEqual([RADAR_MEDIUM_AA_REDUNDANT_GROUP_ACTIVE]);
  });

  it("fails closed on a negative or non-integer group count with INVALID_AIR_DEFENSE_STATE", () => {
    let caught: unknown;
    try {
      computeRadarFactorBp(-1);
    } catch (e) {
      caught = e;
    }
    expect(isBluewaveError(caught)).toBe(true);
    expect((caught as BluewaveError).context.code).toBe(INVALID_AIR_DEFENSE_STATE);

    expect(() => computeRadarFactorBp(1.5)).toThrow(BluewaveError);
    expect(() => computeRadarFactorBp(Number.NaN)).toThrow(BluewaveError);
    expect(() => radarSaturationMarkers(-2)).toThrow(BluewaveError);
    expect(() => radarSaturationMarkers(3.5)).toThrow(BluewaveError);
  });
});
