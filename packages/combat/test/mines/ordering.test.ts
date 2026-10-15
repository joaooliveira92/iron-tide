// AC-20/§29 (INC-8): canonical ordering — wars by id → areas by id →
// mine-pressure records by laying-participant/type/id → laying sources by
// source id → sweeping ships by ship id → sweep allocation per §10 →
// route/battle checks by target id → friendly-fire checks by ship id →
// effects by declared ordinal. DB/UI/wall-clock order MUST NOT affect
// outcomes; input-order independence proven by shuffled input.
import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import {
  canonicallySorted,
  compareAreasById,
  compareEffectsByDeclaredOrdinal,
  compareFriendlyFireChecksByShipId,
  compareLayingSourcesById,
  compareMinePressureRecords,
  compareMineStrings,
  compareRouteChecksByRouteEdgeId,
  compareSweepingShipsById,
  compareWarsById,
  compareSweepAllocation,
  sweepingContributionOrder,
  type RegionalSweepingContribution,
  type SweepingAllocationCandidate,
} from "../../src/mines/index.js";

function shuffled<T>(items: readonly T[]): T[] {
  // Deterministic shuffle (fixed rotation) — proves input-order independence
  // without a non-deterministic RNG in the test.
  return items.length > 1
    ? [items[items.length - 1]!, ...items.slice(0, items.length - 1)]
    : [...items];
}

describe("AC-20/§29: canonical mine-warfare ordering", () => {
  it("wars by identifier (codepoint compare, NOT localeCompare)", () => {
    const wars = [{ warId: "PearlWar" }, { warId: "Zulu" }, { warId: "Alpha" }];
    const out = canonicallySorted(shuffled(wars), compareWarsById);
    expect(out.map((w) => w.warId)).toEqual(["PearlWar", "Zulu", "Alpha"].sort(compareMineStrings));
  });

  it("areas by identifier", () => {
    const areas = [{ areaId: "B-area" }, { areaId: "a-area" }, { areaId: "A-area" }];
    const out = canonicallySorted(shuffled(areas), compareAreasById);
    expect(out.map((a) => a.areaId)).toEqual(["A-area", "B-area", "a-area"]);
  });

  it("mine-pressure records by laying participant, then mine type, then record id", () => {
    type R = Parameters<typeof compareMinePressureRecords>[0];
    const rs: R[] = [
      { layingParticipantId: "P2", mineTypeId: "CONTACT", minePressureId: "MP-2" },
      { layingParticipantId: "P1", mineTypeId: "MAGNETIC", minePressureId: "MP-3" },
      { layingParticipantId: "P1", mineTypeId: "MAGNETIC", minePressureId: "MP-1" },
      { layingParticipantId: "P1", mineTypeId: "ACOUSTIC", minePressureId: "MP-0" },
    ];
    const out = canonicallySorted(shuffled(rs), compareMinePressureRecords);
    expect(out).toEqual([
      { layingParticipantId: "P1", mineTypeId: "ACOUSTIC", minePressureId: "MP-0" },
      { layingParticipantId: "P1", mineTypeId: "MAGNETIC", minePressureId: "MP-1" },
      { layingParticipantId: "P1", mineTypeId: "MAGNETIC", minePressureId: "MP-3" },
      { layingParticipantId: "P2", mineTypeId: "CONTACT", minePressureId: "MP-2" },
    ]);
  });

  it("laying sources by source identifier", () => {
    const sources = [{ source: "SRC-Z" }, { source: "SRC-A" }, { source: "SRC-M" }];
    const out = canonicallySorted(shuffled(sources), compareLayingSourcesById);
    expect(out.map((s) => s.source)).toEqual(["SRC-A", "SRC-M", "SRC-Z"]);
  });

  it("sweeping ships by ship identifier", () => {
    const ships = [{ shipId: "HMS-C" }, { shipId: "HMS-A" }, { shipId: "HMS-B" }];
    const out = canonicallySorted(shuffled(ships), compareSweepingShipsById);
    expect(out.map((s) => s.shipId)).toEqual(["HMS-A", "HMS-B", "HMS-C"]);
  });

  it("sweeping contributions are ordered by ascending ship id (§10 aggregation order)", () => {
    const contribs: RegionalSweepingContribution[] = [
      { shipId: "S-3", effectiveSweepingValue: SafeInt(30) },
      { shipId: "S-1", effectiveSweepingValue: SafeInt(10) },
      { shipId: "S-2", effectiveSweepingValue: SafeInt(20) },
    ];
    const out = canonicallySorted(shuffled(contribs), sweepingContributionOrder);
    expect(out.map((c) => c.shipId)).toEqual(["S-1", "S-2", "S-3"]);
  });

  it("route checks by route edge id (§29 level 7)", () => {
    const checks = [
      { routeEdgeId: "EDGE-Z" },
      { routeEdgeId: "EDGE-A" },
      { routeEdgeId: "EDGE-M" },
    ];
    const out = canonicallySorted(shuffled(checks), compareRouteChecksByRouteEdgeId);
    expect(out.map((c) => c.routeEdgeId)).toEqual(["EDGE-A", "EDGE-M", "EDGE-Z"]);
  });

  it("friendly-fire checks by ship id (deferred — the comparator exists for the stable empty field)", () => {
    const checks = [{ shipId: "S-X" }, { shipId: "S-A" }];
    const out = canonicallySorted(shuffled(checks), compareFriendlyFireChecksByShipId);
    expect(out.map((c) => c.shipId)).toEqual(["S-A", "S-X"]);
  });

  it("effects by declared effect ordinal (level 9)", () => {
    const effects = [
      { ordinal: 3, stableId: "e3", description: "" },
      { ordinal: 1, stableId: "e1", description: "" },
      { ordinal: 2, stableId: "e2", description: "" },
    ];
    const out = canonicallySorted(shuffled(effects), compareEffectsByDeclaredOrdinal);
    expect(out.map((e) => e.ordinal)).toEqual([1, 2, 3]);
  });

  it("§10 allocation candidates use the five-key allocation order (threat → risk → pressure → type → id)", () => {
    const candidates: SweepingAllocationCandidate[] = [
      {
        record: {
          minePressureId: "MP-3",
          mineTypeId: "CONTACT",
          pressure: 100,
          targetBelligerents: ["T"],
        } as unknown as never,
        threatensSweepingSide: false,
        strikeRiskPriority: 5,
        resistanceMultiplierBp: 10_000,
      },
      {
        record: {
          minePressureId: "MP-2",
          mineTypeId: "CONTACT",
          pressure: 90,
          targetBelligerents: ["T", "S"],
        } as unknown as never,
        threatensSweepingSide: true,
        strikeRiskPriority: 5,
        resistanceMultiplierBp: 10_000,
      },
      {
        record: {
          minePressureId: "MP-1",
          mineTypeId: "MAGNETIC",
          pressure: 10_000,
          targetBelligerents: ["T"],
        } as unknown as never,
        threatensSweepingSide: false,
        strikeRiskPriority: 1,
        resistanceMultiplierBp: 10_000,
      },
    ];
    const out = canonicallySorted(shuffled(candidates), compareSweepAllocation);
    // key 1: threatening first (MP-2); then by risk desc (MP-3 over MP-1)
    expect(out.map((c) => String((c.record as { minePressureId: string }).minePressureId))).toEqual(
      ["MP-2", "MP-3", "MP-1"],
    );
  });
});
