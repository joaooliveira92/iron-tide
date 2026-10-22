import { describe, it, expect } from "vite-plus/test";
import {
  evaluateFireCreation,
  evaluateFloodingCreation,
  getFireRiskBp,
  SHIP_TYPE_FIRE_RISK_BP,
  type FireCreationInput,
  type FloodingCreationInput,
} from "@bluewave/combat/damage";
import { FIRE_SOURCE_CREATED, FLOODING_SOURCE_CREATED } from "@bluewave/combat/damage";

function rngThat(returnValues: Record<string, number>): (stream: string) => number {
  return (stream: string) => returnValues[stream] ?? 0.5;
}

describe("AC-5: Fire creation (§9)", () => {
  const validFireInput: FireCreationInput = {
    locationId: "COMP-1",
    penetrationOutcome: "FULL_PENETRATION",
    hitZoneType: "DECK",
    shipType: "ORDINARY",
    hasCombustible: true,
    hasOxygen: true,
  };

  it("creates fire with full penetration, combustible, oxygen, and RNG below threshold", () => {
    const result = evaluateFireCreation(validFireInput, rngThat({}));
    expect(result).not.toBeNull();
    expect(result!.locationId).toBe("COMP-1");
    expect(result!.intensityBp).toBeGreaterThanOrEqual(1);
    expect(result!.intensityBp).toBeLessThanOrEqual(10_000);
    expect(result!.cause).toBe(FIRE_SOURCE_CREATED);
  });

  it("uses keyed RNG stream 'battle/ship/damage/fire_creation'", () => {
    const streams: string[] = [];
    const trackingRng = (stream: string) => {
      streams.push(stream);
      return 0.0;
    };
    evaluateFireCreation(validFireInput, trackingRng);
    expect(streams).toContain("battle/ship/damage/fire_creation");
  });

  it("returns null when penetration outcome is not an ignition source", () => {
    const inputs: FireCreationInput[] = [
      { ...validFireInput, penetrationOutcome: "SPLINTER_EFFECT" },
      { ...validFireInput, penetrationOutcome: "NON_PENETRATION" },
      { ...validFireInput, penetrationOutcome: "BOUNCE" },
    ];
    for (const input of inputs) {
      expect(evaluateFireCreation(input, rngThat({}))).toBeNull();
    }
  });

  it("returns null when no combustible material", () => {
    const result = evaluateFireCreation({ ...validFireInput, hasCombustible: false }, rngThat({}));
    expect(result).toBeNull();
  });

  it("returns null when no oxygen", () => {
    const result = evaluateFireCreation({ ...validFireInput, hasOxygen: false }, rngThat({}));
    expect(result).toBeNull();
  });

  it("returns null when both combustible and oxygen are missing", () => {
    const result = evaluateFireCreation(
      { ...validFireInput, hasCombustible: false, hasOxygen: false },
      rngThat({}),
    );
    expect(result).toBeNull();
  });

  it("returns null when RNG draw exceeds ship-type fire risk", () => {
    const result = evaluateFireCreation(
      { ...validFireInput, shipType: "DESTROYER" },
      rngThat({ "battle/ship/damage/fire_creation": 0.9 }),
    );
    expect(result).toBeNull();
  });

  it("creates fire when RNG draw is below ship-type fire risk", () => {
    const result = evaluateFireCreation(
      { ...validFireInput, shipType: "DESTROYER" },
      rngThat({ "battle/ship/damage/fire_creation": 0.5 }),
    );
    expect(result).not.toBeNull();
  });

  it("critical penetration also qualifies as ignition source", () => {
    const result = evaluateFireCreation(
      { ...validFireInput, penetrationOutcome: "CRITICAL_PENETRATION" },
      rngThat({}),
    );
    expect(result).not.toBeNull();
  });
});

describe("AC-5: Ship-type fire-risk multipliers (§20)", () => {
  it("ORDINARY has 10_000 bp fire risk", () => {
    expect(SHIP_TYPE_FIRE_RISK_BP.ORDINARY).toBe(10_000);
  });

  it("CARRIER has 15_000 bp fire risk", () => {
    expect(SHIP_TYPE_FIRE_RISK_BP.CARRIER).toBe(15_000);
  });

  it("PRE_DREADNOUGHT has 12_000 bp fire risk", () => {
    expect(SHIP_TYPE_FIRE_RISK_BP.PRE_DREADNOUGHT).toBe(12_000);
  });

  it("unknown ship type defaults to 10_000 bp", () => {
    expect(getFireRiskBp("UNKNOWN")).toBe(10_000);
  });
});

