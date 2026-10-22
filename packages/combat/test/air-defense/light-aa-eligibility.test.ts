import { describe, it, expect } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import {
  AttackType,
  Category,
  computeLightAaEligibility,
  createAirDefenseAttack,
  createAirDefenseSystemDefinition,
  Layer,
  AIR_DEFENSE_AMMUNITION_UNAVAILABLE,
  AIR_DEFENSE_CHANNEL_UNAVAILABLE,
  AIR_DEFENSE_TARGET_INELIGIBLE,
} from "../../src/air-defense/index.js";

const OPERABLE = {
  defenderSunk: false,
  defenderAbandoned: false,
  systemPowered: true,
  systemOperational: true,
};

const ALL_LIGHT_PROFILES = new Set([
  "AIRCRAFT_LEVEL_BOMBING",
  "AIRCRAFT_DIVE_BOMBING",
  "AIRCRAFT_SKIP_BOMBING",
  "AIRCRAFT_TORPEDO_ATTACK",
  "AIRCRAFT_ROCKET_ATTACK",
  "AIRCRAFT_GUIDED_WEAPON_ATTACK",
  "ANTI_RADIATION_WEAPON",
  "LIGHT_ASM",
  "MEDIUM_ASM",
  "HEAVY_ASM",
]);

type SysOverrides = Partial<Parameters<typeof createAirDefenseSystemDefinition>[0]>;
type AtkOverrides = Partial<Parameters<typeof createAirDefenseAttack>[0]>;

function lightAaSystem(overrides: SysOverrides = {}) {
  return createAirDefenseSystemDefinition({
    systemId: "sys_light",
    layer: Layer.LIGHT_AA,
    category: Category.LIGHT_AA,
    rangeMinM: SafeInt(0),
    rangeMaxM: SafeInt(4_000),
    altitudeMinM: SafeInt(0),
    altitudeMaxM: SafeInt(6_000),
    targetSpeedLimitMps: SafeInt(800),
    arcDegreesMax: SafeInt(360),
    profileEligibility: ALL_LIGHT_PROFILES,
    engagementChannels: new Set(["ch_light"]),
    contentHash: "f".repeat(64),
    ...overrides,
  });
}

function attack(overrides: AtkOverrides = {}) {
  return createAirDefenseAttack({
    attackId: "atk_light_001",
    formationId: "frm_light_001",
    targetId: "ship_001",
    attackType: AttackType.AIRCRAFT_LEVEL_BOMBING,
    speedKnots: SafeInt(150),
    speedMps: SafeInt(77),
    currentRangeM: SafeInt(2_000),
    currentAltitudeM: SafeInt(1_000),
    bearingDegrees: SafeInt(0),
    releaseRangeM: SafeInt(1_000),
    releaseAltitudeM: SafeInt(500),
    isReleased: false,
    fireControlSolutionBp: SafeInt(10_000),
    timeToImpactMs: SafeInt(120_000),
    formationSize: SafeInt(2),
    cohesionBp: SafeInt(10_000),
    defensiveSusceptibilityBp: SafeInt(10_000),
    contentHash: "g".repeat(64),
    ...overrides,
  });
}

function evaluate(atk: ReturnType<typeof attack>, overrides: Record<string, unknown> = {}) {
  return computeLightAaEligibility({
    system: lightAaSystem(),
    attack: atk,
    operability: OPERABLE,
    channelAvailable: true,
    ammunitionAvailable: true,
    ...overrides,
  });
}

