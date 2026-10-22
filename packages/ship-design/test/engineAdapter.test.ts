import { describe, it, expect } from "vite-plus/test";
import { compileDesign, toEngineDesign, type EngineAdapterOptions } from "../src/index.js";
import { EngineAdapterError } from "../src/engineAdapter.js";
import { UM_PER_KNOT } from "../src/units.js";
import { ctx, draft } from "./fixtures/gunboat.js";

const opts: EngineAdapterOptions = {
  designVersionId: "des_uk_gunboat_a",
  designFamilyId: "fam_uk_gunboat",
  className: "Fleet Screen",
  hullType: "torpedo_gunboat",
  machineryType: "triple_expansion",
  contentVersion: "1.0.0",
  kgPerHitPoint: 4_000,
};
const c = compileDesign(draft, ctx);

describe("toEngineDesign", () => {
  const e = toEngineDesign(c, draft, opts);
  it("emits ADR-0037 canonical units as integers", () => {
    expect(e.normalizedDisplacementKg).toBe(c.totalKg);
    expect(e.normalizedSpeedUms).toBe(
      Math.floor((c.machinery!.maxSpeedMilliKnots * UM_PER_KNOT) / 1000),
    );
    expect(e.normalizedSpeedUms).toBeGreaterThan(20 * UM_PER_KNOT - 1);
    for (const [k, v] of Object.entries(e))
      if (typeof v === "number") expect(Number.isSafeInteger(v), k).toBe(true);
    expect(e.compiledHash).toBe(c.hash);
    expect(e.nationId).toBe("uk");
  });
  it("derives guns, crew, hit points and torpedo mounts from the real components", () => {
    expect(e.mainGunsCaliber).toBe(119_380);
    expect(e.mainGunsCount).toBe(2);
    expect(e.crewComplement).toBe(c.systems!.crewRequired);
    expect(e.hitPoints).toBe(Math.floor(c.totalKg / 4_000));
    expect(e.torpedoArmament).toEqual([
      { mountType: "ABOVE_WATER_TRAINABLE", tubeCount: 3, torpedoModelId: "whitehead_14in_1886" },
    ]);
  });
  it("unbelted ships report zero belt armour; belts report their thickness", () => {
    expect(e.normalizedArmorUm).toBe(0);
    const belted = {
      ...draft,
      armour: {
        ...draft.armour,
        regions: [
          ...draft.armour.regions,
          {
            region: "BELT_MAIN" as const,
            thicknessUm: 50_000,
            lengthMm: 20_000,
            heightMm: 1_500,
            materialId: "mild_steel",
            cosObliquityBp: 10_000,
          },
        ],
        citadelLengthMm: 20_000,
      },
    };
    const bc = compileDesign(belted, ctx);
    expect(toEngineDesign(bc, belted, opts).normalizedArmorUm).toBe(50_000);
  });
  it("refuses invalid designs and bad options", () => {
    const bad = compileDesign(
      { ...draft, machinery: { ...draft.machinery, fuelCapacityKg: 400_000 } },
      ctx,
    );
    expect(bad.valid).toBe(false);
    expect(() => toEngineDesign(bad, draft, opts)).toThrowError(EngineAdapterError);
    expect(() => toEngineDesign(c, draft, { ...opts, kgPerHitPoint: 0 })).toThrowError(
      EngineAdapterError,
    );
  });
  it("is deterministic", () => {
    expect(JSON.stringify(toEngineDesign(c, draft, opts))).toBe(JSON.stringify(e));
  });
});
