import { describe, it, expect } from "vite-plus/test";
import { BluewaveError, SafeInt, isBluewaveError } from "@bluewave/contracts";
import {
  AIR_DEFENSE_INVARIANT_FAILED,
  DisruptionRecord,
  DisruptionSeverity,
  DisruptionSeverityType,
  Layer,
  LayerId,
  computeStackedDisruptionMultipliers,
  disruptionSeverityMultiplier,
  disruptionSeverityRank,
  resolveLayerDisruption,
} from "../../src/air-defense/index.js";

function record(severity: DisruptionSeverityType, layer: LayerId): DisruptionRecord {
  return { severity, bp: SafeInt(0), timestampMs: SafeInt(0), layer };
}

describe("AC-12: disruption severity multipliers (§6 lines 118-123)", () => {
  it("LIGHT is 9_000 accuracy / 9_500 cohesion", () => {
    const m = disruptionSeverityMultiplier(DisruptionSeverity.LIGHT);
    expect(Number(m.accuracyBp)).toBe(9_000);
    expect(Number(m.cohesionBp)).toBe(9_500);
  });

  it("MODERATE is 7_500 accuracy / 8_500 cohesion", () => {
    const m = disruptionSeverityMultiplier(DisruptionSeverity.MODERATE);
    expect(Number(m.accuracyBp)).toBe(7_500);
    expect(Number(m.cohesionBp)).toBe(8_500);
  });

  it("SEVERE is 5_000 accuracy / 6_500 cohesion", () => {
    const m = disruptionSeverityMultiplier(DisruptionSeverity.SEVERE);
    expect(Number(m.accuracyBp)).toBe(5_000);
    expect(Number(m.cohesionBp)).toBe(6_500);
  });

  it("MISSION_ABORT is 0 accuracy / 0 cohesion (attack does not proceed)", () => {
    const m = disruptionSeverityMultiplier(DisruptionSeverity.MISSION_ABORT);
    expect(Number(m.accuracyBp)).toBe(0);
    expect(Number(m.cohesionBp)).toBe(0);
  });
});

describe("AC-12: severity ordering", () => {
  it("ranks LIGHT < MODERATE < SEVERE < MISSION_ABORT", () => {
    expect(disruptionSeverityRank(DisruptionSeverity.LIGHT)).toBeLessThan(
      disruptionSeverityRank(DisruptionSeverity.MODERATE),
    );
    expect(disruptionSeverityRank(DisruptionSeverity.MODERATE)).toBeLessThan(
      disruptionSeverityRank(DisruptionSeverity.SEVERE),
    );
    expect(disruptionSeverityRank(DisruptionSeverity.SEVERE)).toBeLessThan(
      disruptionSeverityRank(DisruptionSeverity.MISSION_ABORT),
    );
  });
});

describe("AC-12: per-layer highest-severity selection (§6 line 125)", () => {
  it("returns null for an empty record set", () => {
    expect(resolveLayerDisruption([])).toBeNull();
  });

  it("returns the only record for a single record", () => {
    const rec = record(DisruptionSeverity.LIGHT, Layer.HEAVY_AA);
    expect(resolveLayerDisruption([rec])).toBe(rec);
  });

  it("keeps the highest severity of one layer", () => {
    const light = record(DisruptionSeverity.LIGHT, Layer.HEAVY_AA);
    const severe = record(DisruptionSeverity.SEVERE, Layer.HEAVY_AA);
    const result = resolveLayerDisruption([light, severe]);
    expect(result?.severity).toBe(DisruptionSeverity.SEVERE);
  });

  it("MISSION_ABORT wins over every other severity", () => {
    const missionAbort = record(DisruptionSeverity.MISSION_ABORT, Layer.LIGHT_AA);
    const severe = record(DisruptionSeverity.SEVERE, Layer.LIGHT_AA);
    const moderate = record(DisruptionSeverity.MODERATE, Layer.LIGHT_AA);
    expect(resolveLayerDisruption([moderate, missionAbort, severe])?.severity).toBe(
      DisruptionSeverity.MISSION_ABORT,
    );
  });

  it("ties keep the first deterministic record (canonical order)", () => {
    const first = record(DisruptionSeverity.SEVERE, Layer.HEAVY_AA);
    const second = record(DisruptionSeverity.SEVERE, Layer.HEAVY_AA);
    expect(resolveLayerDisruption([first, second])).toBe(first);
  });
});

