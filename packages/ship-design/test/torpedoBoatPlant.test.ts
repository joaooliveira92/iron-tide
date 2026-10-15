import { describe, expect, it } from "vite-plus/test";
import { compileDesign, type DesignDraft } from "../src/index.js";
import {
  earlyContext,
  nationalContext,
  plants,
  readReferenceDesignEntries,
} from "./helpers/earlyContext.js";

/**
 * Ticket 37: the lightweight locomotive-boiler/compound plant, and the HMS TB2 reference design it makes
 * possible. The only 1880 plant before this (compound_cylindrical, 195 kg/kW, 300 kW minimum) weighs ~58 t at
 * its minimum — more than a whole first-class torpedo boat — so small torpedo craft could not be modelled.
 * Sources: docs/research/ship-building-content-sourcing.md section 3 (White 1894 machinery table p.562: the
 * single large locomotive boiler, first-class torpedo boat row, 70-80 lb/ihp = 43-49 kg/kW) and
 * docs/research/ship-building-1880-ships-by-nation.md section 1 (HMS TB2 class, 1878-79).
 */

const PLANT_ID = "compound_locomotive_tb";

const entries = readReferenceDesignEntries() as { id: string; month: string; draft: DesignDraft }[];
const tb2 = entries.find((d) => d.id === "tb2_1879")!;

describe("compound_locomotive_tb: a light plant for ~25-80 t torpedo craft (ticket 37)", () => {
  const plant = plants.find((p) => p.id === PLANT_ID)!;

  it("is a coal locomotive-boiler/compound set introduced 1880-01 on the compound engine", () => {
    expect(plant.fuelType).toBe("COAL");
    expect(plant.introduction?.fromMonth).toBe("1880-01");
    expect(plant.introduction?.obsoleteMonth).toBeNull();
    expect(plant.requires).toEqual(["mac_compound_engine"]);
    // The complete-machinery figure (engines + boilers + water; balance auxWeightBp is 0 because White
    // already covers the lot) sits inside the sourced 43-49 kg/kW band (White 1894 p.562).
    expect(plant.weightMilliKgPerKw).toBeGreaterThanOrEqual(43_000);
    expect(plant.weightMilliKgPerKw).toBeLessThanOrEqual(49_000);
  });

  it("is offered at 1880-01 and is sized for a ~343 kW torpedo boat but not a battleship", () => {
    expect(earlyContext("1880-01").plants.map((p) => p.id)).toContain(PLANT_ID);
    expect(plant.minKw).toBeLessThanOrEqual(343);
    expect(plant.maxKw).toBeGreaterThanOrEqual(343);
    // Small max power keeps it out of larger classes: a battleship cannot buy cheap power from it.
    expect(plant.maxKw).toBeLessThanOrEqual(600);
  });

  it("rejects a large power (8000 kW) with a blocking PLANT_SIZE_RANGE", () => {
    const over = {
      ...tb2.draft,
      machinery: { ...tb2.draft.machinery, installedKw: 8000 },
    } satisfies DesignDraft;
    const r = compileDesign(over, earlyContext("1880-01"));
    expect(r.findings.map((f) => f.id)).toContain("PLANT_SIZE_RANGE");
    expect(r.valid).toBe(false);
  });

  it("is unavailable before 1880-01 (and therefore before mac_compound_engine)", () => {
    const r = compileDesign(tb2.draft, earlyContext("1879-12"));
    expect(r.valid).toBe(false);
    expect(r.findings.map((f) => f.id)).toContain("TECH_UNAVAILABLE");
  });

  it("counts the complete propelling machinery (auxWeightBp 0), not just engines", () => {
    const r = compileDesign(tb2.draft, earlyContext("1880-01"));
    // 343 kW x 46 kg/kW = 15,778 kg is the whole machinery line: no separate piping/aux is added, because
    // the plant's kg/kW already is White 1894's complete-machinery figure.
    expect(r.ledger.machinery).toBe(15_778);
    expect(earlyContext("1880-01").balance.machinery.auxWeightBp).toBe(0);
  });
});

describe("tb2_1879: the HMS TB2 class reference design (ticket 37)", () => {
  it("compiles clean at 1880-01, naturally a DD, within overweight tolerance of the target", () => {
    const r = compileDesign(tb2.draft, earlyContext("1880-01"));
    expect(
      r.findings.filter((f) => f.severity === "BLOCKING" || f.severity === "CRITICAL"),
    ).toEqual([]);
    expect(r.valid).toBe(true);
    expect(r.naturalClass).toBe("DD");
    // The ledger total clears the overweight tolerance around the 28,000 kg target (hull.ts `overTargetTolBp`)
    // and is the known 28,771 kg after the deliberately omitted dyn/vent/funnel fittings (margin 838 kg).
    const overTargetTolBp = earlyContext("1880-01").balance.hull.overTargetTolBp;
    const targetCeiling = Math.floor((28_000 * (10_000 + overTargetTolBp)) / 10_000);
    expect(r.totalKg).toBeGreaterThan(0);
    expect(r.totalKg).toBeLessThanOrEqual(targetCeiling);
    expect(r.totalKg).toBe(28_771);
    expect(tb2.month).toBe("1880-01");
  });

  it("compiles cleanly under the UK national context at 1880-01 (domestic plant + capability)", () => {
    const r = compileDesign(tb2.draft, nationalContext("1880-01", "uk"));
    expect(r.valid).toBe(true);
    expect(
      r.findings.filter((f) => f.severity === "BLOCKING" || f.severity === "CRITICAL"),
    ).toEqual([]);
    expect(r.naturalClass).toBe("DD");
  });

  it("carries TB2's real specs as closely as this content models", () => {
    const r = compileDesign(tb2.draft, earlyContext("1880-01"));
    expect(tb2.draft.hull.hullFormId).toBe("torpedo_boat_form");
    expect(tb2.draft.machinery.plantId).toBe(PLANT_ID);
    expect(tb2.draft.machinery.installedKw).toBe(343); // 460 ihp
    expect(tb2.draft.requirement.requiredSpeedMilliKnots).toBe(20_000); // 20 kn
    expect(r.machinery!.maxSpeedMilliKnots).toBeGreaterThan(19_000); // clears the DD 19-knot rule
  });
});
