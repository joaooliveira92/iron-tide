import { describe, expect, it } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import { RandomEngine, RandomLedger } from "@bluewave/random";
import {
  EXPLOSION_CAUSE_LABELS,
  MINE_WARFARE_REPORT_PHASE,
  MINE_REPORT_CAUSE_CERTAIN_CONFIDENCE_BP,
  SHIPPED_UNDERWATER_EXPLOSION_IDENTIFICATION_CONTRACT,
  TORPEDO_ATTACK,
  UNDERWATER_EXPLOSION_BASE_WEIGHTS_BP,
  UNDERWATER_EXPLOSION_MODIFIER_KEYS,
  classifyUnderwaterExplosion,
  computeUnderwaterExplosionWeights,
  torpedoClassificationIsKnowledgeOnly,
  underwaterExplosionIdentificationPolicyId,
  underwaterExplosionReportStreamId,
  validateUnderwaterExplosionIdentificationContract,
  type UnderwaterExplosionContext,
} from "@bluewave/combat/mines";
import { MINE_REPORT_CAUSE_UNCERTAIN } from "@bluewave/combat/mines";

function ctx(overrides: Partial<UnderwaterExplosionContext> = {}): UnderwaterExplosionContext {
  return {
    reportId: "rpt-1",
    knownHostileMinePressure: false,
    observedTorpedoTrack: false,
    noSubmarineContact: false,
    portOrChokePointLocation: false,
    multipleSimultaneousExplosions: false,
    ...overrides,
  };
}

function firstSeedFor(
  label: string,
  overrides: Partial<UnderwaterExplosionContext>,
  limit = 5_000,
): string {
  for (let seed = 0; seed < limit; seed++) {
    const engine = new RandomEngine(`probe-${seed}`);
    const result = classifyUnderwaterExplosion(ctx(overrides), engine);
    if (result.classification === label) return `probe-${seed}`;
  }
  throw new BluewaveError("no seed produced the requested classification", { label, limit });
}

