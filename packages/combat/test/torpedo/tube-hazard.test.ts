// AC-18 (DESIGN-40 §21): underwater-tube hit hazard. Base severe-flooding
// probability exactly 5_000 bp; shipped loaded-tube 2_500/10_000/12_500,
// propulsion ordinary air/wet-heater 10_000 / oxygen 15_000 / electric 7_500,
// isolation intact/degraded/failed 7_500/10_000/15_000, protection
// none/standard/improved 12_500/10_000/7_500;
//   severeBp = clamp(0, 10_000, floor(5_000 × group product / 10_000^4))
// A severe result (one keyed hazard draw): immediate flooding 5_000 bp of the
// remaining reserve (capped), ONE extra source at rate-multiplier 15_000,
// launcher DESTROYED, §22 chain probes per loaded tube, crew-casualty +
// shock checks -> UNDERWATER_TUBE_SEVERE_FLOODING. Non-severe consumes only
// the hazard draw (the casualty draw exists only on the severe branch).
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
    // 5_000 × 10_000⁴ / 10_000^4 = 5_000
    expect(
      computeUnderwaterTubeSevereFloodingBp({
        loadedCount: 1, // 10_000
        propulsionType: "WET_HEATER", // 10_000
        isolationState: "DEGRADED", // 10_000
        protectionLevel: "STANDARD", // 10_000
      }),
    ).toBe(5_000);
  });

  it("each group scales the probability exactly (one FLOOR)", () => {
    // floor(5_000 × 12_500 × 15_000 × 15_000 × 12_500 / 10_000^4) =
    // floor(175_781.25) = 175_781 -> clamped to 10_000 (see clamp test); use
    // the mixed hazard scene for the FLOOR arithmetic:
    // floor(5_000 × 2_500 × 7_500 × 7_500 × 7_500 / 10^16) = 527
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
    ).toBe(10_000); // the raw product (~17_578) exceeds the 10_000 ceiling clamp
    // raw 1 bp multipliers floor the product to 0
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
    // missing protection group -> fail closed
    expect(() =>
      computeUnderwaterTubeSevereFloodingBp({
        loadedCount: 1,
        propulsionType: "WET_HEATER",
        isolationState: "DEGRADED",
        protectionLevel: undefined,
      } as never),
    ).toThrow(BluewaveError);
    // out-of-band raw multiplier (>100_000 bp)
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
    expect(computeSevereImmediateFloodingKg(3)).toBe(1); // floor(1.5)
    expect(computeSevereImmediateFloodingKg(1)).toBe(0); // floor(0.5)
    expect(computeSevereImmediateFloodingKg(0)).toBe(0);
    expect(() => computeSevereImmediateFloodingKg(-1)).toThrow(BluewaveError);
  });
});

describe("AC-18 §21: the full hazard resolution", () => {
  // deterministic draw queue: draws are consumed in the fixed layout order
  // hazard -> casualty.
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
    const r = resolve({ draws: [0.001, 0.9999] }); // hazard strike, no casualty
    expect(r.severe).toBe(true);
    // 1) immediate additional flooding = 5_000 bp of the remaining reserve
    expect(r.immediateAdditionalFloodingKg).toBe(5_000);
    // 2) one extra source at the rate multiplier 15_000 bp
    expect(r.extraFloodingSource).toEqual({
      compartmentId: "TUBE-BAY-1",
      rateKgMin: 15_000, // floor(10_000 × 15_000 / 10_000)
      cause: UNDERWATER_TUBE_SEVERE_FLOODING,
    });
    // 3) launcher DESTROYED
    expect(r.launcherDamageState).toBe("DESTROYED");
    // 4) §22 chain probes per loaded tube
    expect(r.chainChecks).toEqual([
      { tubeIndex: 0, torpedoModelId: "ger_533mm_g7a_1934" },
      { tubeIndex: 1, torpedoModelId: "ger_533mm_g7e_1936" },
    ]);
    // 5) casualty check rolled (non-strike draw) + shock pool recorded
    expect(r.crewCasualties).toBe(0);
    expect(r.crewCasualtyRoll).not.toBeNull();
    expect(r.shockCandidates).toEqual([{ stableSystemId: "STEERING-1", band: "PRIMARY" }]);
    expect(r.reasonCode).toBe(UNDERWATER_TUBE_SEVERE_FLOODING);
    expect(Object.isFrozen(r)).toBe(true);
  });

  it("a casualty strike applies 2_500 bp of the at-risk crew", () => {
    // hazard draw 0.0 (severe) + casualty draw 0.0001 => drawBp 1 < 5_000 => strike
    const r = resolve({ draws: [0.0, 0.0001] });
    expect(r.crewCasualties).toBe(Math.floor((100 * 2_500) / 10_000)); // 25
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
        return 0.5; // drawBp 5_000 >= 5_000 -> non-severe
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
    expect(calls).toBe(1); // exactly ONE draw on the non-severe path
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
