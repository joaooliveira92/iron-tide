import { describe, it, expect } from "vite-plus/test";
import {
  compileStability,
  ZONE_IDS,
  checkFindingShape,
  type StabilityBalance,
  type StabilityInput,
  type WeightItem,
  type ZoneDef,
} from "../src/index.js";

const edges = [0, 80, 180, 280, 520, 640, 760, 900, 1000];
const zones: ZoneDef[] = ZONE_IDS.map((id, i) => ({
  id,
  startPermille: id === "MISSION" ? 520 : edges[i]!,
  endPermille: id === "MISSION" ? 1000 : edges[i + 1]!,
  volumeBp: [500, 1400, 1100, 2800, 1200, 1100, 1000, 700, 200][i]!,
  deckAreaBp: [1200, 900, 900, 1500, 1500, 900, 900, 1500, 700][i]!,
}));
const buoy = [800, 1000, 1000, 2400, 1200, 1200, 1400, 1000, 0].map((v) => v);
const bal: StabilityBalance = {
  kbBp: 5_300,
  inertiaBp: 400,
  trimToleranceBp: 150,
  sectionModulusBp: 9_000,
  stressCriticalBp: 10_000,
  stressBlockingBp: 13_000,
  seakeepingFreeboard: {
    points: [
      [0, 2_000],
      [60, 6_000],
      [120, 10_000],
    ],
  },
  seakeepingGm: {
    points: [
      [0, 3_000],
      [600, 10_000],
      [2_500, 6_000],
    ],
  },
  thinMarginBp: 1_000,
};
const win = { gmMinMm: 500, gmCapsizeMm: 100, gmMaxMm: 2_000 };
const item = (
  label: string,
  kg: number,
  zMm: number,
  st: number,
  zoneId: WeightItem["zoneId"],
): WeightItem => ({ label, kg, zMm, stationPermille: st, zoneId });

const even = (zMul = 1): WeightItem[] =>
  ZONE_IDS.filter((z) => z !== "MISSION").map((z, i) =>
    item(
      z,
      buoy[i]! * 100,
      3_000 * zMul,
      Math.round((zones[i]!.startPermille + zones[i]!.endPermille) / 2),
      z,
    ),
  );
const base: StabilityInput = {
  items: even(),
  lengthMm: 100_000,
  beamMm: 11_000,
  draughtMm: 4_000,
  depthMm: 7_500,
  blockCoeffBp: 5_500,
  lcbPermille: 500,
  buoyancyByZoneBp: buoy,
  hullWeightKg: 300_000,
  window: win,
};
const run = (o: Partial<StabilityInput> = {}) => compileStability({ ...base, ...o }, zones, bal);

describe("compileStability", () => {
  it("computes KB/BM/KG/GM from hand numbers", () => {
    const r = run();
    expect(r.displacementKg).toBe(1_000_000);
    expect(r.kgMm).toBe(3_000);
    expect(r.kbMm).toBe(2_120);
    expect(r.bmMm).toBe(Math.floor((11_000 * 11_000 * 400) / (4_000 * 5_500)));
    expect(r.gmMm).toBe(2_120 + 2_200 - 3_000);
  });
  it("raising weights lowers GM monotonically (topweight)", () => {
    const g1 = run({ items: even(1) }).gmMm;
    const g2 = run({ items: even(1.5) }).gmMm;
    const g3 = run({ items: even(2) }).gmMm;
    expect(g1).toBeGreaterThan(g2);
    expect(g2).toBeGreaterThan(g3);
  });
  it("window: stiff warns, low is critical, capsize blocks, thin margin advises", () => {
    expect(run({ items: even(0.5) }).findings.map((f) => f.id)).toContain("STABILITY_STIFF");
    const low = run({ items: even(1.3) });
    expect(low.gmMm).toBeLessThan(500);
    expect(low.findings.find((f) => f.id === "STABILITY_LOW")!.severity).toBe("CRITICAL");
    const cap = run({ items: even(1.7) });
    const f = cap.findings.find((x) => x.id === "STABILITY_CAPSIZE")!;
    expect(f.severity).toBe("BLOCKING");
    expect(f.remedies.length).toBeGreaterThanOrEqual(3);
    expect(checkFindingShape(f)).toEqual([]);
    const thin = run({ items: even(1.26) });
    expect(thin.gmMm).toBeGreaterThanOrEqual(500);
    expect(thin.findings.map((x) => x.id)).toContain("STABILITY_MARGIN_THIN");
    expect(run().findings.filter((x) => x.severity !== "ADVISORY")).toEqual([]);
  });
  it("trim: bow-heavy and stern-heavy are flagged with escalating severity", () => {
    const shifted = (st: number) =>
      even().map((it) => ({ ...it, stationPermille: it.stationPermille + st }));
    const stern = run({ items: shifted(40) });
    expect(stern.trimBp).toBeGreaterThan(150);
    expect(stern.findings.map((f) => f.id)).toContain("TRIM_STERN_HEAVY");
    const bow = run({ items: shifted(-120) });
    expect(bow.findings.find((f) => f.id === "TRIM_BOW_HEAVY")!.severity).toBe("CRITICAL");
  });
  it("structural stress is ~0 when weights match buoyancy and rises with end/middle loading", () => {
    expect(run().stressBp).toBe(0);
    const heavyMid = even().map((it) =>
      it.zoneId === "CENTRAL_MACHINERY" ? { ...it, kg: it.kg * 3 } : it,
    );
    const sag = run({ items: heavyMid });
    expect(sag.peakBendingMomentKgMm).toBeLessThan(0);
    expect(sag.stressBp).toBeGreaterThan(0);
    const heavyEnds = even().map((it) =>
      it.zoneId === "FORECASTLE" || it.zoneId === "QUARTERDECK" ? { ...it, kg: it.kg * 6 } : it,
    );
    expect(run({ items: heavyEnds }).peakBendingMomentKgMm).toBeGreaterThan(0);
  });
  it("overstress is critical then blocking, and a stronger hull relieves it", () => {
    const heavyMid = even().map((it) =>
      it.zoneId === "CENTRAL_MACHINERY" ? { ...it, kg: it.kg * 3 } : it,
    );
    const weak = run({ items: heavyMid, hullWeightKg: 20_000 });
    expect(
      weak.findings.some((f) => f.id === "STRUCTURAL_OVERSTRESS" && f.severity === "BLOCKING"),
    ).toBe(true);
    const strong = run({ items: heavyMid, hullWeightKg: 400_000 });
    expect(strong.stressBp).toBeLessThan(weak.stressBp);
    const mid = run({ items: heavyMid, hullWeightKg: 40_000 });
    expect(mid.stressBp).toBeGreaterThan(0);
  });
  it("seakeeping responds to freeboard", () => {
    const high = run({ depthMm: 9_000 }).seakeepingBp;
    const low = run({ depthMm: 4_500 }).seakeepingBp;
    expect(high).toBeGreaterThan(low);
    expect(low).toBeGreaterThanOrEqual(0);
    expect(high).toBeLessThanOrEqual(10_000);
  });
  it("rejects malformed input and is deterministic", () => {
    expect(() => run({ items: [] })).toThrow();
    expect(() => run({ buoyancyByZoneBp: [10_000] })).toThrow();
    const a = JSON.stringify(run());
    expect(JSON.stringify(run())).toBe(a);
  });
});
