import { describe, it, expect } from "vite-plus/test";
import {
  compileDesign,
  applyEdit,
  EditError,
  changeKindOf,
  checkFindingShape,
  LEDGER_CATEGORIES,
  ledgerTotal,
  type DesignDraft,
  type ShipContext,
} from "../src/index.js";
import { ctx, draft } from "./fixtures/gunboat.js";

const ids = (r: ReturnType<typeof compileDesign>) => r.findings.map((f) => f.id);
const withDraft = (o: Partial<DesignDraft>): DesignDraft => ({ ...draft, ...o });
const withCtx = (o: Partial<ShipContext>): ShipContext => ({ ...ctx, ...o });

describe("compileDesign: reference gunboat", () => {
  const r = compileDesign(draft, ctx);
  it("is valid, with only non-blocking findings that are well formed", () => {
    expect(r.valid).toBe(true);
    expect(r.findings.some((f) => f.severity === "BLOCKING")).toBe(false);
    for (const f of r.findings) expect(checkFindingShape(f), f.id).toEqual([]);
  });
  it("ledger lines are non-negative and the weight lumps sum exactly to the ledger (I1, I2)", () => {
    for (const c of LEDGER_CATEGORIES) expect(r.ledger[c]).toBeGreaterThanOrEqual(0);
    expect(r.totalKg).toBe(ledgerTotal(r.ledger));
    expect(r.stability!.displacementKg).toBe(r.totalKg);
  });
  it("meets the brief: speed, range, stability window, trim", () => {
    expect(r.machinery!.maxSpeedMilliKnots).toBeGreaterThanOrEqual(20_000);
    expect(r.machinery!.rangeNmAtCruise).toBeGreaterThanOrEqual(2_500);
    expect(r.stability!.gmMm).toBeGreaterThan(500);
    expect(r.stability!.gmMm).toBeLessThan(2_000);
    expect(Math.abs(r.stability!.trimBp)).toBeLessThanOrEqual(150);
  });
  it("golden regression values", () => {
    expect({
      total: r.totalKg,
      hull: r.ledger.hull,
      machinery: r.ledger.machinery,
      fuel: r.ledger.fuel,
      vmax: r.machinery!.maxSpeedMilliKnots,
      range: r.machinery!.rangeNmAtCruise,
      gm: r.stability!.gmMm,
      crew: r.systems!.crewRequired,
      warnings: ids(r),
    }).toMatchInlineSnapshot(`
      {
        "crew": 74,
        "fuel": 150000,
        "gm": 1365,
        "hull": 243902,
        "machinery": 151800,
        "range": 3127,
        "total": 673781,
        "vmax": 21377,
        "warnings": [
          "ARMOUR_INEFFECTIVE_VS_ADVERSARY",
          "FIRE_CONTROL_NO_POSITIONS",
          "MAGAZINE_UNPROTECTED",
          "MAGAZINE_UNPROTECTED",
        ],
      }
    `);
  });
  it("is deterministic and independent of placement order; hash changes with the design", () => {
    expect(compileDesign(draft, ctx).hash).toBe(r.hash);
    expect(
      compileDesign(withDraft({ placements: [...draft.placements].reverse() }), ctx).hash,
    ).toBe(r.hash);
    expect(
      compileDesign(withDraft({ machinery: { ...draft.machinery, installedKw: 3_400 } }), ctx).hash,
    ).not.toBe(r.hash);
    expect(r.hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("compileDesign: invalid designs", () => {
  it("overweight is BLOCKING and nothing is silently adjusted", () => {
    const r = compileDesign(
      withDraft({ machinery: { ...draft.machinery, fuelCapacityKg: 400_000 } }),
      ctx,
    );
    expect(r.valid).toBe(false);
    expect(ids(r)).toContain("OVERWEIGHT_UNRECOVERABLE");
    expect(r.ledger.fuel).toBe(400_000);
  });
  it("unavailable technology cannot be used (I4)", () => {
    const r = compileDesign(draft, withCtx({ unlockedTechs: new Set(["tech_whitehead"]) }));
    expect(r.valid).toBe(false);
    expect(ids(r)).toContain("TECH_UNAVAILABLE");
    const future = compileDesign(draft, withCtx({ month: "1879-01" }));
    expect(ids(future)).toContain("TECH_UNAVAILABLE");
  });
  it("unknown component and illegal parameters are BLOCKING", () => {
    const bad = withDraft({
      placements: [
        ...draft.placements,
        { instanceId: "zz", componentId: "ghost", zoneId: "FORECASTLE", stationPermille: 10 },
      ],
    });
    expect(ids(compileDesign(bad, ctx))).toContain("COMPONENT_UNKNOWN");
    const p = withDraft({
      placements: draft.placements.map((x) =>
        x.instanceId === "a_gun_fwd" ? { ...x, params: { barrels: 3, rounds: 105 } } : x,
      ),
    });
    const r = compileDesign(p, ctx);
    expect(ids(r).filter((i) => i === "PARAM_RANGE")).toHaveLength(2);
    expect(r.valid).toBe(false);
  });
  it("treaty and dockyard limits block", () => {
    expect(
      ids(compileDesign(draft, withCtx({ treaty: { maxDisplacementKg: 500_000 } }))),
    ).toContain("TREATY_LIMIT_DISPLACEMENT");
    expect(
      ids(compileDesign(draft, withCtx({ treaty: { maxMainGunCaliberUm: 100_000 } }))),
    ).not.toContain("TREATY_LIMIT_CALIBRE"); // secondary guns only
    expect(
      ids(compileDesign(draft, withCtx({ treaty: { forbiddenCategories: ["DD"] } }))),
    ).toContain("TREATY_LIMIT_CATEGORY");
    const small = withCtx({
      facilities: [
        {
          id: "tiny",
          maxLengthMm: 30_000,
          maxBeamMm: 5_000,
          maxDisplacementKg: 100_000,
          craneLiftKg: 1_000,
        },
      ],
    });
    expect(ids(compileDesign(draft, small))).toContain("NO_FACILITY_FITS");
    expect(ids(compileDesign(draft, withCtx({ facilities: [] })))).toContain("NO_FACILITY_FITS");
  });
  it("missing magazine, cramped zone and no propulsion are BLOCKING", () => {
    const nomag = withDraft({
      placements: draft.placements.map((x) =>
        x.instanceId === "a_gun_fwd" ? ({ ...x, magazineRef: undefined } as never) : x,
      ),
    });
    expect(ids(compileDesign(nomag, ctx))).toContain("ARR-MAG-VOLUME");
    const full = withDraft({
      placements: [
        ...draft.placements,
        {
          instanceId: "q2",
          componentId: "quarters_basic",
          zoneId: "FORECASTLE",
          stationPermille: 40,
        },
      ],
    });
    expect(ids(compileDesign(full, ctx))).toContain("ARR-OVERLAP");
    expect(
      ids(compileDesign(withDraft({ machinery: { ...draft.machinery, installedKw: 0 } }), ctx)),
    ).toContain("NO_PROPULSION");
  });
  it("modernization expectation raises an advisory when no growth reserve exists", () => {
    const r = compileDesign(
      withDraft({ requirement: { ...draft.requirement, modernizationExpectation: "MAJOR" } }),
      ctx,
    );
    const f = r.findings.find((x) => x.id === "MODERNIZATION_MARGIN_LOW")!;
    expect(f.severity).toBe("ADVISORY");
    expect(r.valid).toBe(true);
  });
  it("trade-off: more speed costs weight, fuel range and trim", () => {
    const fast = compileDesign(
      withDraft({ machinery: { ...draft.machinery, installedKw: 5_500 } }),
      ctx,
    );
    const base = compileDesign(draft, ctx);
    expect(fast.machinery!.maxSpeedMilliKnots).toBeGreaterThan(base.machinery!.maxSpeedMilliKnots);
    expect(fast.ledger.machinery).toBeGreaterThan(base.ledger.machinery);
    expect(fast.machinery!.rangeNmAtCruise).toBeLessThanOrEqual(base.machinery!.rangeNmAtCruise);
    expect(fast.totalKg).toBeGreaterThan(base.totalKg);
  });
  it("throws only on corrupt context", () => {
    expect(() =>
      compileDesign(withDraft({ hull: { ...draft.hull, hullFormId: "nope" } }), ctx),
    ).toThrow();
    expect(() =>
      compileDesign(withDraft({ machinery: { ...draft.machinery, plantId: "nope" } }), ctx),
    ).toThrow();
    // An unregistered ship type is a design error, not corrupt context: it is a blocking finding (ADR-0088),
    // so a crafted command cannot make the month executor throw.
    const unknownType = compileDesign(
      withDraft({ requirement: { ...draft.requirement, category: "nope" } }),
      ctx,
    );
    expect(unknownType.valid).toBe(false);
    expect(unknownType.findings.map((x) => x.id)).toContain("SHIP_TYPE_UNREGISTERED");
  });
  it("performance: one compile is fast enough for live preview", () => {
    const t = performance.now();
    for (let i = 0; i < 100; i++) compileDesign(draft, ctx);
    expect((performance.now() - t) / 100).toBeLessThan(25);
  });
});

describe("compileDesign: engine priority (#168 step 2)", () => {
  const tuned = withCtx({
    balance: {
      ...ctx.balance,
      machinery: {
        ...ctx.balance.machinery,
        enginePriorityWeightSwingBp: 1_500,
        enginePriorityPowerSwingBp: 500,
        enginePriorityReliabilitySwingBp: 3_000,
        enginePriorityReliabilityWarnBp: 7_000,
      },
    },
  });
  const at = (p: number | undefined) =>
    compileDesign(
      withDraft({
        machinery: { ...draft.machinery, ...(p === undefined ? {} : { enginePriorityBp: p }) },
      }),
      tuned,
    );

  it("a draft without the field compiles exactly as before (priority 0 = balanced)", () => {
    expect(at(0).hash).toBe(at(undefined).hash);
    expect(compileDesign(draft, ctx).hash).toBe(compileDesign(draft, tuned).hash);
  });
  it("speed priority lightens the machinery ledger and raises top speed; reliability priority does the reverse", () => {
    const fast = at(10_000);
    const mid = at(0);
    const safe = at(-10_000);
    expect(fast.ledger.machinery).toBeLessThan(mid.ledger.machinery);
    expect(safe.ledger.machinery).toBeGreaterThan(mid.ledger.machinery);
    expect(fast.machinery!.maxSpeedMilliKnots).toBeGreaterThan(mid.machinery!.maxSpeedMilliKnots);
    expect(safe.machinery!.reliabilityBp).toBeGreaterThan(mid.machinery!.reliabilityBp);
    expect(fast.machinery!.reliabilityBp).toBeLessThan(mid.machinery!.reliabilityBp);
  });
  it("warns of breakdown risk only on the speed side, with a well-formed finding", () => {
    const f = at(10_000).findings.find((x) => x.id === "ENGINE_PRIORITY_BREAKDOWN_RISK");
    expect(f).toBeDefined();
    expect(checkFindingShape(f!)).toEqual([]);
    expect(ids(at(0))).not.toContain("ENGINE_PRIORITY_BREAKDOWN_RISK");
    expect(ids(at(-10_000))).not.toContain("ENGINE_PRIORITY_BREAKDOWN_RISK");
  });
});

describe("compileDesign: fire-control positions (#168 step 3)", () => {
  it("carry through edits, the draft hash and an absent field means none", () => {
    const edited = applyEdit(draft, { kind: "set_fire_control", positions: 2 });
    expect(edited.fireControl).toEqual({ positions: 2 });
    expect(() => applyEdit(draft, { kind: "set_fire_control", positions: -1 })).toThrow(EditError);
    expect(changeKindOf({ kind: "set_fire_control", positions: 1 }, () => undefined)).toBe(
      "FITTINGS",
    );
    expect(compileDesign(edited, ctx).systems!.fireControlRedundancyBp).toBe(
      compileDesign(draft, ctx).systems!.fireControlRedundancyBp,
    );
  });
  it("engine priority is a machinery change", () => {
    expect(
      changeKindOf({ kind: "set_machinery", patch: { enginePriorityBp: 500 } }, () => undefined),
    ).toBe("MACHINERY");
  });
});

describe("compileDesign: tertiary battery (#168 step 4b)", () => {
  const tertiaryBalance = {
    gunWeightNanoKgPerMm3: 1_500_000,
    footprintFactorPermille: 400_000,
    shellNanoKgPerMm3: 20_000,
    bearingBp: 5_000,
  };
  const tuned = withCtx({ balance: { ...ctx.balance, tertiary: tertiaryBalance } });
  const withBattery = (count: number) => withDraft({ tertiary: { caliberUm: 57_000, count } });
  const base = compileDesign(draft, tuned);
  const four = compileDesign(withBattery(4), tuned);

  it("no battery, a zero count and absent balance all leave the design unchanged", () => {
    expect(compileDesign(withBattery(0), tuned).hash).toBe(base.hash);
    expect(compileDesign(draft, ctx).hash).toBe(base.hash);
    expect(compileDesign(withBattery(4), ctx).totalKg).toBe(compileDesign(draft, ctx).totalKg);
  });
  it("adds its weight to the armament line and the displacement", () => {
    expect(four.ledger.armament - base.ledger.armament).toBe(4 * 278);
    expect(four.totalKg).toBeGreaterThan(base.totalKg);
  });
  it("loads the topside by its deck footprint", () => {
    const used = (r: typeof base) => r.arrangement!.zones.reduce((a, z) => a + z.deckUsedMm2, 0);
    expect(used(four) - used(base)).toBe(4 * 1_299_600);
  });
  it("adds a bearing share of its shell mass to both broadsides", () => {
    expect(four.weapons!.broadsidePortKg).toBeGreaterThan(base.weapons!.broadsidePortKg);
    expect(four.weapons!.broadsideStbdKg - base.weapons!.broadsideStbdKg).toBe(
      four.weapons!.broadsidePortKg - base.weapons!.broadsidePortKg,
    );
  });
  it("keeps the stability lumps summing exactly to the ledger (I1, I2)", () => {
    expect(four.totalKg).toBe(ledgerTotal(four.ledger));
    expect(four.stability!.displacementKg).toBe(four.totalKg);
  });
  it("rejects a malformed battery", () => {
    expect(() => compileDesign(withDraft({ tertiary: { caliberUm: 0, count: 1 } }), tuned)).toThrow(
      /tertiary/,
    );
  });
});

describe("compileDesign: aluminium superstructure (ADR-0252)", () => {
  const section = { fromMonth: "1880-01", hullWeightSavingBp: 1_000 };
  const tuned = withCtx({ balance: { ...ctx.balance, aluminiumSuperstructure: section } });
  const aluminium = withDraft({ aluminiumSuperstructure: true });
  const base = compileDesign(draft, tuned);
  const light = compileDesign(aluminium, tuned);

  it("an unset design and an absent balance section leave the design unchanged", () => {
    expect(compileDesign(draft, ctx).hash).toBe(base.hash);
    expect(compileDesign(withDraft({ aluminiumSuperstructure: false }), tuned).hash).toBe(
      base.hash,
    );
    expect(base.aluminium).toBeUndefined();
  });
  it("saves the configured share of the hull weight", () => {
    expect(light.ledger.hull).toBeLessThan(base.ledger.hull);
    const saved = base.ledger.hull - light.ledger.hull;
    expect(saved).toBe(Math.floor(base.ledger.hull / 10));
    expect(light.aluminium).toEqual({ fitted: true, available: true, savingBp: 1_000 });
  });
  it("keeps the ledger summing to the displacement", () => {
    expect(light.totalKg).toBe(ledgerTotal(light.ledger));
  });
  it("does nothing, and says so, before the option is available or without a section", () => {
    const early = withCtx({
      balance: { ...ctx.balance, aluminiumSuperstructure: { ...section, fromMonth: "2000-01" } },
    });
    for (const c of [early, ctx]) {
      const r = compileDesign(aluminium, c);
      expect(r.ledger.hull).toBe(base.ledger.hull);
      expect(r.aluminium?.available).toBe(false);
      expect(r.findings.some((f) => f.id === "ALUMINIUM_SUPERSTRUCTURE_UNAVAILABLE")).toBe(true);
    }
  });
  it("notes the fire susceptibility the battle model does not yet carry", () => {
    expect(light.findings.some((f) => f.id === "ALUMINIUM_FIRE_SUSCEPTIBILITY")).toBe(true);
  });
  it("is a structure change", () => {
    expect(
      changeKindOf({ kind: "set_aluminium_superstructure", fitted: true }, () => undefined),
    ).toBe("STRUCTURE");
  });
});

describe("compileDesign: AA fit (ADR-0252)", () => {
  // Fixture values, not game values.
  const section = {
    fromMonth: "1880-01",
    lightGunWeightKg: 100,
    mediumGunWeightKg: 1_000,
    directorWeightKg: 500,
    lightGunFootprintMm2: 1_000_000,
    mediumGunFootprintMm2: 5_000_000,
    directorFootprintMm2: 2_000_000,
  };
  const tuned = withCtx({ balance: { ...ctx.balance, antiAircraft: section } });
  const fit = { lightGuns: 4, mediumGuns: 2, directors: 3 };
  const withFit = withDraft({ antiAircraft: fit });
  const base = compileDesign(draft, tuned);
  const fitted = compileDesign(withFit, tuned);

  it("an unset design and an absent balance section leave the design unchanged", () => {
    expect(compileDesign(draft, ctx).hash).toBe(base.hash);
    expect(base.antiAircraft).toBeUndefined();
    expect(compileDesign(withFit, ctx).ledger.armament).toBe(base.ledger.armament);
  });
  it("adds the fit's weight to the armament line and the displacement", () => {
    expect(fitted.ledger.armament - base.ledger.armament).toBe(4 * 100 + 2 * 1_000 + 3 * 500);
    expect(fitted.totalKg).toBeGreaterThan(base.totalKg);
  });
  it("loads the topside by the fit's deck area", () => {
    const used = (r: typeof base) => r.arrangement!.zones.reduce((a, z) => a + z.deckUsedMm2, 0);
    expect(used(fitted) - used(base)).toBe(4 * 1_000_000 + 2 * 5_000_000 + 3 * 2_000_000);
  });
  it("keeps the stability lumps summing exactly to the ledger (I1, I2)", () => {
    expect(fitted.totalKg).toBe(ledgerTotal(fitted.ledger));
    expect(fitted.stability!.displacementKg).toBe(fitted.totalKg);
  });
  it("does nothing, and says so, before the fit is available", () => {
    const early = withCtx({
      balance: { ...ctx.balance, antiAircraft: { ...section, fromMonth: "2000-01" } },
    });
    const r = compileDesign(withFit, early);
    expect(r.ledger.armament).toBe(base.ledger.armament);
    expect(r.antiAircraft?.available).toBe(false);
    expect(r.findings.some((f) => f.id === "ANTI_AIRCRAFT_UNAVAILABLE")).toBe(true);
  });
  it("notes that battle does not yet read it", () => {
    expect(fitted.findings.some((f) => f.id === "ANTI_AIRCRAFT_NOT_MODELLED_IN_BATTLE")).toBe(true);
  });
  it("rejects more than four directors", () => {
    expect(() =>
      compileDesign(withDraft({ antiAircraft: { ...fit, directors: 5 } }), tuned),
    ).toThrow(/antiAircraft/);
  });
  it("is a fittings change", () => {
    expect(changeKindOf({ kind: "set_anti_aircraft", antiAircraft: fit }, () => undefined)).toBe(
      "FITTINGS",
    );
  });
});
