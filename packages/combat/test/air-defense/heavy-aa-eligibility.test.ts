// packages/combat/test/air-defense/heavy-aa-eligibility.test.ts
// AC-4: Heavy AA protects own ship + 5nm protected radius (DESIGN-45 §7).

import { describe, it, expect } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import {
  AttackType,
  Category,
  createAirDefenseAttack,
  createAirDefenseSystemDefinition,
  HEAVY_AA_PROTECTED_RADIUS_M,
  isHeavyAaEligible,
  Layer,
  AIR_DEFENSE_AMMUNITION_UNAVAILABLE,
  AIR_DEFENSE_DIRECTOR_UNAVAILABLE,
  AIR_DEFENSE_RADAR_UNAVAILABLE,
  AIR_DEFENSE_TARGET_INELIGIBLE,
  HEAVY_AA_PROTECTED_RADIUS_EXCEEDED,
} from "../../src/air-defense/index.js";

const OPERABLE = {
  defenderSunk: false,
  defenderAbandoned: false,
  systemPowered: true,
  systemOperational: true,
};

type SysOverrides = Partial<Parameters<typeof createAirDefenseSystemDefinition>[0]>;
type AtkOverrides = Partial<Parameters<typeof createAirDefenseAttack>[0]>;

function heavyAaSystem(overrides: SysOverrides = {}) {
  return createAirDefenseSystemDefinition({
    systemId: "sys_heavy",
    layer: Layer.HEAVY_AA,
    category: Category.HEAVY_AA,
    rangeMinM: SafeInt(0),
    rangeMaxM: SafeInt(20_000),
    altitudeMinM: SafeInt(0),
    altitudeMaxM: SafeInt(10_000),
    targetSpeedLimitMps: SafeInt(500),
    arcDegreesMax: SafeInt(360),
    profileEligibility: new Set([
      "AIRCRAFT_LEVEL_BOMBING",
      "AIRCRAFT_ROCKET_ATTACK",
      "AIRCRAFT_GUIDED_WEAPON_ATTACK",
      "ANTI_RADIATION_WEAPON",
      "LIGHT_ASM",
    ]),
    engagementChannels: new Set(["ch001"]),
    contentHash: "a".repeat(64),
    ...overrides,
  });
}

function levelBombingAttack(overrides: AtkOverrides = {}) {
  return createAirDefenseAttack({
    attackId: "atk_001",
    formationId: "frm_001",
    targetId: "ship_001",
    attackType: AttackType.AIRCRAFT_LEVEL_BOMBING,
    speedKnots: SafeInt(250),
    speedMps: SafeInt(129),
    currentRangeM: SafeInt(10_000),
    currentAltitudeM: SafeInt(3_000),
    bearingDegrees: SafeInt(0),
    releaseRangeM: SafeInt(5_000),
    releaseAltitudeM: SafeInt(2_000),
    isReleased: false,
    fireControlSolutionBp: SafeInt(10_000),
    timeToImpactMs: SafeInt(60_000),
    formationSize: SafeInt(4),
    cohesionBp: SafeInt(10_000),
    defensiveSusceptibilityBp: SafeInt(10_000),
    contentHash: "b".repeat(64),
    ...overrides,
  });
}

function evaluate(
  attack: ReturnType<typeof levelBombingAttack>,
  overrides: Record<string, unknown> = {},
) {
  return isHeavyAaEligible({
    system: heavyAaSystem(),
    attack,
    defenderId: "ship_001",
    protectedShipDistanceM: null,
    operability: OPERABLE,
    directorAvailable: true,
    radarAvailable: true,
    ammunitionAvailable: true,
    ...overrides,
  });
}

