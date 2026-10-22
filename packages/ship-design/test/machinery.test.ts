import { describe, it, expect } from "vite-plus/test";
import {
  compileMachinery,
  requiredKw,
  maxSpeed,
  speedLengthRatioX1000,
  checkFindingShape,
  type MachineryBalance,
  type MachineryInput,
  type PropulsionPlant,
} from "../src/index.js";

const balance: MachineryBalance = {
  cFormX100: { fine_light: 17_500, full_heavy: 14_000 },
  slr0X1000: 1_300,
  kSlBp: 600,
  cFloorBp: 5_000,
  slrMaxX1000: 3_200,
  minSpeedMilliKnots: 6_000,
  maxSpeedMilliKnots: 40_000,
  kwPerShpBp: 7_457,
  auxWeightBp: 1_500,
  fuelUnusableBp: 500,
  fuelReserveBp: 700,
  bunkerLitreBpPerKg: 10_000,
};
const sfc = {
  points: [
    [0, 1400],
    [2000, 1100],
    [6000, 900],
    [10000, 1000],
  ] as [number, number][],
};
const plant = (id: string, w: number, s = sfc): PropulsionPlant => ({
  id,
  fuelType: "COAL",
  weightMilliKgPerKw: w,
  volumeLitrePerKw: 150,
  sfcGramPerKwh: { points: s.points },
  reliabilityBp: 9_000,
  minKw: 200,
  maxKw: 40_000,
});
const compound = plant("compound", 60_000);
const triple = plant("triple_expansion", 40_000);
const watertube = plant("watertube_te", 31_000, {
  points: [
    [0, 1200],
    [2000, 950],
    [6000, 780],
    [10000, 850],
  ],
});

const base: MachineryInput = {
  plant: triple,
  installedKw: 2_900,
  hullFormId: "fine_light",
  lengthWlMm: 70_000,
  displacementKg: 705_000,
  foulingBp: 0,
  fuelCapacityKg: 175_000,
  cruiseSpeedMilliKnots: 10_000,
  requiredSpeedMilliKnots: 20_000,
  requiredRangeNm: 2_500,
};

describe("power model", () => {
  it("SLR matches hand calculation (V=20 kn, L=229.7 ft -> 1.32)", () => {
    const s = speedLengthRatioX1000(20_000, 70_000);
    expect(s).toBeGreaterThan(1_310);
    expect(s).toBeLessThan(1_330);
  });
  it("required power is strictly increasing in speed (convex)", () => {
    let prev = 0;
    let prevDelta = 0;
    for (let v = 8_000; v <= 30_000; v += 2_000) {
      const p = requiredKw(base, balance, v);
      expect(p).toBeGreaterThan(prev);
      if (prev > 0) {
        expect(p - prev).toBeGreaterThanOrEqual(prevDelta);
        prevDelta = p - prev;
      }
      prev = p;
    }
  });
  it("worked example is in the right range (~2.9 MW at 20 kn)", () => {
    const p = requiredKw(base, balance, 20_000);
    expect(p).toBeGreaterThan(2_500);
    expect(p).toBeLessThan(3_300);
  });
  it("heavier ship and fouling both need more power", () => {
    const p = requiredKw(base, balance, 18_000);
    expect(requiredKw({ ...base, displacementKg: 900_000 }, balance, 18_000)).toBeGreaterThan(p);
    expect(requiredKw({ ...base, foulingBp: 1_500 }, balance, 18_000)).toBeGreaterThan(p);
  });
  it("longer hull is cheaper to drive fast", () => {
    expect(requiredKw({ ...base, lengthWlMm: 90_000 }, balance, 26_000)).toBeLessThan(
      requiredKw(base, balance, 26_000),
    );
  });
  it("maxSpeed inverts requiredKw and is monotone in power", () => {
    const v = maxSpeed(base, balance);
    expect(requiredKw(base, balance, v)).toBeLessThanOrEqual(base.installedKw);
    expect(requiredKw(base, balance, v + 1)).toBeGreaterThan(base.installedKw);
    expect(maxSpeed({ ...base, installedKw: 5_000 }, balance)).toBeGreaterThan(v);
  });
  it("unknown hull form throws instead of defaulting", () => {
    expect(() => requiredKw({ ...base, hullFormId: "nope" }, balance, 10_000)).toThrow();
  });
});

