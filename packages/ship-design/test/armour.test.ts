import { describe, it, expect } from "vite-plus/test";
import { draft } from "./fixtures/gunboat.js";
import {
  compileArmour,
  armourMaterialOptions,
  newArmourRegion,
  allOrNothingRegions,
  applyEdit,
  EditError,
  changeKindOf,
  regionWeightKg,
  penetrationMarginBp,
  checkFindingShape,
  type ArmourBalance,
  type ArmourInput,
  type ArmourRegion,
  type ThreatProfile,
} from "../src/index.js";

const bal: ArmourBalance = {
  steelKgPerM3: 7_850,
  backingBp: 11_000,
  fixingsBp: 10_500,
  materialEffBp: { iron: 8_000, compound: 10_000, nickel_steel: 12_000, face_hardened: 14_000 },
  deckPenetrationBp: 10_000,
  coverageWarnBp: 9_000,
  coverageCriticalBp: 6_000,
  magazineWarnBp: 0,
  magazineCriticalBp: -5_000,
  underwaterRequiredDepth: {
    points: [
      [0, 500],
      [100, 2_000],
      [400, 4_000],
    ],
  },
  floodBaseBp: [1_000, 2_500, 4_000, 5_500, 7_000],
  floodReserveWeightBp: 2_000,
  floodDamageControlWeightBp: 3_000,
  magVulnBaseBp: 3_000,
  magVulnBoilerBp: 2_000,
  magVulnTorpedoBp: 1_500,
};
const belt = (o: Partial<ArmourRegion> = {}): ArmourRegion => ({
  region: "BELT_MAIN",
  thicknessUm: 305_000,
  lengthMm: 60_000,
  heightMm: 2_400,
  materialId: "compound",
  cosObliquityBp: 10_000,
  ...o,
});
const gun6: ThreatProfile = { id: "gun_6in", penetrationUm: 150_000 };
const gun12: ThreatProfile = { id: "gun_12in", penetrationUm: 400_000 };
const input = (o: Partial<ArmourInput> = {}): ArmourInput => ({
  regions: [
    belt(),
    belt({ region: "DECK_MAIN", thicknessUm: 50_000, lengthMm: 60_000, heightMm: 12_000 }),
  ],
  threats: [gun6, gun12],
  designThreatId: "gun_6in",
  citadelLengthMm: 60_000,
  magazines: [],
  torpedoWarheadKg: 100,
  bunkerProtectionBp: 0,
  subdivisionGrade: 2,
  reserveBuoyancyBp: 4_000,
  damageControlBp: 1_000,
  flammableBp: 3_000,
  ...o,
});

describe("armour weight", () => {
  it("matches hand calculation: 60m x 2.4m x 305mm steel", () => {
    // 144 m2 * 0.305 m * 7850 = 344,... kg; *1.1*1.05
    const raw = 144 * 0.305 * 7850;
    expect(regionWeightKg(belt(), bal)).toBe(Math.ceil(raw * 1.1 * 1.05));
  });
  it("is zero for zero thickness and monotone in thickness; rejects negatives", () => {
    expect(regionWeightKg(belt({ thicknessUm: 0 }), bal)).toBe(0);
    expect(regionWeightKg(belt({ thicknessUm: 400_000 }), bal)).toBeGreaterThan(
      regionWeightKg(belt(), bal),
    );
    expect(() => regionWeightKg(belt({ thicknessUm: -1 }), bal)).toThrow();
  });
});

describe("penetration margin", () => {
  it("is positive when plate beats shell and negative otherwise, clamped to +-10000", () => {
    expect(penetrationMarginBp(belt(), gun6, bal)).toBeGreaterThan(0);
    expect(penetrationMarginBp(belt(), gun12, bal)).toBeLessThan(0);
    expect(penetrationMarginBp(belt({ thicknessUm: 5_000_000 }), gun6, bal)).toBe(10_000);
    expect(penetrationMarginBp(belt({ thicknessUm: 0 }), gun6, bal)).toBe(-10_000);
  });
  it("better material and slope raise the margin (trade vs weight is separate)", () => {
    const base = penetrationMarginBp(belt(), gun12, bal);
    expect(penetrationMarginBp(belt({ materialId: "face_hardened" }), gun12, bal)).toBeGreaterThan(
      base,
    );
    expect(penetrationMarginBp(belt({ cosObliquityBp: 8_000 }), gun12, bal)).toBeLessThan(base);
    expect(regionWeightKg(belt({ materialId: "face_hardened" }), bal)).toBe(
      regionWeightKg(belt(), bal),
    );
  });
  it("throws on unknown material or non-positive threat", () => {
    expect(() => penetrationMarginBp(belt({ materialId: "x" }), gun6, bal)).toThrow();
    expect(() => penetrationMarginBp(belt(), { id: "z", penetrationUm: 0 }, bal)).toThrow();
  });
});