describe("AC-4: heavy AA eligibility (§7)", () => {
  describe("own ship protection", () => {
    it("engages an attack on the defended ship itself (own ship)", () => {
      const result = evaluate(levelBombingAttack({ targetId: "ship_001" }));
      expect(result.eligible).toBe(true);
      expect(result.reason).toBeNull();
    });
  });

  describe("protected nearby ship within exactly 5 nm (9_260 m)", () => {
    it("engages a protected ship at exactly the 5 nm boundary (9_260 m)", () => {
      const result = evaluate(levelBombingAttack({ targetId: "ship_002" }), {
        protectedShipDistanceM: SafeInt(HEAVY_AA_PROTECTED_RADIUS_M),
      });
      expect(result.eligible).toBe(true);
      expect(result.reason).toBeNull();
    });

    it("engages a protected ship inside the 5 nm radius", () => {
      const result = evaluate(levelBombingAttack({ targetId: "ship_002" }), {
        protectedShipDistanceM: SafeInt(9_000),
      });
      expect(result.eligible).toBe(true);
    });

    it("does NOT engage a ship beyond the 5 nm radius (9_300 m)", () => {
      const result = evaluate(levelBombingAttack({ targetId: "ship_002" }), {
        protectedShipDistanceM: SafeInt(9_300),
      });
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe(HEAVY_AA_PROTECTED_RADIUS_EXCEEDED);
    });

    it("MUST NOT engage an unrelated formation outside the protected radius", () => {
      const result = evaluate(levelBombingAttack({ targetId: "ship_099" }), {
        protectedShipDistanceM: SafeInt(20_000),
      });
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe(HEAVY_AA_PROTECTED_RADIUS_EXCEEDED);
    });

    it("cannot verify a non-own-ship attack without a distance → protected radius exceeded", () => {
      const result = evaluate(levelBombingAttack({ targetId: "ship_002" }), {
        protectedShipDistanceM: null,
      });
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe(HEAVY_AA_PROTECTED_RADIUS_EXCEEDED);
    });
  });

  describe("envelope failures (§3 range/altitude/speed)", () => {
    it("range below rangeMinM → ineligible", () => {
      const system = heavyAaSystem({ rangeMinM: SafeInt(1_000) });
      const attack = levelBombingAttack({ currentRangeM: SafeInt(500) });
      const result = isHeavyAaEligible({
        system,
        attack,
        defenderId: "ship_001",
        protectedShipDistanceM: null,
        operability: OPERABLE,
        directorAvailable: true,
        radarAvailable: true,
        ammunitionAvailable: true,
      });
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe(AIR_DEFENSE_TARGET_INELIGIBLE);
    });

    it("range beyond rangeMaxM → ineligible", () => {
      const result = evaluate(levelBombingAttack({ currentRangeM: SafeInt(25_000) }));
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe(AIR_DEFENSE_TARGET_INELIGIBLE);
    });

    it("altitude beyond altitudeMaxM → ineligible", () => {
      const result = evaluate(levelBombingAttack({ currentAltitudeM: SafeInt(12_000) }));
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe(AIR_DEFENSE_TARGET_INELIGIBLE);
    });

    it("speed above targetSpeedLimitMps → ineligible", () => {
      const result = evaluate(levelBombingAttack({ speedMps: SafeInt(600) }));
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe(AIR_DEFENSE_TARGET_INELIGIBLE);
    });
  });

  describe("arc predicate (§1.1 item 4)", () => {
    it("attack outside the mount arc → ineligible", () => {
      const system = heavyAaSystem({ arcDegreesMax: SafeInt(90) });
      const attack = levelBombingAttack({ bearingDegrees: SafeInt(180) });
      const result = isHeavyAaEligible({
        system,
        attack,
        defenderId: "ship_001",
        protectedShipDistanceM: null,
        operability: OPERABLE,
        directorAvailable: true,
        radarAvailable: true,
        ammunitionAvailable: true,
      });
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe(AIR_DEFENSE_TARGET_INELIGIBLE);
    });

    it("attack inside the mount arc → eligible", () => {
      const system = heavyAaSystem({ arcDegreesMax: SafeInt(90) });
      const attack = levelBombingAttack({ bearingDegrees: SafeInt(45) });
      const result = isHeavyAaEligible({
        system,
        attack,
        defenderId: "ship_001",
        protectedShipDistanceM: null,
        operability: OPERABLE,
        directorAvailable: true,
        radarAvailable: true,
        ammunitionAvailable: true,
      });
      expect(result.eligible).toBe(true);
    });
  });

  describe("director / radar / ammunition availability", () => {
    it("no director → AIR_DEFENSE_DIRECTOR_UNAVAILABLE", () => {
      const result = evaluate(levelBombingAttack(), { directorAvailable: false });
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe(AIR_DEFENSE_DIRECTOR_UNAVAILABLE);
    });

    it("no radar → AIR_DEFENSE_RADAR_UNAVAILABLE", () => {
      const result = evaluate(levelBombingAttack(), { radarAvailable: false });
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe(AIR_DEFENSE_RADAR_UNAVAILABLE);
    });

    it("no ammunition → AIR_DEFENSE_AMMUNITION_UNAVAILABLE", () => {
      const result = evaluate(levelBombingAttack(), { ammunitionAvailable: false });
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe(AIR_DEFENSE_AMMUNITION_UNAVAILABLE);
    });
  });

  describe("operability (§7 firing ship not sunk/abandoned/unable)", () => {
    it("sunk defender → ineligible", () => {
      const result = evaluate(levelBombingAttack(), {
        operability: { ...OPERABLE, defenderSunk: true },
      });
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe(AIR_DEFENSE_TARGET_INELIGIBLE);
    });

    it("abandoned defender → ineligible", () => {
      const result = evaluate(levelBombingAttack(), {
        operability: { ...OPERABLE, defenderAbandoned: true },
      });
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe(AIR_DEFENSE_TARGET_INELIGIBLE);
    });

    it("unpowered system → ineligible", () => {
      const result = evaluate(levelBombingAttack(), {
        operability: { ...OPERABLE, systemPowered: false },
      });
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe(AIR_DEFENSE_TARGET_INELIGIBLE);
    });

    it("non-operational system → ineligible", () => {
      const result = evaluate(levelBombingAttack(), {
        operability: { ...OPERABLE, systemOperational: false },
      });
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe(AIR_DEFENSE_TARGET_INELIGIBLE);
    });
  });

  describe("§18 matrix gating", () => {
    it("heavy AA does NOT engage a MEDIUM_ASM attack even when listed by the system", () => {
      const system = heavyAaSystem({
        profileEligibility: new Set([...heavyAaSystem().profileEligibility, "MEDIUM_ASM"]),
      });
      const attack = levelBombingAttack({ attackType: AttackType.MEDIUM_ASM });
      const result = isHeavyAaEligible({
        system,
        attack,
        defenderId: "ship_001",
        protectedShipDistanceM: null,
        operability: OPERABLE,
        directorAvailable: true,
        radarAvailable: true,
        ammunitionAvailable: true,
      });
      // MEDIUM_ASM is absent from the HEAVY_AA row of the §18 matrix → layerAllowsAttackType false.
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe(AIR_DEFENSE_TARGET_INELIGIBLE);
    });

    it("heavy AA does NOT engage a diving attack (§18 line 315: dive → medium AA/light AA/CIWS)", () => {
      const system = heavyAaSystem({
        profileEligibility: new Set([
          ...heavyAaSystem().profileEligibility,
          "AIRCRAFT_DIVE_BOMBING",
        ]),
      });
      const attack = levelBombingAttack({ attackType: AttackType.AIRCRAFT_DIVE_BOMBING });
      const result = isHeavyAaEligible({
        system,
        attack,
        defenderId: "ship_001",
        protectedShipDistanceM: null,
        operability: OPERABLE,
        directorAvailable: true,
        radarAvailable: true,
        ammunitionAvailable: true,
      });
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe(AIR_DEFENSE_TARGET_INELIGIBLE);
    });

    it("engages a LIGHT_ASM attack when the system explicitly lists it (§18 line 313)", () => {
      const attack = levelBombingAttack({ attackType: AttackType.LIGHT_ASM });
      const result = evaluate(attack);
      expect(result.eligible).toBe(true);
    });

    it("does NOT engage a LIGHT_ASM attack when the system does not list it", () => {
      const system = heavyAaSystem({
        profileEligibility: new Set([
          "AIRCRAFT_LEVEL_BOMBING",
          "AIRCRAFT_ROCKET_ATTACK",
          "AIRCRAFT_GUIDED_WEAPON_ATTACK",
          "ANTI_RADIATION_WEAPON",
        ]),
      });
      const attack = levelBombingAttack({ attackType: AttackType.LIGHT_ASM });
      const result = isHeavyAaEligible({
        system,
        attack,
        defenderId: "ship_001",
        protectedShipDistanceM: null,
        operability: OPERABLE,
        directorAvailable: true,
        radarAvailable: true,
        ammunitionAvailable: true,
      });
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe(AIR_DEFENSE_TARGET_INELIGIBLE);
    });
  });
});
