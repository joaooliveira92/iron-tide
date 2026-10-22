import { describe, it, expect } from "vite-plus/test";
import {
  evaluateRefit,
  compileDesign,
  checkFindingShape,
  armamentChangeFindings,
  type ArmourRegion,
  type ComponentDef,
  type GunChange,
  type RefitPlan,
  type ShipContext,
  type ShipState,
} from "../src/index.js";
import { ctx as baseCtx, draft, costBalance, refitBalance } from "./fixtures/gunboat.js";
import { armamentContent } from "./helpers/armamentContext.js";

const director: ComponentDef = {
  id: "director_mk1",
  displayName: "Director Mk I",
  category: "DIRECTOR",
  introduction: { fromMonth: "1890-01", obsoleteMonth: null },
  requires: [],
  parameters: {},
  constants: {},
  weightKg: "1200",
  volumeLitre: "800",
  costMicro: "400000000",
  crew: "3",
  powerKw: "6",
  upgradePath: [],
  tags: [],
  deckFootprintMm2: "900000",
  heightMm: "1800",
  zCgMm: "7500",
  fcClasses: ["light"],
  attributes: { accuracyBonusBp: "2500", capacity: "6" },
};
const huge: ComponentDef = {
  ...director,
  id: "director_huge",
  weightKg: "80000",
  volumeLitre: "800",
};
const hungry: ComponentDef = { ...director, id: "director_hungry", powerKw: "900" };
const costly: ComponentDef = { ...director, id: "director_gold", costMicro: "600000000000" };
const ctx: ShipContext = {
  ...baseCtx,
  catalogue: [...baseCtx.catalogue, director, huge, hungry, costly],
};

const ship: ShipState = {
  design: draft,
  growthBudgetKg: 6_000,
  hullFatigueBp: 1_000,
  remainingServiceMonths: 180,
  refitCount: 0,
};
const upgrade = (componentId = "director_mk1", over: Partial<RefitPlan> = {}): RefitPlan => ({
  kind: "SENSOR_FC_UPDATE",
  removeInstanceIds: ["rf"],
  add: [{ instanceId: "dir", componentId, zoneId: "SUPERSTRUCTURE", stationPermille: 520 }],
  ...over,
});
const run = (plan: RefitPlan, s: ShipState = ship, c: ShipContext = ctx) =>
  evaluateRefit(
    s,
    plan,
    c,
    refitBalance,
    costBalance,
    { maturityBpByTech: {}, firstOfClass: false },
    2_000_000,
  );

