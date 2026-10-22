import { describe, expect, it } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  computeSevereImmediateFloodingKg,
  computeUnderwaterTubeSevereFloodingBp,
  loadedTubeMultiplierBp,
  resolveUnderwaterTubeHitHazard,
  TORPEDO_TUBE_HAZARD_BASE_BP,
  TORPEDO_TUBE_ISOLATION_MULTIPLIER_BP,
  TORPEDO_TUBE_LOADED_MULTIPLIER_BP,
  TORPEDO_TUBE_PROTECTION_MULTIPLIER_BP,
  tubeHitPropulsionMultiplierBp,
  UNDERWATER_TUBE_SEVERE_FLOODING,
} from "../../src/torpedoes/index.js";

describe("AC-18 §21: the shipped multiplier tables + base", () => {
  it("ships the 5_000 bp severe-flooding base", () => {
    expect(TORPEDO_TUBE_HAZARD_BASE_BP).toBe(5_000);
  });

  it("ships the loaded-tube multipliers (no/one/two-or-more)", () => {
    expect(TORPEDO_TUBE_LOADED_MULTIPLIER_BP).toEqual({
      NO_LOADED_TORPEDO: 2_500,
      ONE_LOADED_TUBE: 10_000,
      TWO_OR_MORE_LOADED_TUBES: 12_500,
    });
    expect(loadedTubeMultiplierBp(0)).toBe(2_500);
    expect(loadedTubeMultiplierBp(1)).toBe(10_000);
    expect(loadedTubeMultiplierBp(2)).toBe(12_500);
    expect(loadedTubeMultiplierBp(5)).toBe(12_500);
    expect(() => loadedTubeMultiplierBp(-1)).toThrow(BluewaveError);
  });

  it("ships the propulsion multipliers (ordinary 10_000 / oxygen 15_000 / electric 7_500)", () => {
    expect(tubeHitPropulsionMultiplierBp("COMPRESSED_AIR")).toBe(10_000);
    expect(tubeHitPropulsionMultiplierBp("WET_HEATER")).toBe(10_000);
    expect(tubeHitPropulsionMultiplierBp("OXYGEN")).toBe(15_000);
    expect(tubeHitPropulsionMultiplierBp("ELECTRIC")).toBe(7_500);
    expect(() => tubeHitPropulsionMultiplierBp("BOGUS" as never)).toThrow(BluewaveError);
  });

  it("ships the isolation multipliers (7_500/10_000/15_000)", () => {
    expect(TORPEDO_TUBE_ISOLATION_MULTIPLIER_BP).toEqual({
      INTACT: 7_500,
      DEGRADED: 10_000,
      FAILED: 15_000,
    });
  });

  it("ships the protection multipliers (none/standard/improved)", () => {
    expect(TORPEDO_TUBE_PROTECTION_MULTIPLIER_BP).toEqual({
      NONE: 12_500,
      STANDARD: 10_000,
      IMPROVED: 7_500,
    });
  });
});

describe("AC-18 §21: the exact probability composition", () => {
  it("neutral scene = the base 5_000 bp", () => {
    expect(
      computeUnderwaterTubeSevereFloodingBp({
        loadedCount: 1,
        propulsionType: "WET_HEATER",
        isolationState: "DEGRADED",
        protectionLevel: "STANDARD",
      }),
    ).toBe(5_000);
  });

  it("each group scales the probability exactly (one FLOOR)", () => {
    expect(
      computeUnderwaterTubeSevereFloodingBp({
        loadedCount: 0,
        propulsionType: "ELECTRIC",
        isolationState: "INTACT",
        protectionLevel: "IMPROVED",
      }),
    ).toBe(527);
  });

  it("clamps at 10_000 and floors to 0 for extreme/neutral groups", () => {
    expect(
      computeUnderwaterTubeSevereFloodingBp({
        loadedCount: 2,
        propulsionType: "OXYGEN",
        isolationState: "FAILED",
        protectionLevel: "NONE",
      }),
    ).toBe(10_000);
    expect(
      computeUnderwaterTubeSevereFloodingBp({
        loadedTubeMultiplierBp: 1,
        propulsionMultiplierBp: 1,
        isolationMultiplierBp: 1,
        protectionMultiplierBp: 1,
      }),
    ).toBe(0);
  });

  it("rejects missing/malformed inputs (fail closed — no silent defaults)", () => {
    expect(() =>
      computeUnderwaterTubeSevereFloodingBp({
        loadedCount: 1,
        propulsionType: "WET_HEATER",
        isolationState: "DEGRADED",
        protectionLevel: undefined,
      } as never),
    ).toThrow(BluewaveError);
    expect(() =>
      computeUnderwaterTubeSevereFloodingBp({
        loadedTubeMultiplierBp: 100_001,
        propulsionMultiplierBp: 10_000,
        isolationMultiplierBp: 10_000,
        protectionMultiplierBp: 10_000,
      }),
    ).toThrow(BluewaveError);
  });
});

describe("AC-18 §21: the severe-flooding budget (5_000 bp of reserve, capped)", () => {
  it("computes floor(reserve × 5_000/10_000) and caps at the reserve", () => {
    expect(computeSevereImmediateFloodingKg(10_000)).toBe(5_000);
    expect(computeSevereImmediateFloodingKg(1_234)).toBe(617);
    expect(computeSevereImmediateFloodingKg(3)).toBe(1);
    expect(computeSevereImmediateFloodingKg(1)).toBe(0);
    expect(computeSevereImmediateFloodingKg(0)).toBe(0);
    expect(() => computeSevereImmediateFloodingKg(-1)).toThrow(BluewaveError);
  });
});