describe("AC-14: misidentification classifier (INC-6, §20)", () => {
  it("underwaterExplosionIdentificationPolicyId is the §20 report-signature id v1", () => {
    expect(underwaterExplosionIdentificationPolicyId).toBe(
      "underwater_explosion_identification_v1",
    );
  });

  it("ships EXACT base weights: mine 6_000, torpedo 3_000, unknown 1_000", () => {
    const weights = computeUnderwaterExplosionWeights(ctx());
    expect(weights.exactWeights.MINE_STRIKE).toBe(6_000);
    expect(weights.exactWeights.TORPEDO_ATTACK).toBe(3_000);
    expect(weights.exactWeights.UNDERWATER_EXPLOSION_UNKNOWN).toBe(1_000);
    expect(weights.total).toBe(10_000);
    expect(UNDERWATER_EXPLOSION_BASE_WEIGHTS_BP).toEqual({
      MINE_STRIKE: 6_000,
      TORPEDO_ATTACK: 3_000,
      UNDERWATER_EXPLOSION_UNKNOWN: 1_000,
    });
  });

  it("applies EXACT modifiers: mine +2_000 (hostile pressure), torpedo +5_000 (track)", () => {
    const w = computeUnderwaterExplosionWeights(
      ctx({ knownHostileMinePressure: true, observedTorpedoTrack: true }),
    );
    expect(w.exactWeights.MINE_STRIKE).toBe(8_000);
    expect(w.exactWeights.TORPEDO_ATTACK).toBe(8_000);
    expect(w.exactWeights.UNDERWATER_EXPLOSION_UNKNOWN).toBe(1_000);
  });

  it("applies EXACT modifiers: torpedo -1_000 (no submarine contact), mine +1_000 (port/choke)", () => {
    const w = computeUnderwaterExplosionWeights(
      ctx({ noSubmarineContact: true, portOrChokePointLocation: true }),
    );
    expect(w.exactWeights.MINE_STRIKE).toBe(7_000);
    expect(w.exactWeights.TORPEDO_ATTACK).toBe(2_000);
    expect(w.exactWeights.UNDERWATER_EXPLOSION_UNKNOWN).toBe(1_000);
  });

  it("weights are NEVER negative, and totals never collapse to 0, across every shipped modifier combo", () => {
    const bools = [false, true];
    for (const knownHostileMinePressure of bools)
      for (const observedTorpedoTrack of bools)
        for (const noSubmarineContact of bools)
          for (const portOrChokePointLocation of bools) {
            const w = computeUnderwaterExplosionWeights(
              ctx({
                knownHostileMinePressure,
                observedTorpedoTrack,
                noSubmarineContact,
                portOrChokePointLocation,
              }),
            );
            for (const label of EXPLOSION_CAUSE_LABELS) {
              expect(w.exactWeights[label]).toBeGreaterThanOrEqual(0);
            }
            expect(w.total).toBeGreaterThan(0);
          }
    const normW = computeUnderwaterExplosionWeights(
      ctx({ knownHostileMinePressure: true, observedTorpedoTrack: true }),
    );
    const sum = EXPLOSION_CAUSE_LABELS.reduce((s, l) => s + normW.normalizedWeightsBp[l], 0);
    expect(sum).toBe(10_000);
  });

  it("selects via the §20 keyed stream literal and records a full RandomDecision", () => {
    const engine = new RandomEngine("seed-a");
    const ledger = new RandomLedger();
    const result = classifyUnderwaterExplosion(ctx(), engine, ledger);
    expect(EXPLOSION_CAUSE_LABELS).toContain(result.classification);
    expect(ledger.all).toHaveLength(1);
    const d = ledger.all[0]!;
    expect(d.streamId).toBe("mine_warfare/report/underwater_explosion");
    expect(d.streamId).toBe(underwaterExplosionReportStreamId);
    expect(d.entityKey).toBe("rpt-1");
    expect(d.phase).toBe("mine_warfare_report");
    expect(d.phase).toBe(MINE_WARFARE_REPORT_PHASE);
    expect(d.rulesetVersion).toBe("mine_ruleset_v1");
    expect(typeof d.inputHash).toBe("string");
    expect(Number.isInteger(d.draw)).toBe(true);
    expect(d.draw).toBeGreaterThanOrEqual(0);
    expect(d.draw).toBeLessThan(result.total);
    expect(d.outcome).toBe(result.classification);
    expect(d.reasonCode).toBe(MINE_REPORT_CAUSE_UNCERTAIN);
    expect(result.decision).toEqual(d);
  });

  it("is deterministic across two runs with the same seed and inputs", () => {
    const r1 = classifyUnderwaterExplosion(ctx(), new RandomEngine("same-seed"));
    const r2 = classifyUnderwaterExplosion(ctx(), new RandomEngine("same-seed"));
    expect(r1.classification).toBe(r2.classification);
    expect(r1.draw).toBe(r2.draw);
    expect(r1.decision).toEqual(r2.decision);
    expect(r1.normalizedWeightsBp).toEqual(r2.normalizedWeightsBp);
  });

  it("multipleSimultaneousExplosions is recognized but UNIMPLEMENTED (event-defined): no weight change", () => {
    const base = computeUnderwaterExplosionWeights(ctx());
    const flagged = computeUnderwaterExplosionWeights(
      ctx({ multipleSimultaneousExplosions: true }),
    );
    expect(flagged.multipleSimultaneousExplosionsRecognizedUnimplemented).toBe(true);
    expect(base.multipleSimultaneousExplosionsRecognizedUnimplemented).toBe(false);
    expect(flagged.exactWeights).toEqual(base.exactWeights);
    expect(flagged.total).toBe(base.total);
    expect(UNDERWATER_EXPLOSION_MODIFIER_KEYS).toContain("multipleSimultaneousExplosions");
  });

  it("ships the *_v1 contract with all §20 literals and a fail-closed validate guard", () => {
    validateUnderwaterExplosionIdentificationContract(
      SHIPPED_UNDERWATER_EXPLOSION_IDENTIFICATION_CONTRACT,
    );
    expect(SHIPPED_UNDERWATER_EXPLOSION_IDENTIFICATION_CONTRACT.policyId).toBe(
      "underwater_explosion_identification_v1",
    );
    expect(SHIPPED_UNDERWATER_EXPLOSION_IDENTIFICATION_CONTRACT.streamId).toBe(
      "mine_warfare/report/underwater_explosion",
    );
    expect(SHIPPED_UNDERWATER_EXPLOSION_IDENTIFICATION_CONTRACT.weightFloor).toBe(0);
    expect(
      SHIPPED_UNDERWATER_EXPLOSION_IDENTIFICATION_CONTRACT.multipleSimultaneousExplosionsModifier,
    ).toBe("EVENT_DEFINED");
    expect(SHIPPED_UNDERWATER_EXPLOSION_IDENTIFICATION_CONTRACT.certainThresholdBp).toBe(
      MINE_REPORT_CAUSE_CERTAIN_CONFIDENCE_BP,
    );
  });

  it("the fail-closed guard rejects ANY tampered literal (never a silent drift)", () => {
    const tamperedPolicy: typeof SHIPPED_UNDERWATER_EXPLOSION_IDENTIFICATION_CONTRACT = {
      ...SHIPPED_UNDERWATER_EXPLOSION_IDENTIFICATION_CONTRACT,
      policyId: "hacked",
    };
    expect(() => validateUnderwaterExplosionIdentificationContract(tamperedPolicy)).toThrow(
      BluewaveError,
    );

    const tamperedBase = {
      ...SHIPPED_UNDERWATER_EXPLOSION_IDENTIFICATION_CONTRACT,
      baseWeights: {
        MINE_STRIKE: 6_001,
        TORPEDO_ATTACK: 3_000,
        UNDERWATER_EXPLOSION_UNKNOWN: 1_000,
      },
    };
    expect(() => validateUnderwaterExplosionIdentificationContract(tamperedBase)).toThrow(
      BluewaveError,
    );

    const tamperedMod = {
      ...SHIPPED_UNDERWATER_EXPLOSION_IDENTIFICATION_CONTRACT,
      observedTorpedoTrackModifierBp: 5_001,
    };
    expect(() => validateUnderwaterExplosionIdentificationContract(tamperedMod)).toThrow(
      BluewaveError,
    );

    const tamperedStream = {
      ...SHIPPED_UNDERWATER_EXPLOSION_IDENTIFICATION_CONTRACT,
      streamId: "wrong/stream",
    };
    expect(() => validateUnderwaterExplosionIdentificationContract(tamperedStream)).toThrow(
      BluewaveError,
    );

    const tamperedMultiple = {
      ...SHIPPED_UNDERWATER_EXPLOSION_IDENTIFICATION_CONTRACT,
      multipleSimultaneousExplosionsModifier: "MINE+999",
    };
    expect(() => validateUnderwaterExplosionIdentificationContract(tamperedMultiple)).toThrow(
      BluewaveError,
    );
  });

  it("FALSE-TORPEDO SAFETY: a TORPEDO_ATTACK classification is knowledge-state only — never a real asset/attack", () => {
    expect(torpedoClassificationIsKnowledgeOnly()).toBe(true);
    const torpedoSeed = firstSeedFor(TORPEDO_ATTACK, { observedTorpedoTrack: true });
    const result = classifyUnderwaterExplosion(
      ctx({ observedTorpedoTrack: true }),
      new RandomEngine(torpedoSeed),
    );
    expect(result.classification).toBe(TORPEDO_ATTACK);
    const keys = Object.keys(result).sort();
    expect(keys).not.toContain("assetId");
    expect(keys).not.toContain("attack");
    expect(keys).not.toContain("torpedoId");
    expect(keys).not.toContain("submarineId");
    expect(result.classification).toBe(TORPEDO_ATTACK);
  });

  it("classification is always one of the three §20 labels (never undefined)", () => {
    for (const seed of ["p1", "p2", "p3", "p4", "p5", "p6"]) {
      const r = classifyUnderwaterExplosion(
        ctx({ knownHostileMinePressure: true }),
        new RandomEngine(seed),
      );
      expect(EXPLOSION_CAUSE_LABELS).toContain(r.classification);
      expect(r.draw).toBeLessThan(r.total);
    }
  });
});