describe("compileArmour", () => {
  it("totals weights, covers the citadel, and reports no findings for a sound scheme", () => {
    const r = compileArmour(input(), bal);
    expect(r.totalWeightKg).toBe(Object.values(r.weightByRegionKg).reduce((a, b) => a + b, 0));
    expect(r.coverageBp).toBe(10_000);
    expect(r.findings).toEqual([]);
  });
  it("reports effective thickness from material and obliquity", () => {
    const r = compileArmour(input(), bal);
    // 305 mm of compound (10_000 eff) hit flat-on is 305 mm effective.
    expect(r.effectiveThicknessByRegionUm.BELT_MAIN).toBe(305_000);
    expect(r.effectiveThicknessByRegionUm.DECK_MAIN).toBe(50_000);
    const sloped = compileArmour(
      input({ regions: [belt({ materialId: "face_hardened", cosObliquityBp: 8_660 })] }),
      bal,
    );
    // 305 mm x 14_000/10_000 x 8_660/10_000 = 369.782 mm.
    expect(sloped.effectiveThicknessByRegionUm.BELT_MAIN).toBe(369_782);
  });
  it("short belt gives CITADEL_INCOMPLETE (warning then critical)", () => {
    const w = compileArmour(input({ regions: [belt({ lengthMm: 50_000 })] }), bal).findings.find(
      (f) => f.id === "CITADEL_INCOMPLETE",
    )!;
    expect(w.severity).toBe("WARNING");
    expect(checkFindingShape(w)).toEqual([]);
    const c = compileArmour(input({ regions: [belt({ lengthMm: 20_000 })] }), bal).findings.find(
      (f) => f.id === "CITADEL_INCOMPLETE",
    )!;
    expect(c.severity).toBe("CRITICAL");
  });
  it("armour that cannot stop the expected adversary is a warning; no armour at all too", () => {
    const r = compileArmour(input({ designThreatId: "gun_12in" }), bal);
    expect(r.findings.map((f) => f.id)).toContain("ARMOUR_INEFFECTIVE_VS_ADVERSARY");
    expect(compileArmour(input({ regions: [] }), bal).totalWeightKg).toBe(0);
  });
  it("magazine protection: weakest layer governs, unprotected is critical", () => {
    const mag = {
      magazineId: "m1",
      beltMarginBp: 4_000,
      deckMarginBp: -1_000,
      boxMarginBp: null,
      adjacentBoilers: true,
      adjacentTorpedoTubes: false,
      flashProtectionBp: 500,
    };
    const r = compileArmour(input({ magazines: [mag] }), bal);
    expect(r.magazineProtectionBp.m1).toBe(-1_000);
    expect(r.magazineVulnerabilityBp.m1).toBe(3_000 + 2_000 - 500);
    expect(r.findings.find((f) => f.id === "MAGAZINE_UNPROTECTED")!.severity).toBe("WARNING");
    const bare = compileArmour(
      input({ magazines: [{ ...mag, beltMarginBp: null, deckMarginBp: null }] }),
      bal,
    );
    expect(bare.findings.find((f) => f.id === "MAGAZINE_UNPROTECTED")!.severity).toBe("CRITICAL");
  });
  it("underwater, flooding and fire scores respond to design choices and stay in [0,10000]", () => {
    const none = compileArmour(input(), bal);
    expect(none.underwaterResistanceBp).toBe(0);
    const tb = compileArmour(
      input({
        regions: [
          belt(),
          belt({ region: "TORPEDO_BULKHEAD", heightMm: 1_000, thicknessUm: 40_000 }),
        ],
      }),
      bal,
    );
    expect(tb.underwaterResistanceBp).toBeGreaterThan(0);
    const bunkers = compileArmour(
      input({
        bunkerProtectionBp: 5_000,
        regions: [
          belt(),
          belt({ region: "TORPEDO_BULKHEAD", heightMm: 1_000, thicknessUm: 40_000 }),
        ],
      }),
      bal,
    );
    expect(bunkers.underwaterResistanceBp).toBeGreaterThan(tb.underwaterResistanceBp);
    expect(compileArmour(input({ subdivisionGrade: 4 }), bal).floodingResistanceBp).toBeGreaterThan(
      compileArmour(input({ subdivisionGrade: 0 }), bal).floodingResistanceBp,
    );
    expect(compileArmour(input({ flammableBp: 0, damageControlBp: 5_000 }), bal).fireRiskBp).toBe(
      0,
    );
    expect(compileArmour(input({ flammableBp: 99_999 }), bal).fireRiskBp).toBe(10_000);
  });
  it("throws if the design threat is missing, and is order independent", () => {
    expect(() => compileArmour(input({ designThreatId: "nope" }), bal)).toThrow();
    const regs = [belt(), belt({ region: "DECK_MAIN" })];
    expect(JSON.stringify(compileArmour(input({ regions: regs }), bal))).toBe(
      JSON.stringify(compileArmour(input({ regions: [...regs].reverse() }), bal)),
    );
  });
});