describe("REARMAMENT armament-change conditions (RTW3 manual pp31-32)", () => {
  const g = (
    role: "MAIN" | "SECONDARY",
    inch: number,
    barrels: number,
    casemate = false,
  ): GunChange => ({ role, caliberUm: inch * 25_400, barrels, casemate });
  it("allows the manual's worked compatible swaps", () => {
    expect(armamentChangeFindings([g("MAIN", 8, 2)], [g("MAIN", 10, 1)])).toEqual([]);
    expect(armamentChangeFindings([g("MAIN", 12, 3)], [g("MAIN", 16, 2)])).toEqual([]);
  });
  it("allows a same-calibre main refresh but refuses a calibre change at the same barrel count", () => {
    expect(armamentChangeFindings([g("MAIN", 12, 3)], [g("MAIN", 12, 3)])).toEqual([]);
    expect(
      armamentChangeFindings([g("MAIN", 8, 1)], [g("MAIN", 10, 1)]).map((x) => x.id),
    ).toContain("ARMAMENT_INCOMPATIBLE_CALIBRE");
  });
  it("refuses removing an above-6 in main gun without a replacement", () => {
    expect(armamentChangeFindings([g("MAIN", 12, 1)], []).map((x) => x.id)).toContain(
      "ARMAMENT_MAIN_GUN_UNCHANGEABLE",
    );
  });
  it("changes secondaries only from casemates or ≤6 in turrets, and only to ≤6 in guns", () => {
    expect(
      armamentChangeFindings([g("SECONDARY", 8, 2)], [g("SECONDARY", 6, 2)]).map((x) => x.id),
    ).toContain("ARMAMENT_SECONDARY_CHANGE_NOT_ALLOWED");
    expect(
      armamentChangeFindings([g("SECONDARY", 8, 1, true)], [g("SECONDARY", 6, 1)]).map((x) => x.id),
    ).not.toContain("ARMAMENT_SECONDARY_CHANGE_NOT_ALLOWED");
    expect(
      armamentChangeFindings([g("SECONDARY", 4, 1)], [g("SECONDARY", 8, 1)]).map((x) => x.id),
    ).toContain("ARMAMENT_SECONDARY_TOO_LARGE");
  });
  it("runs inside the normal refit evaluation", () => {
    const plan: RefitPlan = {
      kind: "REARMAMENT",
      removeInstanceIds: ["a_gun_fwd"],
      add: [
        {
          instanceId: "new_gun",
          componentId: "qf_47in",
          zoneId: "FORECASTLE",
          stationPermille: 40,
          params: { barrels: 1, rounds: 100 },
        },
      ],
    };
    const r = run(plan, { ...ship, growthBudgetKg: 40_000 });
    expect(r.projectType).toBe("REBUILD");
    expect(r.findings.map((x) => x.id)).not.toContain("ARMAMENT_SECONDARY_CHANGE_NOT_ALLOWED");
  });

  describe("mount style from the authored armament content", () => {
    const base = baseCtx.catalogue.find((c) => c.id === "qf_47in")!;
    const bigSecondary: ComponentDef = {
      ...base,
      id: "big_secondary",
      displayName: "8 in secondary",
      attributes: { ...base.attributes, caliberUm: "203200" },
    };
    const withFamily = (mountType: "TURRET" | "CASEMATE"): ShipContext => ({
      ...ctx,
      catalogue: [...ctx.catalogue, bigSecondary],
      armamentContent: {
        gunFamilies: [
          ...armamentContent.gunFamilies,
          {
            id: "big_secondary",
            designation: "8 in secondary",
            category: "SECONDARY_GUN",
            defaultMountType: mountType,
            provenance: armamentContent.gunFamilies[0]!.provenance,
          },
        ],
        gunModels: armamentContent.gunModels,
        gunMounts: armamentContent.gunMounts,
        ammunition: armamentContent.ammunition,
      },
    });
    const turretShip: ShipState = {
      ...ship,
      design: {
        ...draft,
        placements: draft.placements.map((p) =>
          p.instanceId === "a_gun_fwd" ? { ...p, componentId: "big_secondary" } : p,
        ),
      },
    };
    const swap: RefitPlan = {
      kind: "REARMAMENT",
      removeInstanceIds: ["a_gun_fwd"],
      add: [
        {
          instanceId: "new_gun",
          componentId: "qf_47in",
          zoneId: "FORECASTLE",
          stationPermille: 40,
          params: { barrels: 1, rounds: 100 },
        },
      ],
    };
    it("refuses a single-barrel 8 in turret secondary", () => {
      const r = run(swap, { ...turretShip, growthBudgetKg: 40_000 }, withFamily("TURRET"));
      expect(r.findings.map((x) => x.id)).toContain("ARMAMENT_SECONDARY_CHANGE_NOT_ALLOWED");
    });
    it("allows an 8 in casemate secondary of the same calibre", () => {
      const r = run(swap, { ...turretShip, growthBudgetKg: 40_000 }, withFamily("CASEMATE"));
      expect(r.findings.map((x) => x.id)).not.toContain("ARMAMENT_SECONDARY_CHANGE_NOT_ALLOWED");
    });
  });
});