describe("AC-5: Flooding creation (§9)", () => {
  const validFloodInput: FloodingCreationInput = {
    compartmentId: "COMP-1",
    penetrationOutcome: "FULL_PENETRATION",
    hullBreach: true,
    hasWaterRoute: true,
  };

  it("creates flooding with hull breach, full penetration, water route, and RNG below threshold", () => {
    const result = evaluateFloodingCreation(
      validFloodInput,
      rngThat({ "battle/ship/damage/flooding_creation": 0.0 }),
    );
    expect(result).not.toBeNull();
    expect(result!.compartmentId).toBe("COMP-1");
    expect(result!.rateKgMin).toBeGreaterThanOrEqual(0);
    expect(result!.cause).toBe(FLOODING_SOURCE_CREATED);
  });

  it("uses keyed RNG stream 'battle/ship/damage/flooding_creation'", () => {
    const streams: string[] = [];
    const trackingRng = (stream: string) => {
      streams.push(stream);
      return 0.0;
    };
    evaluateFloodingCreation(validFloodInput, trackingRng);
    expect(streams).toContain("battle/ship/damage/flooding_creation");
  });

  it("returns null when no hull breach", () => {
    const result = evaluateFloodingCreation({ ...validFloodInput, hullBreach: false }, rngThat({}));
    expect(result).toBeNull();
  });

  it("returns null when penetration outcome is not FULL_PENETRATION", () => {
    const inputs: FloodingCreationInput[] = [
      { ...validFloodInput, penetrationOutcome: "SPLINTER_EFFECT" },
      { ...validFloodInput, penetrationOutcome: "NON_PENETRATION" },
      { ...validFloodInput, penetrationOutcome: "CRITICAL_PENETRATION" },
    ];
    for (const input of inputs) {
      expect(evaluateFloodingCreation(input, rngThat({}))).toBeNull();
    }
  });

  it("returns null when no water route", () => {
    const result = evaluateFloodingCreation(
      { ...validFloodInput, hasWaterRoute: false },
      rngThat({}),
    );
    expect(result).toBeNull();
  });

  it("returns null when RNG draw exceeds flooding chance", () => {
    const result = evaluateFloodingCreation(
      validFloodInput,
      rngThat({ "battle/ship/damage/flooding_creation": 0.85 }),
    );
    expect(result).toBeNull();
  });

  it("creates flooding when RNG draw is below flooding chance threshold", () => {
    const result = evaluateFloodingCreation(
      validFloodInput,
      rngThat({ "battle/ship/damage/flooding_creation": 0.5 }),
    );
    expect(result).not.toBeNull();
  });

  it("returns null when both hull breach and water route are missing", () => {
    const result = evaluateFloodingCreation(
      { ...validFloodInput, hullBreach: false, hasWaterRoute: false },
      rngThat({}),
    );
    expect(result).toBeNull();
  });
});

describe("AC-5: A hit may create neither, one, or both effects (§9)", () => {
  it("creates fire but not flooding when only fire conditions are met", () => {
    const rng = rngThat({ "battle/ship/damage/fire_creation": 0.0 });
    const fireResult = evaluateFireCreation(
      {
        locationId: "COMP-1",
        penetrationOutcome: "FULL_PENETRATION",
        hitZoneType: "DECK",
        shipType: "ORDINARY",
        hasCombustible: true,
        hasOxygen: true,
      },
      rng,
    );
    expect(fireResult).not.toBeNull();

    const floodResult = evaluateFloodingCreation(
      {
        compartmentId: "COMP-1",
        penetrationOutcome: "FULL_PENETRATION",
        hullBreach: false,
        hasWaterRoute: true,
      },
      rng,
    );
    expect(floodResult).toBeNull();
  });

  it("creates neither fire nor flooding when conditions are absent", () => {
    const rng = rngThat({});
    const fireResult = evaluateFireCreation(
      {
        locationId: "COMP-1",
        penetrationOutcome: "NON_PENETRATION",
        hitZoneType: "BELT",
        shipType: "ORDINARY",
        hasCombustible: true,
        hasOxygen: true,
      },
      rng,
    );
    expect(fireResult).toBeNull();

    const floodResult = evaluateFloodingCreation(
      {
        compartmentId: "COMP-1",
        penetrationOutcome: "NON_PENETRATION",
        hullBreach: false,
        hasWaterRoute: true,
      },
      rng,
    );
    expect(floodResult).toBeNull();
  });
});