describe("deck penetration factor", () => {
  it("decks face reduced penetration; belts do not", () => {
    const deck = belt({ region: "DECK_MAIN", thicknessUm: 100_000 });
    const full = penetrationMarginBp(deck, gun12, bal);
    const reduced = compileArmour(input({ regions: [deck], designThreatId: "gun_12in" }), {
      ...bal,
      deckPenetrationBp: 4_000,
    });
    const plain = compileArmour(input({ regions: [deck], designThreatId: "gun_12in" }), bal);
    expect(reduced.marginBp.DECK_MAIN!.gun_12in!).toBeGreaterThan(
      plain.marginBp.DECK_MAIN!.gun_12in!,
    );
    expect(plain.marginBp.DECK_MAIN!.gun_12in!).toBe(full);
    const b = compileArmour(
      input({ regions: [belt({ thicknessUm: 100_000 })], designThreatId: "gun_12in" }),
      { ...bal, deckPenetrationBp: 4_000 },
    );
    expect(b.marginBp.BELT_MAIN!.gun_12in!).toBe(
      penetrationMarginBp(belt({ thicknessUm: 100_000 }), gun12, bal),
    );
  });
});

describe("armourMaterialOptions", () => {
  const b: ArmourBalance = {
    ...bal,
    materialAvailability: {
      face_hardened: {
        fromMonth: "1890-01",
        requires: ["harvey_process"],
        maxThicknessUm: 450_000,
      },
      iron: { fromMonth: "1860-01", obsoleteMonth: "1885-01" },
    },
  };
  it("lists materials weakest first, then by id", () => {
    expect(armourMaterialOptions(b, "1880-01", new Set()).map((o) => o.id)).toEqual([
      "iron",
      "compound",
      "nickel_steel",
      "face_hardened",
    ]);
  });
  it("marks a material unavailable for a missing tech or a future month, with the reason", () => {
    const o = (m: string, t: string[]) =>
      armourMaterialOptions(b, m, new Set(t)).find((x) => x.id === "face_hardened")!;
    expect(o("1895-01", [])).toMatchObject({
      available: false,
      unavailableReason: "needs harvey_process",
    });
    expect(o("1885-01", ["harvey_process"])).toMatchObject({
      available: false,
      unavailableReason: "introduced 1890-01",
    });
    expect(o("1890-01", ["harvey_process"])).toMatchObject({
      available: true,
      unavailableReason: null,
      maxThicknessUm: 450_000,
    });
  });
  it("flags an obsolete material and treats an unlisted one as unrestricted", () => {
    const opts = armourMaterialOptions(b, "1886-01", new Set());
    expect(opts.find((x) => x.id === "iron")!.obsolete).toBe(true);
    expect(opts.find((x) => x.id === "compound")).toMatchObject({
      available: true,
      maxThicknessUm: null,
      obsolete: false,
    });
  });
});

