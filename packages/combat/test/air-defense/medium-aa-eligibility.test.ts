// packages/combat/test/air-defense/medium-aa-eligibility.test.ts
// AC-5: Medium AA pre-release window with 4_000bp fire-control solution (DESIGN-45 §8).

import { describe, it, expect } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import {
  AttackType,
  Category,
  createAirDefenseAttack,
  createAirDefenseSystemDefinition,
  isMediumAaEligible,
  Layer,
  MEDIUM_AA_FIRE_CONTROL_MINIMUM_BP,
  AIR_DEFENSE_AMMUNITION_UNAVAILABLE,
  AIR_DEFENSE_CHANNEL_UNAVAILABLE,
  AIR_DEFENSE_DIRECTOR_UNAVAILABLE,
  AIR_DEFENSE_RADAR_UNAVAILABLE,
  AIR_DEFENSE_TARGET_INELIGIBLE,
  MEDIUM_AA_PRE_RELEASE_WINDOW_MISSED,
} from "../../src/air-defense/index.js";

const OPERABLE = {
  defenderSunk: false,
  defenderAbandoned: false,
  systemPowered: true,
  systemOperational: true,
};

type SysOverrides = Partial<Parameters<typeof createAirDefenseSystemDefinition>[0]>;
type AtkOverrides = Partial<Parameters<typeof createAirDefenseAttack>[0]>;

function mediumAaSystem(overrides: SysOverrides = {}) {
  return createAirDefenseSystemDefinition({
    systemId: "sys_med",
    layer: Layer.MEDIUM_AA,
    category: Category.MEDIUM_AA,
    rangeMinM: SafeInt(0),
    rangeMaxM: SafeInt(12_000),
    altitudeMinM: SafeInt(0),
    altitudeMaxM: SafeInt(8_000),
    targetSpeedLimitMps: SafeInt(600),
    arcDegreesMax: SafeInt(360),
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
    engagementChannels: new Set(["ch_med"]),
    contentHash: "c".repeat(64),
    ...overrides,
  });
}

function levelBombingAttack(overrides: AtkOverrides = {}) {
  return createAirDefenseAttack({
    attackId: "atk_med_001",
    formationId: "frm_med_001",
    targetId: "ship_001",
    attackType: AttackType.AIRCRAFT_LEVEL_BOMBING,
    speedKnots: SafeInt(250),
    speedMps: SafeInt(129),
    currentRangeM: SafeInt(8_000),
    currentAltitudeM: SafeInt(3_000),
    bearingDegrees: SafeInt(0),
    releaseRangeM: SafeInt(5_000),
    releaseAltitudeM: SafeInt(2_000),
    isReleased: false,
    fireControlSolutionBp: SafeInt(MEDIUM_AA_FIRE_CONTROL_MINIMUM_BP),
    timeToImpactMs: SafeInt(60_000),
    formationSize: SafeInt(4),
    cohesionBp: SafeInt(10_000),
    defensiveSusceptibilityBp: SafeInt(10_000),
    contentHash: "d".repeat(64),
    ...overrides,
  });
}

function evaluate(
  attack: ReturnType<typeof levelBombingAttack>,
  overrides: Record<string, unknown> = {},
) {
  return isMediumAaEligible({
    system: mediumAaSystem(),
    attack,
    operability: OPERABLE,
    directorAvailable: true,
    radarAvailable: true,
    ammunitionAvailable: true,
    channelAvailable: true,
    ...overrides,
  });
}