describe("BULGE (RTW3 manual p. 32)", () => {
  const bulge = (massKg: number): RefitPlan => ({
    kind: "BULGE",
    removeInstanceIds: [],
    add: [],
    bulge: { massKg },
  });
  it("adds the blister mass, lowers speed and credits torpedo protection", () => {
    const r = run(bulge(4_000), { ...ship, growthBudgetKg: 40_000 });
    expect(r.legal).toBe(true);
    expect(r.projectType).toBe("REBUILD");
    expect(r.netAddedKg).toBeGreaterThanOrEqual(4_000);
    expect(r.bulgeProtectionGainBp).toBe(2_000);
    expect(r.after.machinery!.maxSpeedMilliKnots).toBeLessThan(
      r.before.machinery!.maxSpeedMilliKnots,
    );
  });
  it("requires a blister on a BULGE refit", () => {
    const r = run({ kind: "BULGE", removeInstanceIds: [], add: [] });
    expect(r.legal).toBe(false);
    expect(r.findings.map((x) => x.id)).toContain("REFIT_BULGE_REQUIRED");
  });
  it("refuses a bulge inside another refit kind", () => {
    const r = run(upgrade("director_mk1", { bulge: { massKg: 1_000 } }));
    expect(r.legal).toBe(false);
    expect(r.findings.map((x) => x.id)).toContain("REFIT_BULGE_KIND_MISMATCH");
  });
  it("fails when the blister exceeds the growth budget", () => {
    const r = run(bulge(999_000));
    expect(r.legal).toBe(false);
    expect(r.findings.map((x) => x.id)).toContain("REFIT_GROWTH_EXCEEDED");
  });
});

describe("SENSOR_FC_UPDATE", () => {
  const r = run(upgrade());
  it("is legal, accounts for added mass and improves fire control", () => {
    expect(r.legal).toBe(true);
    expect(r.projectType).toBe("EQUIPMENT_INSTALLATION");
    expect(r.netAddedKg).toBeGreaterThan(0);
    expect(r.netAddedKg).toBeLessThan(ship.growthBudgetKg);
    const acc = (c: typeof r.after) => c.systems!.gunControl.reduce((a, g) => a + g.accuracyBp, 0);
    expect(acc(r.after)).toBeGreaterThan(acc(r.before));
  });
  it("spends the finite budgets: growth, fatigue, refit count; extends life", () => {
    expect(r.nextState.growthBudgetKg).toBeLessThan(ship.growthBudgetKg);
    expect(r.nextState.hullFatigueBp).toBe(ship.hullFatigueBp + 300);
    expect(r.nextState.refitCount).toBe(1);
    expect(r.nextState.remainingServiceMonths).toBe(192);
    expect(r.nextState.design.placements.some((p) => p.instanceId === "dir")).toBe(true);
    expect(r.nextState.design.placements.some((p) => p.instanceId === "rf")).toBe(false);
  });
  it("has positive cost, a dock time, and a sane share of replacement", () => {
    expect(r.costMicro).toBeGreaterThan(0);
    expect(r.monthsOutOfService).toBeGreaterThanOrEqual(2);
    expect(r.costRatioBp).toBeLessThan(refitBalance.uneconomicalBp);
  });
  it("the resulting design compiles and keeps the as-built hull (no silent re-normalisation)", () => {
    expect(compileDesign(r.newDesign, ctx).valid).toBe(true);
    expect(r.newDesign.hull.lengthWl).toBe(draft.hull.lengthWl);
    expect(r.newDesign.hull.targetDisplacementKg).toBe(draft.hull.targetDisplacementKg);
  });
});

