import { describe, it, expect } from "vite-plus/test";
import { BluewaveError, SafeInt, isBluewaveError } from "@bluewave/contracts";
import {
  AttackType,
  Category,
  computeLightAaEligibility,
  createAirDefenseAttack,
  createAirDefenseSystemDefinition,
  Layer,
  resolveGuaranteedLightAaDisruptionOpportunity,
  AIR_DEFENSE_AMMUNITION_UNAVAILABLE,
  AIR_DEFENSE_CHANNEL_UNAVAILABLE,
  AIR_DEFENSE_INVARIANT_FAILED,
  AIR_DEFENSE_TARGET_INELIGIBLE,
  LIGHT_AA_DISRUPTION_OPPORTUNITY_CREATED,
} from "@bluewave/combat/air-defense";
import type { LightAaEligibilityResult } from "@bluewave/combat/air-defense";

const OPERABLE = {
  defenderSunk: false,
  defenderAbandoned: false,
  systemPowered: true,
  systemOperational: true,
};

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
    arcDegreesMax: SafeInt(90),
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

function eligibilityFor(atk: ReturnType<typeof attack>, overrides: Record<string, unknown> = {}) {
  return computeLightAaEligibility({
    system: lightAaSystem(),
    attack: atk,
    operability: OPERABLE,
    channelAvailable: true,
    ammunitionAvailable: true,
    ...overrides,
  });
}

function resolve(
  atk: ReturnType<typeof attack>,
  opts: {
    eligibility?: LightAaEligibilityResult;
    system?: SysOverrides;
    operability?: typeof OPERABLE;
    channelAvailable?: boolean;
    ammunitionAvailable?: boolean;
    minute?: SafeInt;
    substep?: SafeInt;
  } = {},
) {
  const system = lightAaSystem(opts.system);
  const eligibility =
    opts.eligibility ??
    computeLightAaEligibility({
      system,
      attack: atk,
      operability: opts.operability ?? OPERABLE,
      channelAvailable: opts.channelAvailable ?? true,
      ammunitionAvailable: opts.ammunitionAvailable ?? true,
    });
  return resolveGuaranteedLightAaDisruptionOpportunity({
    system,
    attack: atk,
    operability: opts.operability ?? OPERABLE,
    channelAvailable: opts.channelAvailable ?? true,
    ammunitionAvailable: opts.ammunitionAvailable ?? true,
    eligibility,
    timing: { minute: opts.minute ?? SafeInt(12), substep: opts.substep ?? SafeInt(1) },
  });
}

function thrownCode(fn: () => void): string {
  try {
    fn();
  } catch (error) {
    expect(isBluewaveError(error)).toBe(true);
    return (error as BluewaveError).context.code as string;
  }
  throw new Error("expected a BluewaveError, none was thrown");
}

