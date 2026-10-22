import { describe, expect, it } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import type { ShipDamageState } from "../../src/damage/index.js";
import {
  chainReactionBaseBpForModel,
  computeBaseWarheadFlotationDamage,
  computeTorpedoFlotationDamage,
  verifyTorpedoDamagePackageHash,
  computeChainReactionProbabilityBp,
  resolveTorpedoChainReaction,
  composeTorpedoChainReactionPackage,
  applyTorpedoChainReactionPackage,
  TORPEDO_CHAIN_REACTION,
  TORPEDO_CHAIN_REACTION_BASE_BP,
  OXYGEN_CHAIN_REACTION_BASE_BP,
  type TorpedoChainReactionModifierKey,
  type TorpedoDamagePackageInput,
} from "../../src/torpedoes/index.js";
import { COMPILED_TORPEDOES } from "../fixtures/compiledTorpedoes.js";

function neutralModifiers(): Record<TorpedoChainReactionModifierKey, number> {
  return {
    isolation: 10_000,
    flooding: 10_000,
    protection: 10_000,
    fireIntensity: 10_000,
    existingDamage: 10_000,
  };
}

function chainPackageContext(): Omit<
  TorpedoDamagePackageInput,
  "warheadExplosiveEquivalentMassKg"
> {
  return {
    battleId: "B1",
    battleMinute: 6,
    substep: 4,
    torpedoTrackId: "B1:6:4:torpedo:LCH-1:tube0",
    targetShipId: "SHIP-TAU",
    targetContactId: "C1",
    impactZone: "TUBE_BAY",
    impactSide: "PORT",
    longitudinalPositionM: 120,
    detonationDepthM: 4,
    protectionLevel: "STANDARD",
    hullBreachAreaM2: 30,
    isolationState: "DEGRADED",
    machinery: { severity: "NO_EFFECT", affectedComponents: [], componentOutcome: "UNAFFECTED" },
    nearbySystemShock: { affectedSystemId: null, componentOutcome: null },
    fireProbabilityBp: 300,
    crewCasualties: 0,
    damageControlAccessibility: "RESTRICTED",
  };
}

function chainBaseState(): ShipDamageState {
  return {
    shipId: "SHIP-TAU",
    compartments: ["TUBE-BAY-1"],
    components: ["TURRET-1"],
    structuralIntegrity: 100_000,
    flotationReserve: 50_000,
    stabilityScore: 8_000,
    fireRecords: [],
    floodingRecords: [],
    progressiveFloodingTotal: 0,
    performanceModifiers: {},
    terminalStatus: "NORMAL",
    rulesetVersion: "damage_ruleset_v1",
    formulaVersion: "damage_formula_v1",
    stateHash: "",
  };
}

describe("AC-18 §22: the shipped base probabilities", () => {
  it("ships ordinary 1_500 / oxygen 3_000 / electric 1_000 (oxygen ≡ §23)", () => {
    expect(TORPEDO_CHAIN_REACTION_BASE_BP).toEqual({
      ORDINARY: 1_500,
      OXYGEN: OXYGEN_CHAIN_REACTION_BASE_BP,
      ELECTRIC: 1_000,
    });
    expect(TORPEDO_CHAIN_REACTION_BASE_BP.OXYGEN).toBe(3_000);
  });

  it("per-model base comes from the authoritative torch policy", () => {
    expect(chainReactionBaseBpForModel(COMPILED_TORPEDOES, "ger_533mm_g7a_1934")).toBe(1_500);
    expect(chainReactionBaseBpForModel(COMPILED_TORPEDOES, "jpn_61cm_type93_1935")).toBe(3_000);
    expect(chainReactionBaseBpForModel(COMPILED_TORPEDOES, "ger_533mm_g7e_1936")).toBe(1_000);
    expect(chainReactionBaseBpForModel(COMPILED_TORPEDOES, "whitehead_18in_1894")).toBe(1_500);
    expect(() => chainReactionBaseBpForModel(COMPILED_TORPEDOES, "BOGUS_MODEL")).toThrow(
      BluewaveError,
    );
  });
});