describe("AC-12: cross-layer stacking with one floor (§6 line 125)", () => {
  it("neutral 10_000/10_000 when no layer produced disruption", () => {
    const stacked = computeStackedDisruptionMultipliers([]);
    expect(Number(stacked.accuracyBp)).toBe(10_000);
    expect(Number(stacked.cohesionBp)).toBe(10_000);
  });

  it("a single layer's multipliers pass through unchanged", () => {
    const stacked = computeStackedDisruptionMultipliers([
      record(DisruptionSeverity.LIGHT, Layer.HEAVY_AA),
    ]);
    expect(Number(stacked.accuracyBp)).toBe(9_000);
    expect(Number(stacked.cohesionBp)).toBe(9_500);
  });

  it("two layers multiply with one floor", () => {
    const stacked = computeStackedDisruptionMultipliers([
      record(DisruptionSeverity.SEVERE, Layer.HEAVY_AA),
      record(DisruptionSeverity.LIGHT, Layer.LIGHT_AA),
    ]);
    expect(Number(stacked.accuracyBp)).toBe(4_500);
    expect(Number(stacked.cohesionBp)).toBe(6_175);
  });

  it("three layers multiply with one floor over 10_000^2", () => {
    const stacked = computeStackedDisruptionMultipliers([
      record(DisruptionSeverity.SEVERE, Layer.HEAVY_AA),
      record(DisruptionSeverity.MODERATE, Layer.MEDIUM_AA),
      record(DisruptionSeverity.LIGHT, Layer.LIGHT_AA),
    ]);
    expect(Number(stacked.accuracyBp)).toBe(3_375);
    expect(Number(stacked.cohesionBp)).toBe(5_248);
  });

  it("is order-independent for a fixed set of layer representatives", () => {
    const a = [
      record(DisruptionSeverity.SEVERE, Layer.HEAVY_AA),
      record(DisruptionSeverity.LIGHT, Layer.LIGHT_AA),
    ];
    const b = [
      record(DisruptionSeverity.LIGHT, Layer.LIGHT_AA),
      record(DisruptionSeverity.SEVERE, Layer.HEAVY_AA),
    ];
    expect(computeStackedDisruptionMultipliers(a)).toEqual(computeStackedDisruptionMultipliers(b));
  });

  it("MISSION_ABORT in any layer zeroes the stacked multipliers", () => {
    const stacked = computeStackedDisruptionMultipliers([
      record(DisruptionSeverity.MISSION_ABORT, Layer.LIGHT_AA),
      record(DisruptionSeverity.SEVERE, Layer.HEAVY_AA),
    ]);
    expect(Number(stacked.accuracyBp)).toBe(0);
    expect(Number(stacked.cohesionBp)).toBe(0);
  });

  it("rejects two representatives of the same defense layer (Repair LOW-7, §6 line 125)", () => {
    let caught: unknown;
    try {
      computeStackedDisruptionMultipliers([
        record(DisruptionSeverity.SEVERE, Layer.HEAVY_AA),
        record(DisruptionSeverity.LIGHT, Layer.HEAVY_AA),
      ]);
    } catch (e) {
      caught = e;
    }
    expect(isBluewaveError(caught)).toBe(true);
    expect((caught as BluewaveError).context.code).toBe(AIR_DEFENSE_INVARIANT_FAILED);
    expect((caught as BluewaveError).context).toMatchObject({ layer: Layer.HEAVY_AA });
  });
});
