// packages/combat/test/air-defense/layer-resolution.test.ts
// AC-3: Layers resolve in HEAVY_AA → MEDIUM_AA → LIGHT_AA → CIWS order (§1).
// Plus per-layer candidate determinism, empty-layer empty results, and §18 matrix fidelity.

import { describe, it, expect } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import {
  AttackType,
  AttackTypeId,
  createAirDefenseAttack,
  createAirDefenseSystemDefinition,
  DEFENSE_LAYER_ORDER,
  Layer,
  resolveDefenseLayers,
  AIR_DEFENSE_TARGET_INELIGIBLE,
} from "../../src/air-defense/index.js";

const OPERABLE = {
  defenderSunk: false,
  defenderAbandoned: false,
  systemPowered: true,
  systemOperational: true,
};

const DEFENDER_ID = "ship_001";

type SysOverrides = Partial<Parameters<typeof createAirDefenseSystemDefinition>[0]>;
type AtkOverrides = Partial<Parameters<typeof createAirDefenseAttack>[0]>;

function aaSystem(systemId: string, layer: string, overrides: SysOverrides = {}) {
  return createAirDefenseSystemDefinition({
    systemId,
    layer: layer as Parameters<typeof createAirDefenseSystemDefinition>[0]["layer"],
    category: layer as Parameters<typeof createAirDefenseSystemDefinition>[0]["category"],
    rangeMinM: SafeInt(0),
    rangeMaxM: SafeInt(20_000),
    altitudeMinM: SafeInt(0),
    altitudeMaxM: SafeInt(10_000),
    targetSpeedLimitMps: SafeInt(800),
    arcDegreesMax: SafeInt(360),
    profileEligibility: new Set([
      "AIRCRAFT_LEVEL_BOMBING",
      "AIRCRAFT_DIVE_BOMBING",
      "AIRCRAFT_ROCKET_ATTACK",
      "AIRCRAFT_GUIDED_WEAPON_ATTACK",
      "ANTI_RADIATION_WEAPON",
      "LIGHT_ASM",
    ]),
    engagementChannels: new Set([`ch_${systemId}`]),
    contentHash: systemId.repeat(8).slice(0, 64),
    ...overrides,
  });
}

function attack(attackId: string, attackType: AttackTypeId, overrides: AtkOverrides = {}) {
  return createAirDefenseAttack({
    attackId,
    formationId: `frm_${attackId}`,
    targetId: DEFENDER_ID,
    attackType,
    speedKnots: SafeInt(150),
    speedMps: SafeInt(77),
    currentRangeM: SafeInt(10_000),
    currentAltitudeM: SafeInt(3_000),
    bearingDegrees: SafeInt(0),
    releaseRangeM: SafeInt(5_000),
    releaseAltitudeM: SafeInt(2_000),
    isReleased: false,
    fireControlSolutionBp: SafeInt(10_000),
    timeToImpactMs: SafeInt(30_000),
    formationSize: SafeInt(4),
    cohesionBp: SafeInt(10_000),
    defensiveSusceptibilityBp: SafeInt(10_000),
    contentHash: "1".repeat(64),
    ...overrides,
  });
}

function resolve(systems: ReturnType<typeof aaSystem>[], atks: ReturnType<typeof attack>[]) {
  return resolveDefenseLayers({
    defenderId: DEFENDER_ID,
    systems,
    attacks: atks,
    operability: OPERABLE,
    protectedShipDistanceM: new Map<string, SafeInt>(),
    directorAvailable: true,
    radarAvailable: true,
    ammunitionBySystem: new Map<string, SafeInt>(),
    channelAvailableBySystem: new Map<string, boolean>(),
  });
}