describe("AC-18 §22: the exact probability composition", () => {
  it("the neutral manifest reproduces the base exactly", () => {
    expect(
      computeChainReactionProbabilityBp({
        baseProbabilityBp: 1_500,
        modifiers: neutralModifiers(),
      }),
    ).toBe(1_500);
    expect(
      computeChainReactionProbabilityBp({
        baseProbabilityBp: 3_000,
        modifiers: neutralModifiers(),
      }),
    ).toBe(3_000);
  });

  it("each explicit integer modifier scales over 10_000^5 with one FLOOR", () => {
    const boosted = computeChainReactionProbabilityBp({
      baseProbabilityBp: 1_500,
      modifiers: { ...neutralModifiers(), fireIntensity: 15_000, existingDamage: 12_500 },
    });
    expect(boosted).toBe(2_812);
  });

  it("every factor must be EXPLICIT — a missing modifier fails closed", () => {
    const { fireIntensity: _dropped, ...partial } = neutralModifiers();
    expect(() =>
      computeChainReactionProbabilityBp({
        baseProbabilityBp: 1_500,
        modifiers: partial as Record<TorpedoChainReactionModifierKey, number>,
      }),
    ).toThrow(BluewaveError);
    expect(() =>
      computeChainReactionProbabilityBp({
        baseProbabilityBp: 1_500,
        modifiers: { ...neutralModifiers(), isolation: -1 },
      }),
    ).toThrow(BluewaveError);
    expect(() =>
      computeChainReactionProbabilityBp({
        baseProbabilityBp: 10_001,
        modifiers: neutralModifiers(),
      }),
    ).toThrow(BluewaveError);
  });
});

describe("AC-18 §22: the per-loaded-torpedo keyed checks", () => {
  it("an ordinary G7a check detonates only on a sub-1_500-bp draw", () => {
    const r = resolveTorpedoChainReaction({
      battleId: "B1",
      minute: 6,
      substep: 4,
      launcherId: "LCH-1",
      loadedTorpedoes: [{ tubeIndex: 0, torpedoModelId: "ger_533mm_g7a_1934" }],
      torpedoes: COMPILED_TORPEDOES,
      modifiers: neutralModifiers(),
      keyedRng: () => 0.001,
    });
    expect(r.checks).toHaveLength(1);
    expect(r.checks[0].detonated).toBe(true);
    expect(r.checks[0].finalProbabilityBp).toBe(1_500);
    expect(r.checks[0].consumedWarheadEquivalentMassKg).toBe(280);
    expect(r.consumed).toEqual([{ tubeIndex: 0, torpedoModelId: "ger_533mm_g7a_1934" }]);
    expect(r.totalConsumedWarheadEquivalentMassKg).toBe(280);
    expect(r.reasonCode).toBe(TORPEDO_CHAIN_REACTION);
    expect(r.checks[0].decision.streamId).toBe(
      "battle/torpedo/damage/chain-reaction:B1:6:4:LCH-1:tube0",
    );
    expect(Object.isFrozen(r)).toBe(true);
  });

  it("a draw at/above the base does NOT detonate (no consumption, no code)", () => {
    const r = resolveTorpedoChainReaction({
      battleId: "B1",
      minute: 6,
      substep: 4,
      launcherId: "LCH-1",
      loadedTorpedoes: [{ tubeIndex: 0, torpedoModelId: "ger_533mm_g7a_1934" }],
      torpedoes: COMPILED_TORPEDOES,
      modifiers: neutralModifiers(),
      keyedRng: () => 0.15,
    });
    expect(r.checks[0].detonated).toBe(false);
    expect(r.checks[0].consumedWarheadEquivalentMassKg).toBe(0);
    expect(r.consumed).toEqual([]);
    expect(r.reasonCode).toBeNull();
  });

  it("consumes EXACTLY ONE draw per still-present loaded torpedo", () => {
    let calls = 0;
    const r = resolveTorpedoChainReaction({
      battleId: "B1",
      minute: 6,
      substep: 4,
      launcherId: "LCH-1",
      loadedTorpedoes: [
        { tubeIndex: 0, torpedoModelId: "ger_533mm_g7a_1934" },
        { tubeIndex: 1, torpedoModelId: "jpn_61cm_type93_1935" },
        { tubeIndex: 2, torpedoModelId: "ger_533mm_g7e_1936" },
      ],
      torpedoes: COMPILED_TORPEDOES,
      modifiers: neutralModifiers(),
      keyedRng: () => {
        calls += 1;
        return 0.01;
      },
    });
    expect(calls).toBe(3);
    expect(r.checks.map((c) => c.detonated)).toEqual([true, true, true]);
    expect(r.totalConsumedWarheadEquivalentMassKg).toBe(280 + 490 + 280);
  });

  it("an unknown loaded torpedo model fails closed", () => {
    expect(() =>
      resolveTorpedoChainReaction({
        battleId: "B1",
        minute: 6,
        substep: 4,
        launcherId: "LCH-1",
        loadedTorpedoes: [{ tubeIndex: 0, torpedoModelId: "NOT_SHIPPED" }],
        torpedoes: COMPILED_TORPEDOES,
        modifiers: neutralModifiers(),
        keyedRng: () => 0.001,
      }),
    ).toThrow(BluewaveError);
  });
});