describe("AC-7: guaranteed light-AA disruption opportunity (§29.8-9)", () => {
  it("every eligible light-AA system receives the opportunity at exactly ONE authoritative substep", () => {
    const result = resolve(attack(), { minute: SafeInt(12), substep: SafeInt(1) });
    expect(result.opportunityCreated).toBe(true);
    expect(result.checkMinute).toBe(SafeInt(12));
    expect(result.checkSubstep).toBe(SafeInt(1));
    expect(result.reasonCode).toBe(LIGHT_AA_DISRUPTION_OPPORTUNITY_CREATED);
  });

  it("is deterministic — identical inputs produce identical results", () => {
    const a = resolve(attack());
    const b = resolve(attack());
    expect(a).toEqual(b);
  });

  it("does NOT guarantee ammunition, hit, damage, or abort (§29.9)", () => {
    const result = resolve(attack());
    expect(result.opportunityCreated).toBe(true);
    expect(result.reasonCode).toBe(LIGHT_AA_DISRUPTION_OPPORTUNITY_CREATED);
  });

  describe("prohibited cases (deterministic predicate order)", () => {
    it("attack type not permitted by matrix/listing → AIR_DEFENSE_TARGET_INELIGIBLE", () => {
      const result = resolve(attack({ attackType: AttackType.HEAVY_ASM }));
      expect(result.opportunityCreated).toBe(false);
      expect(result.reasonCode).toBe(AIR_DEFENSE_TARGET_INELIGIBLE);
    });

    it("system destroyed / unpowered → AIR_DEFENSE_TARGET_INELIGIBLE", () => {
      for (const operability of [
        { ...OPERABLE, systemOperational: false },
        { ...OPERABLE, systemPowered: false },
        { ...OPERABLE, defenderSunk: true },
      ]) {
        const result = resolve(attack(), { operability });
        expect(result.opportunityCreated).toBe(false);
        expect(result.reasonCode).toBe(AIR_DEFENSE_TARGET_INELIGIBLE);
      }
    });

    it("attack out of the mount arc → AIR_DEFENSE_TARGET_INELIGIBLE (arc enforced here)", () => {
      const atk = attack({ bearingDegrees: SafeInt(200) });
      expect(eligibilityFor(atk).eligible).toBe(true);
      const result = resolve(atk);
      expect(result.opportunityCreated).toBe(false);
      expect(result.reasonCode).toBe(AIR_DEFENSE_TARGET_INELIGIBLE);
    });

    it("attack outside the envelope → AIR_DEFENSE_TARGET_INELIGIBLE", () => {
      const result = resolve(attack({ currentRangeM: SafeInt(10_000) }));
      expect(result.opportunityCreated).toBe(false);
      expect(result.reasonCode).toBe(AIR_DEFENSE_TARGET_INELIGIBLE);
    });

    it("flight window closed (timeToImpactMs past the effective window) → AIR_DEFENSE_TARGET_INELIGIBLE", () => {
      const result = resolve(attack({ timeToImpactMs: SafeInt(120_001) }));
      expect(result.opportunityCreated).toBe(false);
      expect(result.reasonCode).toBe(AIR_DEFENSE_TARGET_INELIGIBLE);
    });

    it("channel unavailable → AIR_DEFENSE_CHANNEL_UNAVAILABLE", () => {
      const result = resolve(attack(), { channelAvailable: false });
      expect(result.opportunityCreated).toBe(false);
      expect(result.reasonCode).toBe(AIR_DEFENSE_CHANNEL_UNAVAILABLE);
    });

    it("ammunition unavailable → AIR_DEFENSE_AMMUNITION_UNAVAILABLE", () => {
      const result = resolve(attack(), { ammunitionAvailable: false });
      expect(result.opportunityCreated).toBe(false);
      expect(result.reasonCode).toBe(AIR_DEFENSE_AMMUNITION_UNAVAILABLE);
    });

    it("prohibited attempts still report the attempted minute/substep", () => {
      const result = resolve(attack({ currentRangeM: SafeInt(10_000) }), {
        minute: SafeInt(7),
        substep: SafeInt(1),
      });
      expect(result.checkMinute).toBe(SafeInt(7));
      expect(result.checkSubstep).toBe(SafeInt(1));
    });
  });

  describe("fail-closed contradiction guard", () => {
    it("eligibility claims eligible but a shared predicate blocks → AIR_DEFENSE_INVARIANT_FAILED", () => {
      const fakeEligible: LightAaEligibilityResult = {
        eligible: true,
        profile: "LEVEL",
        baseWindowMilliseconds: SafeInt(120_000),
        speedMultiplierBp: SafeInt(10_000),
        effectiveWindowMilliseconds: SafeInt(120_000),
        withinEnvelope: true,
        windowOpen: true,
        reason: null,
      };
      const code = thrownCode(() =>
        resolve(attack(), { eligibility: fakeEligible, channelAvailable: false }),
      );
      expect(code).toBe(AIR_DEFENSE_INVARIANT_FAILED);
    });

    it("eligibility claims eligible but the system is inoperable → AIR_DEFENSE_INVARIANT_FAILED", () => {
      const fakeEligible: LightAaEligibilityResult = {
        eligible: true,
        profile: "LEVEL",
        baseWindowMilliseconds: SafeInt(120_000),
        speedMultiplierBp: SafeInt(10_000),
        effectiveWindowMilliseconds: SafeInt(120_000),
        withinEnvelope: true,
        windowOpen: true,
        reason: null,
      };
      const code = thrownCode(() =>
        resolve(attack(), {
          eligibility: fakeEligible,
          operability: { ...OPERABLE, systemPowered: false },
        }),
      );
      expect(code).toBe(AIR_DEFENSE_INVARIANT_FAILED);
    });
  });
});
