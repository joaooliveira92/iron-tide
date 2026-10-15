import { describe, it, expect } from "vite-plus/test";
import {
  compileHull,
  buoyantDisplacement,
  hullStructureWeight,
  reserveBuoyancyBp,
  emptyLedger,
  withLine,
  ledgerTotal,
  checkFindingShape,
  kg,
  mm,
  bp,
  LEDGER_CATEGORIES,
  type HullBalance,
  type HullForm,
  type HullSpec,
} from "../src/index.js";

const balance: HullBalance = {
  hullCoeffMilliKg: 9_900,
  seawaterKgPerM3: 1025,
  materialBp: { iron: 12_500, mild_steel: 10_000, high_tensile: 9_000 },
  schemeBp: { transverse: 10_500, mixed: 10_000, longitudinal: 9_500 },
  subdivisionBp: [8_000, 9_000, 10_000, 11_500, 13_000],
  buoyancyTolBp: 100,
  overTargetTolBp: 300,
  reserveBuoyancyWarnBp: 3_000,
  reserveBuoyancyCriticalBp: 1_500,
};
const form: HullForm = {
  id: "fine_light",
  lengthMinMm: 40_000,
  lengthMaxMm: 260_000,
  lbMinX100: 700,
  lbMaxX100: 1_300,
  formBp: bp(10_000),
  waterplaneCoeffBp: bp(7_500),
  sheerBp: bp(11_000),
};
const hull: HullSpec = {
  hullFormId: "fine_light",
  lengthWl: mm(70_000),
  beam: mm(8_400),
  draught: mm(2_600),
  depthToMainDeck: mm(5_200),
  blockCoeffBp: bp(4_500),
  materialId: "mild_steel",
  structuralSchemeId: "mixed",
  subdivisionGrade: 2,
  targetDisplacementKg: kg(705_000),
  limitDisplacementKg: null,
  designMarginBp: bp(400),
  growthReserveBp: bp(0),
};
const loads = (extra: Partial<Record<(typeof LEDGER_CATEGORIES)[number], number>> = {}) => {
  let l = emptyLedger();
  const base = {
    machinery: 109_000,
    fuel: 175_000,
    armour: 20_000,
    armament: 28_000,
    ammunition: 9_000,
    sensors: 1_000,
    mission: 14_000,
    crew: 12_000,
    auxiliary: 22_000,
    ...extra,
  };
  for (const [k, v] of Object.entries(base)) l = withLine(l, k as never, kg(v));
  return l;
};

describe("hull physics", () => {
  it("F-H1 buoyant displacement matches hand calculation", () => {
    // 70*8.4*2.6*0.45*1.025 t = 705.159 t
    expect(buoyantDisplacement(hull, balance)).toBe(705_159);
  });
  it("F-H2 hull weight is monotone in length and positive", () => {
    const a = hullStructureWeight(hull, form, balance);
    const b = hullStructureWeight({ ...hull, lengthWl: mm(80_000) }, form, balance);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
  });
  it("materials trade weight: iron heavier than high-tensile", () => {
    const iron = hullStructureWeight({ ...hull, materialId: "iron" }, form, balance);
    const ht = hullStructureWeight({ ...hull, materialId: "high_tensile" }, form, balance);
    expect(iron).toBeGreaterThan(ht);
  });
  it("F-H4 reserve buoyancy grows with depth and is zero without freeboard", () => {
    expect(reserveBuoyancyBp(hull, form)).toBe(
      Math.floor((2_600 * 7_500 * 11_000) / (2_600 * 4_500)),
    );
    expect(reserveBuoyancyBp({ ...hull, depthToMainDeck: mm(2_600) }, form)).toBe(0);
  });
  it("unknown material throws rather than defaulting", () => {
    expect(() =>
      hullStructureWeight({ ...hull, materialId: "unobtainium" }, form, balance),
    ).toThrow();
  });
});

describe("compileHull", () => {
  it("total equals the sum of ledger lines and all lines are non-negative (I1, I2)", () => {
    const r = compileHull(hull, form, balance, loads());
    expect(r.totalKg).toBe(ledgerTotal(r.ledger));
    for (const c of LEDGER_CATEGORIES) expect(r.ledger[c]).toBeGreaterThanOrEqual(0);
    expect(r.ledger.hull).toBeGreaterThan(0);
    expect(r.ledger.margin).toBeGreaterThan(0);
  });
  it("overweight design is BLOCKING with cause and >= 3 remedies and is not auto-corrected", () => {
    const r = compileHull(hull, form, balance, loads({ fuel: 400_000 }));
    const f = r.findings.find((x) => x.id === "OVERWEIGHT_UNRECOVERABLE");
    expect(f?.severity).toBe("BLOCKING");
    expect(f!.remedies.length).toBeGreaterThanOrEqual(3);
    expect(checkFindingShape(f!)).toEqual([]);
    expect(f!.why).toContain("Short by");
    expect(r.ledger.fuel).toBe(400_000);
  });
  it("treaty limit breach is reported as OVERWEIGHT_LIMIT", () => {
    const r = compileHull({ ...hull, limitDisplacementKg: kg(500_000) }, form, balance, loads());
    expect(r.findings.some((x) => x.id === "OVERWEIGHT_LIMIT" && x.severity === "BLOCKING")).toBe(
      true,
    );
  });
  it("an underloaded hull warns instead of silently passing", () => {
    const r = compileHull(hull, form, balance, loads({ fuel: 20_000, machinery: 30_000 }));
    expect(r.findings.map((f) => f.id)).toContain("HULL_BUOYANCY_MISMATCH");
    expect(r.findings.every((f) => checkFindingShape(f).length === 0)).toBe(true);
  });
  it("flags dimension range and geometry errors", () => {
    expect(
      compileHull({ ...hull, lengthWl: mm(10_000) }, form, balance, loads()).findings.map(
        (f) => f.id,
      ),
    ).toContain("HULL_DIMENSION_RANGE");
    const g = compileHull({ ...hull, draught: mm(6_000) }, form, balance, loads());
    expect(g.findings[0]!.id).toBe("HULL_GEOMETRY_INVALID");
    expect(g.freeboardMm).toBe(0);
  });
  it("warns on proportions and low reserve buoyancy", () => {
    const p = compileHull({ ...hull, beam: mm(4_000) }, form, balance, loads());
    expect(p.findings.map((f) => f.id)).toContain("HULL_PROPORTIONS");
    const low = compileHull({ ...hull, depthToMainDeck: mm(2_800) }, form, balance, loads());
    const f = low.findings.find((x) => x.id === "LOW_RESERVE_BUOYANCY");
    expect(f?.severity).toBe("CRITICAL");
  });
  it("is deterministic", () => {
    const a = JSON.stringify(compileHull(hull, form, balance, loads()));
    for (let i = 0; i < 10; i++)
      expect(JSON.stringify(compileHull(hull, form, balance, loads()))).toBe(a);
  });
});