describe("refit legality (I5)", () => {
  it("kind mismatch: adding a gun in a sensor refit is blocked", () => {
    const r = run({
      kind: "SENSOR_FC_UPDATE",
      removeInstanceIds: [],
      add: [
        {
          instanceId: "g",
          componentId: "qf_47in",
          zoneId: "FORECASTLE",
          stationPermille: 30,
          params: { barrels: 1, rounds: 50 },
        },
      ],
    });
    expect(r.legal).toBe(false);
    expect(r.findings.map((f) => f.id)).toContain("REFIT_KIND_MISMATCH");
    expect(r.nextState).toBe(ship);
  });
  it("mass: exceeding the growth budget is blocked with remedies", () => {
    const r = run(upgrade("director_huge"));
    const f = r.findings.find((x) => x.id === "REFIT_GROWTH_EXCEEDED")!;
    expect(r.legal).toBe(false);
    expect(f.severity).toBe("BLOCKING");
    expect(checkFindingShape(f)).toEqual([]);
  });
  it("power: a consumer the plant cannot supply introduces a shortfall", () => {
    const r = run(upgrade("director_hungry"));
    expect(r.legal).toBe(false);
    expect(r.findings.map((f) => f.id)).toContain("REFIT_POWER_SHORTFALL");
  });
  it("space: filling a zone is blocked", () => {
    const r = run({
      kind: "SENSOR_FC_UPDATE",
      removeInstanceIds: [],
      add: Array.from({ length: 4 }, (_, i) => ({
        instanceId: `fill${i}`,
        componentId: "ventilation",
        zoneId: "FORECASTLE" as const,
        stationPermille: 30,
      })),
    });
    expect(r.legal).toBe(false);
  });
  it("unknown target and duplicate ids are blocked", () => {
    expect(
      run(upgrade("director_mk1", { removeInstanceIds: ["ghost"] })).findings.map((f) => f.id),
    ).toContain("REFIT_UNKNOWN_TARGET");
    expect(
      run(
        upgrade("director_mk1", {
          removeInstanceIds: [],
          add: [
            {
              instanceId: "rf",
              componentId: "director_mk1",
              zoneId: "SUPERSTRUCTURE",
              stationPermille: 520,
            },
          ],
        }),
      ).findings.map((f) => f.id),
    ).toContain("REFIT_DUPLICATE_INSTANCE");
  });
  it("a pre-existing warning does not block the refit", () => {
    const before = compileDesign(draft, ctx);
    expect(before.findings.some((f) => f.severity === "WARNING")).toBe(true);
    expect(run(upgrade()).legal).toBe(true);
  });
  it("old hulls end: worn hulls and short remaining life are blocked", () => {
    expect(run(upgrade(), { ...ship, hullFatigueBp: 9_000 }).findings.map((f) => f.id)).toContain(
      "HULL_WORN_OUT",
    );
    expect(
      run(upgrade(), { ...ship, remainingServiceMonths: 6 }).findings.map((f) => f.id),
    ).toContain("REFIT_SERVICE_LIFE_TOO_SHORT");
  });
  it("economics: an absurdly expensive refit is uneconomical against replacement", () => {
    const r = run(upgrade("director_gold"));
    expect(r.costRatioBp).toBeGreaterThanOrEqual(refitBalance.uneconomicalBp);
    expect(
      r.findings.some((f) => f.id === "REFIT_UNECONOMICAL" || f.id === "REFIT_UNECONOMICAL_HARD"),
    ).toBe(true);
  });
  it("upgrades cannot go on forever: repeated refits eventually hit a physical or economic limit", () => {
    let s = ship;
    let applied = 0;
    for (let i = 0; i < 40; i++) {
      const plan: RefitPlan = {
        kind: "SENSOR_FC_UPDATE",
        removeInstanceIds: [],
        add: [
          {
            instanceId: `extra${i}`,
            componentId: "director_mk1",
            zoneId: "SUPERSTRUCTURE",
            stationPermille: 520 + (i % 100),
          },
        ],
      };
      const e = run(plan, s);
      if (!e.legal) break;
      s = e.nextState;
      applied++;
    }
    expect(applied).toBeGreaterThan(0);
    expect(applied).toBeLessThan(40);
    expect(s.growthBudgetKg).toBeLessThan(ship.growthBudgetKg);
  });
  it("is deterministic and does not mutate the input ship", () => {
    const snap = JSON.stringify(ship);
    expect(JSON.stringify(run(upgrade()))).toBe(JSON.stringify(run(upgrade())));
    expect(JSON.stringify(ship)).toBe(snap);
  });
});