describe("AC-5: medium AA eligibility + pre-release timing (§8)", () => {
  it("opens the pre-release window when in range + FC >= 4_000 + resources", () => {
    const result = evaluate(levelBombingAttack());
    expect(result.eligible).toBe(true);
    expect(result.window).toBe("PRE_RELEASE_OPEN");
    expect(result.reason).toBeNull();
  });

  it("opens the window at exactly the 4_000 bp fire-control minimum", () => {
    const result = evaluate(
      levelBombingAttack({ fireControlSolutionBp: SafeInt(MEDIUM_AA_FIRE_CONTROL_MINIMUM_BP) }),
    );
    expect(result.eligible).toBe(true);
    expect(result.window).toBe("PRE_RELEASE_OPEN");
  });

  it("is NOT eligible below the 4_000 bp fire-control solution", () => {
    const result = evaluate(
      levelBombingAttack({
        fireControlSolutionBp: SafeInt(MEDIUM_AA_FIRE_CONTROL_MINIMUM_BP - 1),
      }),
    );
    expect(result.eligible).toBe(false);
    expect(result.window).toBe("NO_FIRE_CONTROL_SOLUTION");
    expect(result.reason).toBe(AIR_DEFENSE_TARGET_INELIGIBLE);
  });

  it("reports a released attack as PRE_RELEASE_MISSED (§8 one pre-release window)", () => {
    const result = evaluate(levelBombingAttack({ isReleased: true }));
    expect(result.eligible).toBe(false);
    expect(result.window).toBe("PRE_RELEASE_MISSED");
    expect(result.reason).toBe(MEDIUM_AA_PRE_RELEASE_WINDOW_MISSED);
  });

  it("reports OUT_OF_ENVELOPE when the target leaves the range envelope", () => {
    const result = evaluate(levelBombingAttack({ currentRangeM: SafeInt(15_000) }));
    expect(result.eligible).toBe(false);
    expect(result.window).toBe("OUT_OF_ENVELOPE");
    expect(result.reason).toBe(AIR_DEFENSE_TARGET_INELIGIBLE);
  });

  it("reports NOT_ELIGIBLE for an attack outside the §18 medium-AA matrix even when listed", () => {
    const system = mediumAaSystem({
      profileEligibility: new Set([...mediumAaSystem().profileEligibility, "MEDIUM_ASM"]),
    });
    const attack = levelBombingAttack({ attackType: AttackType.MEDIUM_ASM });
    const result = isMediumAaEligible({
      system,
      attack,
      operability: OPERABLE,
      directorAvailable: true,
      radarAvailable: true,
      ammunitionAvailable: true,
      channelAvailable: true,
    });
    // MEDIUM_ASM is absent from the MEDIUM_AA row of the §18 matrix.
    expect(result.eligible).toBe(false);
    expect(result.window).toBe("NOT_ELIGIBLE");
    expect(result.reason).toBe(AIR_DEFENSE_TARGET_INELIGIBLE);
  });

  it("reports NOT_ELIGIBLE for a LIGHT_ASM attack even when the medium-AA system lists it", () => {
    // §18 line 313 lists light-ASM layers as CAP/MEDIUM_SAM/LIGHT_SAM/HEAVY_AA/LIGHT_AA/CIWS —
    // MEDIUM_AA is deliberately absent, so §18 line 318 forbids engagement regardless of
    // the system's authored profileEligibility.
    const system = mediumAaSystem({
      profileEligibility: new Set([...mediumAaSystem().profileEligibility, "LIGHT_ASM"]),
    });
    const attack = levelBombingAttack({ attackType: AttackType.LIGHT_ASM });
    const result = isMediumAaEligible({
      system,
      attack,
      operability: OPERABLE,
      directorAvailable: true,
      radarAvailable: true,
      ammunitionAvailable: true,
      channelAvailable: true,
    });
    expect(result.eligible).toBe(false);
    expect(result.window).toBe("NOT_ELIGIBLE");
    expect(result.reason).toBe(AIR_DEFENSE_TARGET_INELIGIBLE);
  });

  it("reports RESOURCE_UNAVAILABLE when the channel is busy", () => {
    const result = evaluate(levelBombingAttack(), { channelAvailable: false });
    expect(result.eligible).toBe(false);
    expect(result.window).toBe("RESOURCE_UNAVAILABLE");
    expect(result.reason).toBe(AIR_DEFENSE_CHANNEL_UNAVAILABLE);
  });

  it("reports RESOURCE_UNAVAILABLE when ammunition is exhausted", () => {
    const result = evaluate(levelBombingAttack(), { ammunitionAvailable: false });
    expect(result.eligible).toBe(false);
    expect(result.window).toBe("RESOURCE_UNAVAILABLE");
    expect(result.reason).toBe(AIR_DEFENSE_AMMUNITION_UNAVAILABLE);
  });

  it("reports RESOURCE_UNAVAILABLE when the director is unavailable", () => {
    const result = evaluate(levelBombingAttack(), { directorAvailable: false });
    expect(result.eligible).toBe(false);
    expect(result.window).toBe("RESOURCE_UNAVAILABLE");
    expect(result.reason).toBe(AIR_DEFENSE_DIRECTOR_UNAVAILABLE);
  });

  it("reports RESOURCE_UNAVAILABLE when radar is unavailable", () => {
    const result = evaluate(levelBombingAttack(), { radarAvailable: false });
    expect(result.eligible).toBe(false);
    expect(result.window).toBe("RESOURCE_UNAVAILABLE");
    expect(result.reason).toBe(AIR_DEFENSE_RADAR_UNAVAILABLE);
  });

  it("reports RESOURCE_UNAVAILABLE when the defender is sunk", () => {
    const result = evaluate(levelBombingAttack(), {
      operability: { ...OPERABLE, defenderSunk: true },
    });
    expect(result.eligible).toBe(false);
    expect(result.window).toBe("RESOURCE_UNAVAILABLE");
    expect(result.reason).toBe(AIR_DEFENSE_TARGET_INELIGIBLE);
  });

  it("still opens the pre-release window for a diving attack (§18 line 315)", () => {
    const result = evaluate(levelBombingAttack({ attackType: AttackType.AIRCRAFT_DIVE_BOMBING }));
    expect(result.eligible).toBe(true);
    expect(result.window).toBe("PRE_RELEASE_OPEN");
  });
});
