import { describe, it, expect } from "vite-plus/test";
import {
  evaluateMagazineHazard,
  isMagazineZoneType,
  type MagazineHazardInput,
} from "@bluewave/combat/damage";

function rngThat(returnValues: Record<string, number>): (stream: string) => number {
  return (stream: string) => returnValues[stream] ?? 0.5;
}

describe("AC-5: Magazine zone type detection", () => {
  it("recognizes MAGAZINE as a magazine zone type", () => {
    expect(isMagazineZoneType("MAGAZINE")).toBe(true);
  });

  it("recognizes SHELL_ROOM as a magazine zone type", () => {
    expect(isMagazineZoneType("SHELL_ROOM")).toBe(true);
  });

  it("recognizes PROPELLANT_MAGAZINE as a magazine zone type", () => {
    expect(isMagazineZoneType("PROPELLANT_MAGAZINE")).toBe(true);
  });

  it("recognizes AMMUNITION_HOLD as a magazine zone type", () => {
    expect(isMagazineZoneType("AMMUNITION_HOLD")).toBe(true);
  });

  it("returns false for non-magazine zone types", () => {
    expect(isMagazineZoneType("BELT")).toBe(false);
    expect(isMagazineZoneType("DECK")).toBe(false);
    expect(isMagazineZoneType("TURRET_FACE")).toBe(false);
    expect(isMagazineZoneType("SUPERSTRUCTURE")).toBe(false);
    expect(isMagazineZoneType("")).toBe(false);
  });
});

describe("AC-5: Magazine hazard evaluation (§10)", () => {
  const validMagazineInput: MagazineHazardInput = {
    hasMagazineInZone: true,
    penetrationOutcome: "FULL_PENETRATION",
    hitZoneType: "MAGAZINE",
  };

  it("triggers detonation with full penetration of magazine zone and RNG below threshold", () => {
    const result = evaluateMagazineHazard(
      validMagazineInput,
      rngThat({ "battle/ship/damage/magazine": 0.0 }),
    );
    expect(result.magazineDetonated).toBe(true);
    expect(result.hazardType).toBe("MAGAZINE_DETONATION");
    expect(result.structuralDamage).toBeGreaterThan(0);
    expect(result.flotationDamage).toBeGreaterThan(0);
  });

  it("uses keyed RNG stream 'battle/ship/damage/magazine'", () => {
    const streams: string[] = [];
    const trackingRng = (stream: string) => {
      streams.push(stream);
      return 0.0;
    };
    evaluateMagazineHazard(validMagazineInput, trackingRng);
    expect(streams).toContain("battle/ship/damage/magazine");
  });

  it("returns no detonation when no magazine in zone", () => {
    const result = evaluateMagazineHazard(
      { ...validMagazineInput, hasMagazineInZone: false },
      rngThat({}),
    );
    expect(result.magazineDetonated).toBe(false);
    expect(result.hazardType).toBe("NONE");
    expect(result.structuralDamage).toBe(0);
    expect(result.flotationDamage).toBe(0);
  });

  it("returns no detonation for non-magazine zone type", () => {
    const result = evaluateMagazineHazard(
      { ...validMagazineInput, hitZoneType: "BELT" },
      rngThat({}),
    );
    expect(result.magazineDetonated).toBe(false);
    expect(result.hazardType).toBe("NONE");
  });

  it("returns no detonation for non-penetration outcome", () => {
    const inputs: MagazineHazardInput[] = [
      { ...validMagazineInput, penetrationOutcome: "SPLINTER_EFFECT" },
      { ...validMagazineInput, penetrationOutcome: "NON_PENETRATION" },
      { ...validMagazineInput, penetrationOutcome: "BOUNCE" },
    ];
    for (const input of inputs) {
      const result = evaluateMagazineHazard(input, rngThat({}));
      expect(result.magazineDetonated).toBe(false);
      expect(result.hazardType).toBe("NONE");
    }
  });

  it("critical penetration also qualifies for detonation risk", () => {
    const result = evaluateMagazineHazard(
      { ...validMagazineInput, penetrationOutcome: "CRITICAL_PENETRATION" },
      rngThat({ "battle/ship/damage/magazine": 0.0 }),
    );
    expect(result.magazineDetonated).toBe(true);
  });

  it("returns no detonation when RNG draw exceeds detonation threshold", () => {
    const result = evaluateMagazineHazard(
      validMagazineInput,
      rngThat({ "battle/ship/damage/magazine": 0.85 }),
    );
    expect(result.magazineDetonated).toBe(false);
    expect(result.hazardType).toBe("NONE");
  });

  it("detonation produces consistent structural and flotation damage", () => {
    const result = evaluateMagazineHazard(
      validMagazineInput,
      rngThat({ "battle/ship/damage/magazine": 0.0 }),
    );
    expect(result.magazineDetonated).toBe(true);
    expect(result.structuralDamage).toBe(50_000);
    expect(result.flotationDamage).toBe(30_000);
  });

  it("handles AMMUNITION_HOLD zone type correctly", () => {
    const result = evaluateMagazineHazard(
      { ...validMagazineInput, hitZoneType: "AMMUNITION_HOLD" },
      rngThat({ "battle/ship/damage/magazine": 0.0 }),
    );
    expect(result.magazineDetonated).toBe(true);
  });
});

describe("AC-5: Deferred hazard types (M3/C-5)", () => {
  it("only MAGAZINE_DETONATION or NONE are returned as hazard types", () => {
    const validTypes: string[] = [];
    const result = evaluateMagazineHazard(
      {
        hasMagazineInZone: true,
        penetrationOutcome: "FULL_PENETRATION",
        hitZoneType: "MAGAZINE",
      },
      rngThat({ "battle/ship/damage/magazine": 0.0 }),
    );
    validTypes.push(result.hazardType);

    const noResult = evaluateMagazineHazard(
      { hasMagazineInZone: false, penetrationOutcome: "FULL_PENETRATION", hitZoneType: "BELT" },
      rngThat({}),
    );
    validTypes.push(noResult.hazardType);
    validTypes.push("NONE");

    for (const t of validTypes) {
      expect(["MAGAZINE_DETONATION", "NONE"]).toContain(t);
    }
  });
});