describe("newArmourRegion", () => {
  const size = { lengthWlMm: 100_000, beamMm: 15_000, depthMm: 8_000, citadelLengthMm: 50_000 };
  it("sizes belts and decks from the citadel and ends from the rest of the waterline", () => {
    expect(newArmourRegion("BELT_MAIN", size, "compound")).toMatchObject({
      lengthMm: 50_000,
      heightMm: 2_400,
      materialId: "compound",
      cosObliquityBp: 10_000,
    });
    expect(newArmourRegion("BELT_ENDS", size, "compound").lengthMm).toBe(50_000);
    expect(newArmourRegion("DECK_MAIN", size, "iron")).toMatchObject({
      lengthMm: 50_000,
      heightMm: 12_000,
    });
  });
  it("falls back to 60% of the waterline with no citadel, and never goes negative", () => {
    expect(newArmourRegion("BELT_MAIN", { ...size, citadelLengthMm: 0 }, "iron").lengthMm).toBe(
      60_000,
    );
    const odd = newArmourRegion("BELT_ENDS", { ...size, citadelLengthMm: 200_000 }, "iron");
    expect(odd.lengthMm).toBe(0);
    const tiny = newArmourRegion(
      "BELT_MAIN",
      { lengthWlMm: 0, beamMm: 0, depthMm: 0, citadelLengthMm: 0 },
      "iron",
    );
    expect([tiny.lengthMm, tiny.heightMm]).toEqual([0, 0]);
  });
  it("gives every region positive thickness and a valid weight", () => {
    for (const region of [
      "BELT_MAIN",
      "BELT_UPPER",
      "BELT_ENDS",
      "DECK_MAIN",
      "DECK_SLOPE",
      "DECK_EXTENDED",
      "TURRET",
      "TURRET_TOP",
      "SECONDARY_GUN",
      "CONNING_TOWER",
      "MAGAZINE_BOX",
      "SPLINTER_PLATING",
      "TORPEDO_BULKHEAD",
      "TORPEDO_BELT",
    ] as const) {
      const r = newArmourRegion(region, size, "compound");
      expect(r.thicknessUm).toBeGreaterThan(0);
      expect(regionWeightKg(r, bal)).toBeGreaterThan(0);
    }
  });
});

describe("manual-parity regions (ADR-0232)", () => {
  const deckAt = (region: ArmourRegion["region"], o: Partial<ArmourRegion> = {}) =>
    belt({ region, thicknessUm: 100_000, heightMm: 12_000, ...o });
  const reducedBal = { ...bal, deckPenetrationBp: 4_000 };

  it("DECK_EXTENDED, TURRET_TOP and SECONDARY_GUN add weight that grows with thickness", () => {
    for (const region of ["DECK_EXTENDED", "TURRET_TOP", "SECONDARY_GUN"] as const) {
      const thin = compileArmour(
        input({ regions: [deckAt(region, { thicknessUm: 25_000 })] }),
        bal,
      );
      const thick = compileArmour(input({ regions: [deckAt(region)] }), bal);
      expect(thin.weightByRegionKg[region]).toBeGreaterThan(0);
      expect(thick.totalWeightKg).toBeGreaterThan(thin.totalWeightKg);
    }
  });
  it("DECK_EXTENDED is a deck: reduced penetration; TURRET_TOP and SECONDARY_GUN are not", () => {
    const margin = (region: ArmourRegion["region"], b: ArmourBalance) =>
      compileArmour(input({ regions: [deckAt(region)], designThreatId: "gun_12in" }), b).marginBp[
        region
      ]!.gun_12in!;
    expect(margin("DECK_EXTENDED", reducedBal)).toBeGreaterThan(margin("DECK_EXTENDED", bal));
    expect(margin("TURRET_TOP", reducedBal)).toBe(margin("TURRET_TOP", bal));
    expect(margin("SECONDARY_GUN", reducedBal)).toBe(margin("SECONDARY_GUN", bal));
  });
  it("ARMOUR_INEFFECTIVE_VS_ADVERSARY considers belts, DECK_MAIN, DECK_EXTENDED and TURRET only", () => {
    const flagged = (region: ArmourRegion["region"]) =>
      compileArmour(
        input({ regions: [deckAt(region, { thicknessUm: 10_000 })], designThreatId: "gun_12in" }),
        bal,
      ).findings.some((f) => f.id === "ARMOUR_INEFFECTIVE_VS_ADVERSARY");
    for (const region of ["BELT_MAIN", "DECK_MAIN", "DECK_EXTENDED", "TURRET"] as const)
      expect(flagged(region), region).toBe(true);
    for (const region of ["TURRET_TOP", "SECONDARY_GUN", "CONNING_TOWER"] as const)
      expect(flagged(region), region).toBe(false);
  });
  it("a critical region that defeats the adversary clears the finding", () => {
    const r = compileArmour(
      input({
        regions: [
          deckAt("DECK_EXTENDED", { thicknessUm: 10_000 }),
          deckAt("TURRET", { thicknessUm: 900_000 }),
        ],
        designThreatId: "gun_12in",
      }),
      bal,
    );
    expect(r.findings.map((f) => f.id)).not.toContain("ARMOUR_INEFFECTIVE_VS_ADVERSARY");
  });
  it("new regions start with positive plates and are never BARBETTE", () => {
    const size = { lengthWlMm: 100_000, beamMm: 15_000, depthMm: 8_000, citadelLengthMm: 60_000 };
    for (const region of ["DECK_EXTENDED", "TURRET", "TURRET_TOP", "SECONDARY_GUN"] as const) {
      const r = newArmourRegion(region, size, "compound");
      expect(r.region).toBe(region);
      expect(r.lengthMm).toBeGreaterThan(0);
      expect(r.heightMm).toBeGreaterThan(0);
    }
    expect(newArmourRegion("DECK_EXTENDED", size, "compound").lengthMm).toBe(40_000);
  });
});