describe("compileMachinery", () => {
  it("meets the brief with a valid plant and reports a plausible range", () => {
    const r = compileMachinery({ ...base, installedKw: 3_300 }, balance);
    expect(r.findings.filter((f) => f.severity === "BLOCKING")).toEqual([]);
    expect(r.maxSpeedMilliKnots).toBeGreaterThanOrEqual(20_000);
    expect(r.plantWeightKg).toBeGreaterThan(0);
    expect(r.rangeNmAtCruise).toBeGreaterThan(0);
    expect(r.economicalRangeNm).toBeGreaterThanOrEqual(r.rangeNmAtCruise - 1);
  });
  it("three propulsion options trade weight against fuel economy", () => {
    const [c, t, w] = [compound, triple, watertube].map((p) =>
      compileMachinery({ ...base, plant: p, installedKw: 3_300 }, balance),
    );
    expect(c!.plantWeightKg).toBeGreaterThan(t!.plantWeightKg);
    expect(t!.plantWeightKg).toBeGreaterThan(w!.plantWeightKg);
    expect(w!.rangeNmAtCruise).toBeGreaterThan(t!.rangeNmAtCruise);
  });
  it("short plant is a WARNING with >=2 remedies and shape-valid", () => {
    const r = compileMachinery({ ...base, installedKw: 1_500 }, balance);
    const f = r.findings.find((x) => x.id === "PLANT_INSUFFICIENT")!;
    expect(f.severity).toBe("WARNING");
    expect(checkFindingShape(f)).toEqual([]);
  });
  it("insufficient fuel is flagged with the economical alternative", () => {
    const r = compileMachinery({ ...base, installedKw: 3_300, fuelCapacityKg: 20_000 }, balance);
    const f = r.findings.find((x) => x.id === "RANGE_BELOW_REQUIREMENT")!;
    expect(checkFindingShape(f)).toEqual([]);
    expect(f.remedies.some((x) => x.id === "slower_cruise")).toBe(true);
  });
  it("blocks no propulsion, plant out of range and speed out of range", () => {
    expect(compileMachinery({ ...base, installedKw: 0 }, balance).findings[0]!.id).toBe(
      "NO_PROPULSION",
    );
    expect(compileMachinery({ ...base, installedKw: 100 }, balance).findings[0]!.id).toBe(
      "PLANT_SIZE_RANGE",
    );
    const s = compileMachinery({ ...base, requiredSpeedMilliKnots: 50_000 }, balance);
    expect(s.findings.map((f) => f.id)).toContain("SPEED_OUT_OF_RANGE");
    expect(s.findings.every((f) => f.severity !== "BLOCKING" || f.remedies.length >= 3)).toBe(true);
  });
  it("flags a hull driven beyond its form", () => {
    const r = compileMachinery({ ...base, installedKw: 40_000, lengthWlMm: 40_000 }, balance);
    expect(r.findings.map((f) => f.id)).toContain("HULL_DRIVEN_BEYOND_FORM");
  });
  it("zero fuel gives zero range, not a crash", () => {
    const r = compileMachinery({ ...base, installedKw: 3_300, fuelCapacityKg: 0 }, balance);
    expect(r.rangeNmAtCruise).toBe(0);
  });
  it("is deterministic", () => {
    const a = JSON.stringify(compileMachinery({ ...base, installedKw: 3_300 }, balance));
    for (let i = 0; i < 5; i++)
      expect(JSON.stringify(compileMachinery({ ...base, installedKw: 3_300 }, balance))).toBe(a);
  });
});

describe("bunker volume", () => {
  const vol = (fuelKg: number, bp: number) =>
    compileMachinery(
      { ...base, installedKw: 3_300, fuelCapacityKg: fuelKg },
      { ...balance, bunkerLitreBpPerKg: bp },
    ).bunkerVolumeLitre;
  it("is fuel mass times litres per kg, in bp", () => {
    expect(vol(175_000, 10_000)).toBe(175_000);
    expect(vol(60_000, 11_148)).toBe(66_888);
  });
  it("rounds up, so a fraction of a litre is never lost", () => {
    expect(vol(1, 11_148)).toBe(2);
    expect(vol(3, 3_334)).toBe(2);
  });
  it("scales linearly with fuel and never shrinks when the constant grows", () => {
    expect(vol(120_000, 11_148)).toBeGreaterThanOrEqual(2 * vol(60_000, 11_148) - 1);
    expect(vol(60_000, 11_148)).toBeGreaterThan(vol(60_000, 10_000));
  });
});

describe("engine priority (speed <-> reliability axis, ADR-0233)", () => {
  const bal: MachineryBalance = {
    ...balance,
    enginePriorityWeightSwingBp: 1_500,
    enginePriorityPowerSwingBp: 500,
    enginePriorityReliabilitySwingBp: 2_000,
  };
  const at = (p: number | undefined) =>
    compileMachinery(p === undefined ? base : { ...base, enginePriorityBp: p }, bal);

  it("balanced (0) and absent are identical", () => {
    expect(at(0)).toEqual(at(undefined));
    expect(at(0).reliabilityBp).toBe(triple.reliabilityBp);
  });
  it("speed-optimised is lighter and faster but less reliable; reliability-optimised the reverse", () => {
    const fast = at(10_000);
    const mid = at(0);
    const safe = at(-10_000);
    expect(fast.plantWeightKg).toBeLessThan(mid.plantWeightKg);
    expect(safe.plantWeightKg).toBeGreaterThan(mid.plantWeightKg);
    expect(fast.maxSpeedMilliKnots).toBeGreaterThan(mid.maxSpeedMilliKnots);
    expect(safe.maxSpeedMilliKnots).toBeLessThan(mid.maxSpeedMilliKnots);
    expect(fast.reliabilityBp).toBeLessThan(mid.reliabilityBp);
    expect(safe.reliabilityBp).toBeGreaterThan(mid.reliabilityBp);
  });
  it("is monotone in the priority across the whole axis", () => {
    const steps = [-10_000, -5_000, -1, 0, 1, 5_000, 10_000].map(at);
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]!.plantWeightKg).toBeLessThanOrEqual(steps[i - 1]!.plantWeightKg);
      expect(steps[i]!.maxSpeedMilliKnots).toBeGreaterThanOrEqual(steps[i - 1]!.maxSpeedMilliKnots);
      expect(steps[i]!.reliabilityBp).toBeLessThanOrEqual(steps[i - 1]!.reliabilityBp);
    }
  });
  it("keeps reliability inside 0..10000 and rejects a priority off the axis", () => {
    const extreme = compileMachinery(
      { ...base, enginePriorityBp: 10_000 },
      { ...bal, enginePriorityReliabilitySwingBp: 20_000 },
    );
    expect(extreme.reliabilityBp).toBe(0);
    for (const bad of [10_001, -10_001, 0.5]) expect(() => at(bad)).toThrow(/enginePriorityBp/);
  });
  it("without authored swings the axis has no effect", () => {
    expect(compileMachinery({ ...base, enginePriorityBp: 10_000 }, balance)).toEqual(
      compileMachinery(base, balance),
    );
  });
});