describe("AC-18 §21: the full hazard resolution", () => {
  function resolve(o: { draws?: number[]; probabilityBp?: number; loadedCount?: number } = {}) {
    const queue = [...(o.draws ?? [0.001])];
    return resolveUnderwaterTubeHitHazard({
      battleId: "B1",
      impactMinute: 6,
      impactSubstep: 4,
      torpedoTrackId: "T1",
      launcherId: "LCH-1",
      severeFloodingProbabilityBp: o.probabilityBp ?? 5_000,
      loadedTubeCount: o.loadedCount ?? 2,
      loadedChecks: [
        { tubeIndex: 0, torpedoModelId: "ger_533mm_g7a_1934" },
        { tubeIndex: 1, torpedoModelId: "ger_533mm_g7e_1936" },
      ],
      baseProgressiveRateKgMin: 10_000,
      remainingFlotationReserve: 10_000,
      crewAtRisk: 100,
      shockCandidates: [{ stableSystemId: "STEERING-1", band: "PRIMARY" }],
      keyedRng: () => queue.shift() ?? 0.5,
      targetCompartmentId: "TUBE-BAY-1",
    });
  }

  it("a sub-probability draw IS severe — every §21 effect fires", () => {
    const r = resolve({ draws: [0.001, 0.9999] });
    expect(r.severe).toBe(true);
    expect(r.immediateAdditionalFloodingKg).toBe(5_000);
    expect(r.extraFloodingSource).toEqual({
      compartmentId: "TUBE-BAY-1",
      rateKgMin: 15_000,
      cause: UNDERWATER_TUBE_SEVERE_FLOODING,
    });
    expect(r.launcherDamageState).toBe("DESTROYED");
    expect(r.chainChecks).toEqual([
      { tubeIndex: 0, torpedoModelId: "ger_533mm_g7a_1934" },
      { tubeIndex: 1, torpedoModelId: "ger_533mm_g7e_1936" },
    ]);
    expect(r.crewCasualties).toBe(0);
    expect(r.crewCasualtyRoll).not.toBeNull();
    expect(r.shockCandidates).toEqual([{ stableSystemId: "STEERING-1", band: "PRIMARY" }]);
    expect(r.reasonCode).toBe(UNDERWATER_TUBE_SEVERE_FLOODING);
    expect(Object.isFrozen(r)).toBe(true);
  });

  it("a casualty strike applies 2_500 bp of the at-risk crew", () => {
    const r = resolve({ draws: [0.0, 0.0001] });
    expect(r.crewCasualties).toBe(Math.floor((100 * 2_500) / 10_000));
    expect(r.crewCasualtyRoll?.streamId).toBe(
      "battle/torpedo/tube-hazard/casualty:B1:6:4:T1:LCH-1",
    );
  });

  it("a draw at/above the severe probability is NON-severe (only the hazard draw)", () => {
    let calls = 0;
    const r = resolveUnderwaterTubeHitHazard({
      battleId: "B1",
      impactMinute: 6,
      impactSubstep: 4,
      torpedoTrackId: "T1",
      launcherId: "LCH-1",
      severeFloodingProbabilityBp: 5_000,
      loadedTubeCount: 2,
      loadedChecks: [],
      baseProgressiveRateKgMin: 10_000,
      remainingFlotationReserve: 10_000,
      crewAtRisk: 100,
      shockCandidates: [],
      keyedRng: () => {
        calls += 1;
        return 0.5;
      },
      targetCompartmentId: "TUBE-BAY-1",
    });
    expect(r.severe).toBe(false);
    expect(r.immediateAdditionalFloodingKg).toBe(0);
    expect(r.extraFloodingSource).toBeNull();
    expect(r.launcherDamageState).toBe("OPERATIONAL");
    expect(r.chainChecks).toEqual([]);
    expect(r.crewCasualtyRoll).toBeNull();
    expect(r.reasonCode).toBeNull();
    expect(calls).toBe(1);
  });

  it("severe branch consumes exactly TWO draws (hazard + casualty)", () => {
    let calls = 0;
    const r = resolveUnderwaterTubeHitHazard({
      battleId: "B1",
      impactMinute: 6,
      impactSubstep: 4,
      torpedoTrackId: "T1",
      launcherId: "LCH-1",
      severeFloodingProbabilityBp: 5_000,
      loadedTubeCount: 0,
      loadedChecks: [],
      baseProgressiveRateKgMin: 10_000,
      remainingFlotationReserve: 10_000,
      crewAtRisk: 100,
      shockCandidates: [],
      keyedRng: () => {
        calls += 1;
        return 0.0001;
      },
      targetCompartmentId: "TUBE-BAY-1",
    });
    expect(r.severe).toBe(true);
    expect(calls).toBe(2);
  });

  it("rejects malformed identity inputs (fail closed)", () => {
    expect(() =>
      resolveUnderwaterTubeHitHazard({
        battleId: "",
        impactMinute: 6,
        impactSubstep: 4,
        torpedoTrackId: "T1",
        launcherId: "LCH-1",
        severeFloodingProbabilityBp: 5_000,
        loadedTubeCount: 0,
        loadedChecks: [],
        baseProgressiveRateKgMin: 10_000,
        remainingFlotationReserve: 10_000,
        crewAtRisk: 0,
        shockCandidates: [],
        keyedRng: () => 0.001,
        targetCompartmentId: "TUBE-BAY-1",
      }),
    ).toThrow(BluewaveError);
  });
});