describe("allOrNothingRegions", () => {
  const r = (region: ArmourRegion["region"], lengthMm: number): ArmourRegion =>
    belt({ region, lengthMm });
  it("cuts belts and decks to the citadel, drops upper belt and ends, keeps the rest", () => {
    const out = allOrNothingRegions(
      [
        r("BELT_MAIN", 90_000),
        r("BELT_ENDS", 20_000),
        r("BELT_UPPER", 70_000),
        r("DECK_MAIN", 30_000),
        r("DECK_EXTENDED", 40_000),
        r("TURRET", 6_000),
      ],
      50_000,
    );
    expect(out.map((x) => [x.region, x.lengthMm])).toEqual([
      ["BELT_MAIN", 50_000],
      ["DECK_MAIN", 30_000],
      ["TURRET", 6_000],
    ]);
  });
  it("drops DECK_EXTENDED and cuts DECK_SLOPE and MAGAZINE_BOX to the citadel", () => {
    const out = allOrNothingRegions(
      [r("DECK_EXTENDED", 80_000), r("DECK_SLOPE", 90_000), r("MAGAZINE_BOX", 90_000)],
      50_000,
    );
    expect(out.map((x) => [x.region, x.lengthMm])).toEqual([
      ["DECK_SLOPE", 50_000],
      ["MAGAZINE_BOX", 50_000],
    ]);
  });
  it("is idempotent and pure", () => {
    const input = [r("BELT_MAIN", 90_000), r("BELT_ENDS", 20_000)];
    const once = allOrNothingRegions(input, 50_000);
    expect(allOrNothingRegions(once, 50_000)).toEqual(once);
    expect(input).toHaveLength(2);
    expect(input[0]!.lengthMm).toBe(90_000);
  });
});

describe("set_armour_regions edit", () => {
  it("replaces every region at once, keeping order, without mutating", () => {
    const before = JSON.stringify(draft);
    const next = applyEdit(draft, {
      kind: "set_armour_regions",
      regions: [belt({ region: "DECK_MAIN" }), belt({ region: "TURRET" })],
    });
    expect(next.armour.regions.map((x) => x.region)).toEqual(["DECK_MAIN", "TURRET"]);
    expect(next.armour.citadelLengthMm).toBe(draft.armour.citadelLengthMm);
    expect(JSON.stringify(draft)).toBe(before);
  });
  it("rejects a region listed twice", () => {
    expect(() =>
      applyEdit(draft, { kind: "set_armour_regions", regions: [belt(), belt()] }),
    ).toThrow(EditError);
  });
  it("is an armour change for revisions", () => {
    expect(changeKindOf({ kind: "set_armour_regions", regions: [] }, () => undefined)).toBe(
      "ARMOUR",
    );
  });
});
