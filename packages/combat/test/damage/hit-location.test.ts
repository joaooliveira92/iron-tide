//packages/combat/test/damage/hit-location.test.ts
// INC-3 — Hit location resolution (Stage 1). Proves AC-4.
import { describe, it, expect } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import { resolveHitLocation, type HitInput } from "../../src/damage/hitLocation.js";
import { DAMAGE_HIT_LOCATION_INVALID } from "../../src/damage/reasonCodes.js";
import { type CompartmentDef, type ArmorZoneDef } from "../../src/damage/shipLayout.js";

// ---------------------------------------------------------------------------
// Fixtures

/**
 * Simple 3-compartment ship layout:
 *   COMP-1: amidships, lower (z: 0-4000, x: 5000-15000, alt: 0-6000)
 *   COMP-2: aft, lower      (z: 0-4000, x: 0-4999, alt: 0-6000)
 *   COMP-3: forward, upper  (z: 4001-8000, x: 2000-12000, alt: 6001-12000)
 *
 * COMP-1 touches COMP-2 at x boundary (4999/5000) and COMP-3 at z boundary (4000/4001).
 */
const COMPARTMENTS: readonly CompartmentDef[] = [
  {
    id: "COMP-1",
    zMinMm: 0,
    zMaxMm: 4000,
    xMinMm: 5000,
    xMaxMm: 15000,
    altitudeMinMm: 0,
    altitudeMaxMm: 6000,
  },
  {
    id: "COMP-2",
    zMinMm: 0,
    zMaxMm: 4000,
    xMinMm: 0,
    xMaxMm: 5000,
    altitudeMinMm: 0,
    altitudeMaxMm: 6000,
  },
  {
    id: "COMP-3",
    zMinMm: 4000,
    zMaxMm: 8000,
    xMinMm: 2000,
    xMaxMm: 12000,
    altitudeMinMm: 6000,
    altitudeMaxMm: 12000,
  },
];

const ZONES: readonly ArmorZoneDef[] = [
  {
    id: "COMP-1",
    zoneType: "BELT",
    thicknessUm: 304_800,
    qualityFamily: "KRUPP_KC",
    slopeDeg: 0,
  },
  {
    id: "COMP-2",
    zoneType: "BELT",
    thicknessUm: 254_000,
    qualityFamily: "HARVEY",
    slopeDeg: 0,
  },
  {
    id: "COMP-3",
    zoneType: "DECK",
    thicknessUm: 76_200,
    qualityFamily: "HARVEY",
    slopeDeg: 0,
  },
];

// ---------------------------------------------------------------------------
// Tests