describe("ARMOUR_MODIFICATION (RTW3 manual p. 32 rebuild list, ADR-0067 §3)", () => {
  const region = (
    r: ArmourRegion["region"],
    thicknessUm: number,
    lengthMm = 10_000,
    heightMm = 2_000,
  ): ArmourRegion => ({
    region: r,
    thicknessUm,
    lengthMm,
    heightMm,
    materialId: "mild_steel",
    cosObliquityBp: 10_000,
  });
  const armoured: ShipState = {
    ...ship,
    growthBudgetKg: 40_000,
    design: {
      ...draft,
      armour: {
        ...draft.armour,
        regions: [
          ...draft.armour.regions,
          region("BELT_UPPER", 50_000),
          region("CONNING_TOWER", 60_000, 3_000, 1_500),
        ],
      },
    },
  };
  const deck = armoured.design.armour.regions.find((r) => r.region === "DECK_MAIN")!;
  const kg = (c: { armour: number }) => c.armour;
  const plan = (over: Partial<RefitPlan>): RefitPlan => ({
    kind: "ARMOUR_MODIFICATION",
    removeInstanceIds: [],
    add: [],
    ...over,
  });
  const addDeck = plan({ armourSet: [{ ...deck, thicknessUm: deck.thicknessUm + 25_400 }] });
  const removeConn = plan({ armourRemove: ["CONNING_TOWER"] });
  const changeBelt = plan({ armourSet: [region("BELT_UPPER", 75_000)] });

  it("add 1 in of DECK_MAIN: legal, adds armour mass, cost and growth use", () => {
    const r = run(addDeck, armoured);
    expect(r.legal).toBe(true);
    expect(r.projectType).toBe("REBUILD");
    expect(kg(r.after.ledger)).toBeGreaterThan(kg(r.before.ledger));
    expect(r.netAddedKg).toBeGreaterThan(0);
    expect(r.costMicro).toBeGreaterThan(0);
    expect(r.nextState.growthBudgetKg).toBeLessThan(armoured.growthBudgetKg);
    expect(
      r.nextState.design.armour.regions.find((x) => x.region === "DECK_MAIN")!.thicknessUm,
    ).toBe(deck.thicknessUm + 25_400);
    expect(r.nextState.refitCount).toBe(1);
  });
  it("remove CONNING_TOWER: legal, sheds armour mass, region gone", () => {
    const r = run(removeConn, armoured);
    expect(r.legal).toBe(true);
    expect(r.netAddedKg).toBeLessThan(0);
    expect(r.newDesign.armour.regions.some((x) => x.region === "CONNING_TOWER")).toBe(false);
    expect(r.nextState.growthBudgetKg).toBeLessThanOrEqual(armoured.growthBudgetKg);
  });
  it("change BELT_UPPER: legal, replaced in place, region count unchanged", () => {
    const r = run(changeBelt, armoured);
    expect(r.legal).toBe(true);
    expect(r.netAddedKg).toBeGreaterThan(0);
    expect(r.newDesign.armour.regions.map((x) => x.region)).toEqual(
      armoured.design.armour.regions.map((x) => x.region),
    );
    expect(r.newDesign.armour.regions.find((x) => x.region === "BELT_UPPER")!.thicknessUm).toBe(
      75_000,
    );
  });
  it("armour edits are illegal under any other refit kind", () => {
    for (const kind of ["SENSOR_FC_UPDATE", "REARMAMENT", "MAJOR_RECONSTRUCTION"] as const) {
      for (const p of [addDeck, removeConn, changeBelt]) {
        const r = run({ ...p, kind }, armoured);
        expect(r.legal).toBe(false);
        expect(r.findings.map((x) => x.id)).toContain("REFIT_ARMOUR_KIND_MISMATCH");
        expect(r.nextState).toBe(armoured);
      }
    }
  });
  it("removing a region the ship lacks is blocked", () => {
    const r = run(plan({ armourRemove: ["TORPEDO_BELT"] }), armoured);
    expect(r.legal).toBe(false);
    expect(r.findings.map((x) => x.id)).toContain("REFIT_UNKNOWN_TARGET");
  });
  it("respects the growth budget", () => {
    const r = run(addDeck, { ...armoured, growthBudgetKg: 1 });
    expect(r.legal).toBe(false);
    expect(r.findings.map((x) => x.id)).toContain("REFIT_GROWTH_EXCEEDED");
  });
  it("respects remaining-life and fatigue limits for all three cases", () => {
    const rule = refitBalance.rules.ARMOUR_MODIFICATION;
    for (const p of [addDeck, removeConn, changeBelt]) {
      const old = run(p, { ...armoured, remainingServiceMonths: rule.minRemainingLifeMonths - 1 });
      expect(old.findings.map((x) => x.id)).toContain("REFIT_SERVICE_LIFE_TOO_SHORT");
      const worn = run(p, { ...armoured, hullFatigueBp: rule.maxHullFatigueBp + 1 });
      expect(worn.findings.map((x) => x.id)).toContain("HULL_WORN_OUT");
      const ok = run(p, armoured);
      expect(ok.nextState.hullFatigueBp).toBe(armoured.hullFatigueBp + rule.fatigueGainBp);
      expect(ok.nextState.remainingServiceMonths).toBe(
        armoured.remainingServiceMonths + rule.lifeExtensionMonths,
      );
    }
  });
  it("is deterministic and does not mutate the input", () => {
    const snap = JSON.stringify(armoured);
    expect(JSON.stringify(run(addDeck, armoured))).toBe(JSON.stringify(run(addDeck, armoured)));
    expect(JSON.stringify(armoured)).toBe(snap);
  });
  it("plans without armour fields are unchanged: design armour is the same object and serialization has no new keys", () => {
    const r = run(upgrade());
    expect(r.newDesign.armour).toBe(draft.armour);
    expect(JSON.stringify(upgrade())).not.toContain("armour");
    expect(Object.keys(upgrade()).sort()).toEqual(["add", "kind", "removeInstanceIds"]);
  });
  it("a plan with armour edits survives a JSON round trip with the same result", () => {
    const rt = JSON.parse(JSON.stringify(addDeck)) as RefitPlan;
    expect(JSON.stringify(run(rt, armoured))).toBe(JSON.stringify(run(addDeck, armoured)));
  });
});