describe("AC-18 §22: the SEPARATE explosion damage package (MEDIUM-4 composition helper)", () => {
  it("composeTorpedoChainReactionPackage builds the separate package from the consumed mass + a coherent hash", () => {
    const chain = resolveTorpedoChainReaction({
      battleId: "B1",
      minute: 6,
      substep: 4,
      launcherId: "LCH-1",
      loadedTorpedoes: [{ tubeIndex: 0, torpedoModelId: "ger_533mm_g7a_1934" }],
      torpedoes: COMPILED_TORPEDOES,
      modifiers: neutralModifiers(),
      keyedRng: () => 0.001,
    });
    const explosion = composeTorpedoChainReactionPackage({
      chain,
      packageInput: chainPackageContext(),
    });
    expect(explosion.warheadExplosiveEquivalentMassKg).toBe(280);
    expect(explosion.packageHash).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyTorpedoDamagePackageHash(explosion)).toBe(true);
    expect(explosion.packageId).toBe("B1:6:4:torpedo-damage:B1:6:4:torpedo:LCH-1:tube0");
    expect(explosion.flotationDamage).toBe(
      computeTorpedoFlotationDamage({
        baseWarheadFlotationDamage: computeBaseWarheadFlotationDamage(280),
        protectionLevel: "STANDARD",
        impactZone: "TUBE_BAY",
      }),
    );
    expect(Object.isFrozen(explosion)).toBe(true);
  });

  it("composeTorpedoChainReactionPackage fails closed on a non-consuming chain (no silent empty package)", () => {
    const chain = resolveTorpedoChainReaction({
      battleId: "B1",
      minute: 6,
      substep: 4,
      launcherId: "LCH-1",
      loadedTorpedoes: [{ tubeIndex: 0, torpedoModelId: "ger_533mm_g7a_1934" }],
      torpedoes: COMPILED_TORPEDOES,
      modifiers: neutralModifiers(),
      keyedRng: () => 0.5,
    });
    expect(chain.totalConsumedWarheadEquivalentMassKg).toBe(0);
    expect(() =>
      composeTorpedoChainReactionPackage({ chain, packageInput: chainPackageContext() }),
    ).toThrow(BluewaveError);
  });

  it("applyTorpedoChainReactionPackage applies the separate explosion ATOMICALLY (state updated, frozen result, rollback invariant)", () => {
    const chain = resolveTorpedoChainReaction({
      battleId: "B1",
      minute: 6,
      substep: 4,
      launcherId: "LCH-1",
      loadedTorpedoes: [{ tubeIndex: 0, torpedoModelId: "ger_533mm_g7a_1934" }],
      torpedoes: COMPILED_TORPEDOES,
      modifiers: neutralModifiers(),
      keyedRng: () => 0.001,
    });
    const state = chainBaseState();
    const snapshot = JSON.parse(JSON.stringify(state));
    const result = applyTorpedoChainReactionPackage({
      chain,
      packageContext: chainPackageContext(),
      state,
      flooding: [],
      designFlotationReserve: 50_000,
      designStabilityScore: 8_000,
      keyedRng: () => 0.9,
    });
    expect(result.newState.flotationReserve).toBe(50_000 - 5_600);
    expect(result.newState.structuralIntegrity).toBe(100_000 - 280 * 48);
    expect(result.terminalResult.transition).toBe("NONE");
    expect(result.eventRecord.recordHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.newState.stateHash).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.isFrozen(result.newState)).toBe(true);

    const badState = chainBaseState();
    expect(() =>
      applyTorpedoChainReactionPackage({
        chain,
        packageContext: chainPackageContext(),
        state: badState,
        flooding: [{ compartmentId: "X", baseBreachRateKgMin: -5 }] as never,
        designFlotationReserve: 50_000,
        designStabilityScore: 8_000,
        keyedRng: () => 0.9,
      }),
    ).toThrow(BluewaveError);
    expect(badState).toEqual(snapshot);
  });
});