describe("INC-3: Hit location resolution (AC-4)", () => {
  it("hit lands in compartment → correct primary compartment returned", () => {
    const input: HitInput = {
      impactVerticalMm: 2000, // inside COMP-1 z range [0, 4000]
      impactLongitudinalMm: 10000, // inside COMP-1 x range [5000, 15000]
      impactAltitudeMm: 3000, // inside COMP-1 alt range [0, 6000]
      projectileTrajectoryDeg: 15,
      compartments: COMPARTMENTS,
      zones: ZONES,
    };
    const result = resolveHitLocation(input);
    expect(result.primaryCompartmentId).toBe("COMP-1");
    expect(result.hitZoneType).toBe("BELT");
    expect(result.hitZoneId).toBe("COMP-1");
  });

  it("hit at zone boundary → correct zone identified", () => {
    // Hit exactly at the boundary between COMP-2 (x up to 4999) and COMP-1 (x from 5000).
    const input: HitInput = {
      impactVerticalMm: 2000,
      impactLongitudinalMm: 5000, // Exactly at COMP-1 xMinMm — within COMP-1
      impactAltitudeMm: 3000,
      projectileTrajectoryDeg: 15,
      compartments: COMPARTMENTS,
      zones: ZONES,
    };
    const result = resolveHitLocation(input);
    expect(result.primaryCompartmentId).toBe("COMP-1");
    expect(result.hitZoneType).toBe("BELT");
  });

  it("adjacent compartments identified correctly", () => {
    // Hit in COMP-1; adjacent compartments should be COMP-2 (touches at x)
    // and COMP-3 (touches at z).
    const input: HitInput = {
      impactVerticalMm: 2000,
      impactLongitudinalMm: 10000,
      impactAltitudeMm: 3000,
      projectileTrajectoryDeg: 15,
      compartments: COMPARTMENTS,
      zones: ZONES,
    };
    const result = resolveHitLocation(input);
    expect(result.adjacentCompartmentIds).toContain("COMP-2");
    expect(result.adjacentCompartmentIds).toContain("COMP-3");
    expect(result.adjacentCompartmentIds).not.toContain("COMP-1");
  });

  it("hit misses all compartments → DAMAGE_HIT_LOCATION_INVALID", () => {
    const input: HitInput = {
      impactVerticalMm: 99999, // Way outside any compartment
      impactLongitudinalMm: 50000,
      impactAltitudeMm: 99999,
      projectileTrajectoryDeg: 15,
      compartments: COMPARTMENTS,
      zones: ZONES,
    };

    let err: BluewaveError | undefined;
    try {
      resolveHitLocation(input);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(DAMAGE_HIT_LOCATION_INVALID);
    expect(err!.context.code).toBe(DAMAGE_HIT_LOCATION_INVALID);
  });

  it("no convenience relocation — hit near but outside compartment", () => {
    // Hit at (z=4001, x=5000, alt=3000): z=4001 is just above COMP-1's zMaxMm=4000
    // and just below COMP-3's zMinMm=4001 — still outside everything.
    const input: HitInput = {
      impactVerticalMm: 4001, // Outside COMP-1 (zMaxMm=4000); would need zMinMm 4001 for COMP-3
      impactLongitudinalMm: 5000,
      impactAltitudeMm: 3000, // Outside COMP-3 (altMinMm=6001)
      projectileTrajectoryDeg: 15,
      compartments: COMPARTMENTS,
      zones: ZONES,
    };

    let err: BluewaveError | undefined;
    try {
      resolveHitLocation(input);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(DAMAGE_HIT_LOCATION_INVALID);
  });

  it("impact uses all three axes for compartment matching", () => {
    // This hits inside COMP-1's z and x ranges, but alt=6001 is above COMP-1's altMaxMm=6000.
    // Should NOT match COMP-1.
    const input: HitInput = {
      impactVerticalMm: 2000,
      impactLongitudinalMm: 10000,
      impactAltitudeMm: 6001, // Above COMP-1 alt max
      projectileTrajectoryDeg: 15,
      compartments: COMPARTMENTS,
      zones: ZONES,
    };

    let err: BluewaveError | undefined;
    try {
      resolveHitLocation(input);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(DAMAGE_HIT_LOCATION_INVALID);
  });

  it("hit in COMP-2 returns correct aft zone", () => {
    const input: HitInput = {
      impactVerticalMm: 2000,
      impactLongitudinalMm: 2500, // Inside COMP-2 x range [0, 4999]
      impactAltitudeMm: 3000,
      projectileTrajectoryDeg: 15,
      compartments: COMPARTMENTS,
      zones: ZONES,
    };
    const result = resolveHitLocation(input);
    expect(result.primaryCompartmentId).toBe("COMP-2");
    expect(result.hitZoneType).toBe("BELT");
  });

  it("hit in COMP-3 returns correct deck zone", () => {
    const input: HitInput = {
      impactVerticalMm: 6000, // Inside COMP-3 z range [4001, 8000]
      impactLongitudinalMm: 10000, // Inside COMP-3 x range [2000, 12000]
      impactAltitudeMm: 9000, // Inside COMP-3 alt range [6001, 12000]
      projectileTrajectoryDeg: 60,
      compartments: COMPARTMENTS,
      zones: ZONES,
    };
    const result = resolveHitLocation(input);
    expect(result.primaryCompartmentId).toBe("COMP-3");
    expect(result.hitZoneType).toBe("DECK");
  });
});