describe("ARMOUR_MODIFICATION tech gating (ticket 24; shares the compile gate)", () => {
  const gated: ShipContext = {
    ...ctx,
    balance: {
      ...ctx.balance,
      armour: {
        ...ctx.balance.armour,
        materialEffBp: {
          ...ctx.balance.armour.materialEffBp,
          compound: 13_000,
          nickel_steel: 13_500,
        },
        materialAvailability: {
          nickel_steel: { requires: ["tech_nickel"], fromMonth: "1895-01" },
          compound: { fromMonth: "1880-01", obsoleteMonth: "1893-01", maxThicknessUm: 450_000 },
          mild_steel: { fromMonth: "1880-01", maxThicknessUm: 40_000 },
        },
      },
    },
  };
  const deck = draft.armour.regions.find((r) => r.region === "DECK_MAIN")!;
  const plan = (r: Partial<ArmourRegion>): RefitPlan => ({
    kind: "ARMOUR_MODIFICATION",
    removeInstanceIds: [],
    add: [],
    armourSet: [{ ...deck, thicknessUm: 40_000, ...r }],
  });
  const big: ShipState = { ...ship, growthBudgetKg: 40_000 };
  const ids = (r: ReturnType<typeof run>) => r.findings.map((x) => x.id);

  it("an available material at an allowed thickness is legal", () => {
    const r = run(plan({ materialId: "mild_steel" }), big, gated);
    expect(r.legal).toBe(true);
    expect(ids(r).some((i) => i.includes("ARMOUR_"))).toBe(false);
  });
  it("a material whose tech is missing is BLOCKING and the ship is unchanged", () => {
    const r = run(plan({ materialId: "nickel_steel" }), big, gated);
    expect(r.legal).toBe(false);
    const x = r.findings.find((f) => f.id === "REFIT_ARMOUR_TECH_UNAVAILABLE")!;
    expect(x.severity).toBe("BLOCKING");
    expect(x.why).toContain("tech_nickel");
    expect(checkFindingShape(x)).toEqual([]);
    expect(r.nextState).toBe(big);
    const ok = run(plan({ materialId: "nickel_steel" }), big, {
      ...gated,
      month: "1895-01",
      unlockedTechs: new Set([...gated.unlockedTechs, "tech_nickel"]),
    });
    expect(ok.legal).toBe(true);
  });
  it("a material not yet introduced at the campaign month is BLOCKING, legal once introduced", () => {
    const techd = { ...gated, unlockedTechs: new Set([...gated.unlockedTechs, "tech_nickel"]) };
    const early = run(plan({ materialId: "nickel_steel" }), big, techd);
    expect(early.legal).toBe(false);
    expect(early.findings.find((f) => f.id === "REFIT_ARMOUR_TECH_UNAVAILABLE")!.why).toContain(
      "1895-01",
    );
    const late = run(plan({ materialId: "nickel_steel" }), big, {
      ...gated,
      month: "1895-01",
      unlockedTechs: new Set([...gated.unlockedTechs, "tech_nickel"]),
    });
    expect(late.legal).toBe(true);
  });
  it("an obsolete material is only an ADVISORY", () => {
    const r = run(plan({ materialId: "compound" }), big, gated);
    expect(r.legal).toBe(true);
    expect(r.findings.find((f) => f.id === "REFIT_ARMOUR_MATERIAL_OBSOLETE")?.severity).toBe(
      "ADVISORY",
    );
  });
  it("a plate thicker than the material allows is BLOCKING", () => {
    const r = run(plan({ materialId: "mild_steel", thicknessUm: 40_001 }), big, gated);
    expect(r.legal).toBe(false);
    const x = r.findings.find((f) => f.id === "REFIT_ARMOUR_THICKNESS_UNAVAILABLE")!;
    expect(x.severity).toBe("BLOCKING");
    expect(x.evidence.threshold).toBe(40_000);
    expect(run(plan({ materialId: "mild_steel", thicknessUm: 40_000 }), big, gated).legal).toBe(
      true,
    );
  });
  it("the same gate blocks a new design compile", () => {
    const d = {
      ...draft,
      armour: { ...draft.armour, regions: [{ ...deck, materialId: "nickel_steel" }] },
    };
    const c = compileDesign(d, gated);
    expect(c.findings.some((f) => f.id === "ARMOUR_TECH_UNAVAILABLE")).toBe(true);
    expect(c.valid).toBe(false);
  });
  it("an existing out-of-gate region is not re-judged; unrelated refits and absent availability are unchanged", () => {
    const old: ShipState = {
      ...big,
      design: {
        ...draft,
        armour: { ...draft.armour, regions: [{ ...deck, materialId: "nickel_steel" }] },
      },
    };
    const r = run(
      { ...plan({}), armourSet: undefined, armourRemove: ["SPLINTER_PLATING"] },
      old,
      gated,
    );
    expect(ids(r)).not.toContain("REFIT_ARMOUR_TECH_UNAVAILABLE");
    expect(run(plan({ materialId: "nickel_steel" }), big, ctx).legal).toBe(true);
    expect(run(upgrade(), ship, gated).legal).toBe(true);
  });
  it("is deterministic", () => {
    const p = plan({ materialId: "nickel_steel" });
    expect(JSON.stringify(run(p, big, gated))).toBe(JSON.stringify(run(p, big, gated)));
  });
});
