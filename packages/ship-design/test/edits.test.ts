import { describe, it, expect } from "vite-plus/test";
import {
  applyEdit,
  previewEdit,
  improves,
  EditError,
  compileDesign,
  bp,
  kg,
  type DraftEdit,
} from "../src/index.js";
import { ctx, draft } from "./fixtures/gunboat.js";

describe("applyEdit", () => {
  it("is pure and covers every edit kind", () => {
    const snapshot = JSON.stringify(draft);
    const edits: DraftEdit[] = [
      { kind: "set_hull", patch: { designMarginBp: bp(500) } },
      { kind: "set_machinery", patch: { installedKw: 3_000 } },
      { kind: "set_requirement", patch: { category: "CL", requiredSpeedMilliKnots: 18_000 } },
      { kind: "move_placement", instanceId: "rf", zoneId: "SUPERSTRUCTURE", stationPermille: 560 },
      { kind: "set_param", instanceId: "c_6pdr_p", param: "rounds", value: 100 },
      { kind: "set_armour_region", region: { ...draft.armour.regions[0]!, thicknessUm: 40_000 } },
      { kind: "remove_armour_region", region: "SPLINTER_PLATING" },
      { kind: "remove_placement", instanceId: "rf" },
      {
        kind: "add_placement",
        placement: {
          instanceId: "extra",
          componentId: "dynamo_60kw",
          zoneId: "FWD_SERVICE",
          stationPermille: 190,
        },
      },
    ];
    for (const e of edits) expect(applyEdit(draft, e)).not.toEqual(draft);
    expect(JSON.stringify(draft)).toBe(snapshot);
    expect(
      applyEdit(draft, edits[5]!).armour.regions.filter((r) => r.region === "DECK_MAIN"),
    ).toHaveLength(1);
  });
  it("set_requirement changes only the brief, merging the patch", () => {
    const next = applyEdit(draft, { kind: "set_requirement", patch: { requiredRangeNm: 4_321 } });
    expect(next.requirement).toEqual({ ...draft.requirement, requiredRangeNm: 4_321 });
    expect({ ...next, requirement: draft.requirement }).toEqual(draft);
  });
  it("rejects edits that reference nothing, and removing a magazine drops dangling links", () => {
    expect(() => applyEdit(draft, { kind: "remove_placement", instanceId: "ghost" })).toThrow(
      EditError,
    );
    expect(() =>
      applyEdit(draft, { kind: "set_param", instanceId: "ghost", param: "x", value: 1 }),
    ).toThrow(EditError);
    expect(() =>
      applyEdit(draft, { kind: "add_placement", placement: draft.placements[0]! }),
    ).toThrow(EditError);
    const removed = applyEdit(draft, { kind: "remove_placement", instanceId: "mag_aft" });
    expect(removed.placements.some((p) => p.magazineRef === "mag_aft")).toBe(false);
  });
});

describe("previewEdit", () => {
  const overweight = { ...draft, machinery: { ...draft.machinery, fuelCapacityKg: 400_000 } };
  it("shows a remedy resolving the overweight block without applying it", () => {
    const p = previewEdit(overweight, ctx, {
      kind: "set_machinery",
      patch: { fuelCapacityKg: 150_000 },
    });
    expect(p.resolved).toContain("BLOCKING:OVERWEIGHT_UNRECOVERABLE");
    expect(p.totalKgDelta).toBeLessThan(0);
    expect(p.countsBefore.BLOCKING).toBeGreaterThan(p.countsAfter.BLOCKING);
    expect(improves(p)).toBe(true);
    expect(overweight.machinery.fuelCapacityKg).toBe(400_000);
  });
  it("reports introduced problems and detects non-improvements", () => {
    const p = previewEdit(draft, ctx, { kind: "set_machinery", patch: { installedKw: 0 } });
    expect(p.introduced).toContain("BLOCKING:NO_PROPULSION");
    expect(improves(p)).toBe(false);
    const noop = previewEdit(draft, ctx, {
      kind: "set_hull",
      patch: { targetDisplacementKg: kg(705_000) },
    });
    expect(noop.result.hash).toBe(compileDesign(draft, ctx).hash);
    expect(improves(noop)).toBe(false);
  });
});