describe("AC-6: light AA windows (§9)", () => {
  describe("per-profile base windows", () => {
    it("level bombing → 2 minutes (120_000 ms)", () => {
      const result = evaluate(attack({ attackType: AttackType.AIRCRAFT_LEVEL_BOMBING }));
      expect(result.profile).toBe("LEVEL");
      expect(Number(result.baseWindowMilliseconds)).toBe(120_000);
      expect(Number(result.effectiveWindowMilliseconds)).toBe(120_000);
    });

    it("dive bombing → 1 minute (60_000 ms)", () => {
      const result = evaluate(attack({ attackType: AttackType.AIRCRAFT_DIVE_BOMBING }));
      expect(result.profile).toBe("DIVE");
      expect(Number(result.baseWindowMilliseconds)).toBe(60_000);
    });

    it("torpedo attack → 2 minutes (120_000 ms)", () => {
      const result = evaluate(attack({ attackType: AttackType.AIRCRAFT_TORPEDO_ATTACK }));
      expect(result.profile).toBe("TORPEDO");
      expect(Number(result.baseWindowMilliseconds)).toBe(120_000);
    });

    it("rocket attack → 1 minute (60_000 ms)", () => {
      const result = evaluate(attack({ attackType: AttackType.AIRCRAFT_ROCKET_ATTACK }));
      expect(result.profile).toBe("ROCKET");
      expect(Number(result.baseWindowMilliseconds)).toBe(60_000);
    });

    it("skip bombing → 1 minute (60_000 ms)", () => {
      const result = evaluate(attack({ attackType: AttackType.AIRCRAFT_SKIP_BOMBING }));
      expect(result.profile).toBe("SKIP");
      expect(Number(result.baseWindowMilliseconds)).toBe(60_000);
    });

    it("aircraft-delivered guided weapon → 1 minute (60_000 ms)", () => {
      const result = evaluate(attack({ attackType: AttackType.AIRCRAFT_GUIDED_WEAPON_ATTACK }));
      expect(result.profile).toBe("GUIDED");
      expect(Number(result.baseWindowMilliseconds)).toBe(60_000);
    });

    it("anti-radiation weapon maps to the guided-class profile (60_000 ms)", () => {
      const result = evaluate(attack({ attackType: AttackType.ANTI_RADIATION_WEAPON }));
      expect(result.profile).toBe("GUIDED");
      expect(Number(result.baseWindowMilliseconds)).toBe(60_000);
    });

    it("light ASM → system-specific terminal window (null base window)", () => {
      const result = evaluate(attack({ attackType: AttackType.LIGHT_ASM }));
      expect(result.profile).toBe("LIGHT_ASM");
      expect(result.baseWindowMilliseconds).toBeNull();
      expect(result.effectiveWindowMilliseconds).toBeNull();
    });
  });

  describe("speed-band multiplier selection", () => {
    it("selects 10_000 bp below 200 knots", () => {
      const result = evaluate(attack({ speedKnots: SafeInt(199) }));
      expect(Number(result.speedMultiplierBp)).toBe(10_000);
    });

    it("selects 7_500 bp at 200 through below 350 knots", () => {
      const result = evaluate(attack({ speedKnots: SafeInt(250) }));
      expect(Number(result.speedMultiplierBp)).toBe(7_500);
    });

    it("selects 5_000 bp at 350 through below 500 knots", () => {
      const result = evaluate(attack({ speedKnots: SafeInt(400) }));
      expect(Number(result.speedMultiplierBp)).toBe(5_000);
    });

    it("selects 2_500 bp at 500 knots or higher", () => {
      const result = evaluate(attack({ speedKnots: SafeInt(550) }));
      expect(Number(result.speedMultiplierBp)).toBe(2_500);
    });
  });

  describe("effective window formula (§9 line 178)", () => {
    it("effective = floor(base * bp / 10_000) for level bombing at 5_000 bp", () => {
      const result = evaluate(attack({ speedKnots: SafeInt(400) }));
      expect(Number(result.effectiveWindowMilliseconds)).toBe(60_000);
    });

    it("scales a 60 s rocket window at 2_500 bp to 15_000 ms", () => {
      const result = evaluate(
        attack({ attackType: AttackType.AIRCRAFT_ROCKET_ATTACK, speedKnots: SafeInt(550) }),
      );
      expect(Number(result.effectiveWindowMilliseconds)).toBe(15_000);
    });
  });

  describe("window open / closed", () => {
    it("window open when timeToImpactMs <= effective window → eligible", () => {
      const result = evaluate(
        attack({ speedKnots: SafeInt(400), timeToImpactMs: SafeInt(60_000) }),
      );
      expect(result.windowOpen).toBe(true);
      expect(result.withinEnvelope).toBe(true);
      expect(result.eligible).toBe(true);
      expect(result.reason).toBeNull();
    });

    it("window closed when timeToImpactMs > effective window → ineligible", () => {
      const result = evaluate(
        attack({ speedKnots: SafeInt(400), timeToImpactMs: SafeInt(60_001) }),
      );
      expect(result.windowOpen).toBe(false);
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe(AIR_DEFENSE_TARGET_INELIGIBLE);
    });

    it("window closed when the attack is outside the envelope", () => {
      const result = evaluate(attack({ currentRangeM: SafeInt(10_000) }));
      expect(result.withinEnvelope).toBe(false);
      expect(result.windowOpen).toBe(false);
      expect(result.eligible).toBe(false);
    });
  });

  describe("medium/heavy ASM require explicit system listing", () => {
    it("MEDIUM_ASM attack with a system that does NOT list it → ineligible", () => {
      const system = lightAaSystem({
        profileEligibility: new Set([
          "AIRCRAFT_LEVEL_BOMBING",
          "AIRCRAFT_DIVE_BOMBING",
          "AIRCRAFT_SKIP_BOMBING",
          "AIRCRAFT_TORPEDO_ATTACK",
          "AIRCRAFT_ROCKET_ATTACK",
          "AIRCRAFT_GUIDED_WEAPON_ATTACK",
          "ANTI_RADIATION_WEAPON",
          "LIGHT_ASM",
        ]),
      });
      const result = computeLightAaEligibility({
        system,
        attack: attack({ attackType: AttackType.MEDIUM_ASM }),
        operability: OPERABLE,
        channelAvailable: true,
        ammunitionAvailable: true,
      });
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe(AIR_DEFENSE_TARGET_INELIGIBLE);
    });

    it("MEDIUM_ASM attack with a system that DOES list it → still no shipped §9 window", () => {
      const result = evaluate(attack({ attackType: AttackType.MEDIUM_ASM }));
      expect(result.eligible).toBe(false);
      expect(result.profile).toBeNull();
      expect(result.baseWindowMilliseconds).toBeNull();
      expect(result.windowOpen).toBe(false);
      expect(result.reason).toBe(AIR_DEFENSE_TARGET_INELIGIBLE);
    });

    it("HEAVY_ASM attack behaves the same", () => {
      const result = evaluate(attack({ attackType: AttackType.HEAVY_ASM }));
      expect(result.eligible).toBe(false);
      expect(result.profile).toBeNull();
      expect(result.reason).toBe(AIR_DEFENSE_TARGET_INELIGIBLE);
    });
  });

  describe("LIGHT_ASM system-specific terminal window", () => {
    it("eligible while the attack is inside the terminal envelope (window null = open)", () => {
      const result = evaluate(attack({ attackType: AttackType.LIGHT_ASM }));
      expect(result.eligible).toBe(true);
      expect(result.windowOpen).toBe(true);
      expect(result.baseWindowMilliseconds).toBeNull();
      expect(result.effectiveWindowMilliseconds).toBeNull();
    });

    it("ineligible when the LIGHT_ASM attack is outside the terminal envelope", () => {
      const result = evaluate(
        attack({ attackType: AttackType.LIGHT_ASM, currentRangeM: SafeInt(10_000) }),
      );
      expect(result.withinEnvelope).toBe(false);
      expect(result.windowOpen).toBe(false);
      expect(result.eligible).toBe(false);
    });
  });

  describe("resources and operability", () => {
    it("channel unavailable → ineligible with AIR_DEFENSE_CHANNEL_UNAVAILABLE", () => {
      const result = evaluate(attack(), { channelAvailable: false });
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe(AIR_DEFENSE_CHANNEL_UNAVAILABLE);
    });

    it("ammunition unavailable → ineligible with AIR_DEFENSE_AMMUNITION_UNAVAILABLE", () => {
      const result = evaluate(attack(), { ammunitionAvailable: false });
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe(AIR_DEFENSE_AMMUNITION_UNAVAILABLE);
    });

    it("unpowered system → ineligible with AIR_DEFENSE_TARGET_INELIGIBLE", () => {
      const result = evaluate(attack(), {
        operability: { ...OPERABLE, systemPowered: false },
      });
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe(AIR_DEFENSE_TARGET_INELIGIBLE);
    });
  });
});
