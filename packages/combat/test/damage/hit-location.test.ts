import { describe, it, expect } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import { resolveHitLocation, type HitInput } from "@bluewave/combat/damage";
import { DAMAGE_HIT_LOCATION_INVALID } from "@bluewave/combat/damage";
import { type CompartmentDef, type ArmorZoneDef } from "@bluewave/combat/damage";

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

describe("INC-3: Hit location resolution (AC-4)", () => {
  it("hit lands in compartment → correct primary compartment returned", () => {
    const input: HitInput = {
      impactVerticalMm: 2000,
      impactLongitudinalMm: 10000,
      impactAltitudeMm: 3000,
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
    const input: HitInput = {
      impactVerticalMm: 2000,
      impactLongitudinalMm: 5000,
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
      impactVerticalMm: 99999,
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
    const input: HitInput = {
      impactVerticalMm: 4001,
      impactLongitudinalMm: 5000,
      impactAltitudeMm: 3000,
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
    const input: HitInput = {
      impactVerticalMm: 2000,
      impactLongitudinalMm: 10000,
      impactAltitudeMm: 6001,
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
      impactLongitudinalMm: 2500,
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
      impactVerticalMm: 6000,
      impactLongitudinalMm: 10000,
      impactAltitudeMm: 9000,
      projectileTrajectoryDeg: 60,
      compartments: COMPARTMENTS,
      zones: ZONES,
    };
    const result = resolveHitLocation(input);
    expect(result.primaryCompartmentId).toBe("COMP-3");
    expect(result.hitZoneType).toBe("DECK");
  });
});