describe("AC-3: layer resolution (§1)", () => {
  it("DEFENSE_LAYER_ORDER is HEAVY_AA → MEDIUM_AA → LIGHT_AA → CIWS", () => {
    expect(DEFENSE_LAYER_ORDER).toEqual([
      "HEAVY_AA",
      "MEDIUM_AA",
      "LIGHT_AA",
      "CIWS_TERMINAL_DEFENSE",
    ]);
  });

  it("resolveDefenseLayers returns one resolution per layer in canonical order", () => {
    const level = attack("atk_level", AttackType.AIRCRAFT_LEVEL_BOMBING);
    const results = resolve(
      [
        aaSystem("sys_heavy", Layer.HEAVY_AA),
        aaSystem("sys_medium", Layer.MEDIUM_AA),
        aaSystem("sys_light", Layer.LIGHT_AA),
        aaSystem("sys_ciws", Layer.CIWS_TERMINAL_DEFENSE),
      ],
      [level],
    );
    expect(results.map((r) => r.layer)).toEqual([
      "HEAVY_AA",
      "MEDIUM_AA",
      "LIGHT_AA",
      "CIWS_TERMINAL_DEFENSE",
    ]);
  });

  it("an empty layer emits a successful empty result (emptyEligible true, zero candidates)", () => {
    const level = attack("atk_level", AttackType.AIRCRAFT_LEVEL_BOMBING);
    const results = resolve(
      [
        aaSystem("sys_medium", Layer.MEDIUM_AA),
        aaSystem("sys_light", Layer.LIGHT_AA),
        aaSystem("sys_ciws", Layer.CIWS_TERMINAL_DEFENSE),
      ],
      [level],
    );
    const heavy = results.find((r) => r.layer === "HEAVY_AA");
    expect(heavy).toBeDefined();
    expect(heavy!.emptyEligible).toBe(true);
    expect(heavy!.eligibleSystems).toEqual([]);
    expect(heavy!.candidates).toEqual([]);

    const medium = results.find((r) => r.layer === "MEDIUM_AA");
    expect(medium!.emptyEligible).toBe(false);
    expect(medium!.candidates.length).toBe(1);
  });

  it("produces per-layer candidates for mixed systems, attacks in input order", () => {
    const level = attack("atk_level", AttackType.AIRCRAFT_LEVEL_BOMBING);
    const dive = attack("atk_dive", AttackType.AIRCRAFT_DIVE_BOMBING);
    const results = resolve(
      [
        aaSystem("sys_heavy", Layer.HEAVY_AA),
        aaSystem("sys_medium", Layer.MEDIUM_AA),
        aaSystem("sys_light", Layer.LIGHT_AA),
        aaSystem("sys_ciws", Layer.CIWS_TERMINAL_DEFENSE),
      ],
      [level, dive],
    );

    for (const r of results) {
      expect(r.candidates.map((c) => c.attackId)).toEqual(["atk_level", "atk_dive"]);
    }
  });

  it("orders systems by codepoint systemId ascending within a layer (deterministic)", () => {
    const level = attack("atk_level", AttackType.AIRCRAFT_LEVEL_BOMBING);
    const results = resolve(
      [aaSystem("sys_beta", Layer.HEAVY_AA), aaSystem("sys_alpha", Layer.HEAVY_AA)],
      [level],
    );
    const heavy = results.find((r) => r.layer === "HEAVY_AA")!;
    expect(heavy.candidates.map((c) => c.systemId)).toEqual(["sys_alpha", "sys_beta"]);
    expect(heavy.eligibleSystems.map((s) => s.systemId)).toEqual(["sys_alpha", "sys_beta"]);
  });

  it("a level-bombing attack is eligible at all four layers", () => {
    const level = attack("atk_level", AttackType.AIRCRAFT_LEVEL_BOMBING);
    const results = resolve(
      [
        aaSystem("sys_heavy", Layer.HEAVY_AA),
        aaSystem("sys_medium", Layer.MEDIUM_AA),
        aaSystem("sys_light", Layer.LIGHT_AA),
        aaSystem("sys_ciws", Layer.CIWS_TERMINAL_DEFENSE),
      ],
      [level],
    );
    for (const r of results) {
      expect(r.candidates[0].eligible).toBe(true);
      expect(r.emptyEligible).toBe(false);
    }
  });

  it("a diving attack is eligible at MEDIUM_AA + LIGHT_AA + CIWS but NOT HEAVY_AA (§18 line 315)", () => {
    const dive = attack("atk_dive", AttackType.AIRCRAFT_DIVE_BOMBING);
    const results = resolve(
      [
        aaSystem("sys_heavy", Layer.HEAVY_AA),
        aaSystem("sys_medium", Layer.MEDIUM_AA),
        aaSystem("sys_light", Layer.LIGHT_AA),
        aaSystem("sys_ciws", Layer.CIWS_TERMINAL_DEFENSE),
      ],
      [dive],
    );

    const byLayer = new Map(results.map((r) => [r.layer, r]));
    expect(byLayer.get("HEAVY_AA")!.candidates[0].eligible).toBe(false);
    expect(byLayer.get("HEAVY_AA")!.candidates[0].reason).toBe(AIR_DEFENSE_TARGET_INELIGIBLE);
    expect(byLayer.get("MEDIUM_AA")!.candidates[0].eligible).toBe(true);
    expect(byLayer.get("LIGHT_AA")!.candidates[0].eligible).toBe(true);
    expect(byLayer.get("CIWS_TERMINAL_DEFENSE")!.candidates[0].eligible).toBe(true);
  });

  it("an out-of-ammunition system (0 rounds) contributes zero eligibility (§20)", () => {
    const level = attack("atk_level", AttackType.AIRCRAFT_LEVEL_BOMBING);
    const results = resolveDefenseLayers({
      defenderId: DEFENDER_ID,
      systems: [aaSystem("sys_heavy", Layer.HEAVY_AA)],
      attacks: [level],
      operability: OPERABLE,
      protectedShipDistanceM: new Map<string, SafeInt>(),
      directorAvailable: true,
      radarAvailable: true,
      ammunitionBySystem: new Map([["sys_heavy", SafeInt(0)]]),
      channelAvailableBySystem: new Map<string, boolean>(),
    });
    const heavy = results.find((r) => r.layer === "HEAVY_AA")!;
    expect(heavy.candidates[0].eligible).toBe(false);
    expect(heavy.emptyEligible).toBe(true);
  });
});
