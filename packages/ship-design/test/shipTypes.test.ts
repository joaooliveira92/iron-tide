import { describe, expect, it } from "vite-plus/test";
import {
  availabilityMessage,
  AVAILABILITY_REASON_CODES,
  buildShipTypeRoster,
  checkFindingShape,
  CLASSIFIED_SHIP_TYPES,
  classRuleFailures,
  colonialServiceEligibility,
  compileDesign,
  DESIGN_22_EARLY,
  eraBandOf,
  evaluateAmcFleetLimit,
  evaluateShipTypeAvailability,
  HULL_TYPE_FOR_SHIP_TYPE,
  isShipTypeId,
  naturalClass,
  OPENING_SHIP_TYPES,
  SHIP_TYPE_IDS,
  SHIP_TYPES,
  shipTypeEnvelope,
  starterFor,
  UM_PER_INCH,
  UM_PER_KNOT,
  validateDraftShape,
  type ClassFacts,
  type DesignDraft,
  type StarterDesign,
} from "../src/index.js";
import {
  earlyContext,
  readReferenceDesignEntries,
  shipBuildingContent,
} from "./helpers/earlyContext.js";

const R = DESIGN_22_EARLY;
const refs = readReferenceDesignEntries();
const starters = refs.filter((r) => r.starterFor !== undefined) as StarterDesign[];
const OPENING = ["B", "CA", "CL", "DD", "KE", "AMC"] as const;
const FUTURE = ["BB", "BC", "CV", "CVL", "AV", "SS", "MTB", "TR"] as const;
const ctxAt = (month: string, techs: string[] = []) => ({
  month,
  unlockedTechs: new Set(techs),
});

describe("registry", () => {
  it("holds exactly the fourteen canonical types, each with a unique roster order", () => {
    expect(SHIP_TYPE_IDS).toHaveLength(14);
    expect(new Set(SHIP_TYPE_IDS).size).toBe(14);
    expect(new Set(Object.values(SHIP_TYPES).map((t) => t.order)).size).toBe(14);
    for (const id of SHIP_TYPE_IDS) expect(SHIP_TYPES[id].id).toBe(id);
  });
  it("opens with the six pre-dreadnought types and nothing else", () => {
    expect([...OPENING_SHIP_TYPES].sort()).toEqual([...OPENING].sort());
  });
  it("places the armed merchant cruiser in the auxiliary group and marks it auxiliary", () => {
    expect(SHIP_TYPES.AMC.category).toBe("AUXILIARY");
    expect(SHIP_TYPES.AMC.auxiliary).toBe(true);
    for (const t of ["B", "CA", "CL", "DD"] as const) expect(SHIP_TYPES[t].auxiliary).toBe(false);
  });
  it("gives every opening type the torpedo policy of its brief", () => {
    expect(SHIP_TYPES.DD.torpedoes).toBe("REQUIRED");
    expect(SHIP_TYPES.KE.torpedoes).toBe("PROHIBITED");
  });
  it("only a type with a validator and a hull type can ever be available (exhaustive)", () => {
    for (const id of SHIP_TYPE_IDS) {
      const buildable = SHIP_TYPES[id].availability.mechanicsImplemented;
      if (buildable) {
        expect(CLASSIFIED_SHIP_TYPES as readonly string[]).toContain(id);
        expect(HULL_TYPE_FOR_SHIP_TYPE).toHaveProperty(id);
      }
    }
  });
  it("recognises only registered ids", () => {
    expect(isShipTypeId("KE")).toBe(true);
    for (const bad of ["ke", "DREADNOUGHT", "", null, undefined, 7, {}])
      expect(isShipTypeId(bad)).toBe(false);
  });
});

describe("availability", () => {
  it.each(OPENING)("%s is available at the opening date with no technology", (t) => {
    const a = evaluateShipTypeAvailability(t, ctxAt("1880-01"));
    expect(a).toEqual({ type: t, available: true, reasons: [] });
  });
  it.each(FUTURE)("%s is locked at the opening date with a stable reason code", (t) => {
    const a = evaluateShipTypeAvailability(t, ctxAt("1880-01"));
    expect(a.available).toBe(false);
    expect(a.reasons.length).toBeGreaterThan(0);
    for (const r of a.reasons) {
      expect(AVAILABILITY_REASON_CODES).toContain(r.code);
      expect(r.message).toBe(availabilityMessage(r.code));
    }
  });
  it("gives BB its own reasons: era and the dreadnought technology", () => {
    const codes = evaluateShipTypeAvailability("BB", ctxAt("1885-01")).reasons.map((r) => r.code);
    expect(codes).toEqual(["SHIP_TYPE_ERA_NOT_REACHED", "SHIP_TYPE_TECHNOLOGY_REQUIRED"]);
  });
  it("unlocks BB only with the era and the technology together", () => {
    expect(evaluateShipTypeAvailability("BB", ctxAt("1906-01")).available).toBe(false);
    expect(
      evaluateShipTypeAvailability("BB", ctxAt("1906-01", ["sd_dreadnought_design"])).available,
    ).toBe(true);
    expect(
      evaluateShipTypeAvailability("BB", ctxAt("1890-01", ["sd_dreadnought_design"])).available,
    ).toBe(false);
  });
  it("keeps BC and the aviation, submarine and transport types locked even with every technology", () => {
    const all = [
      "sd_battlecruiser_design",
      "sd_dreadnought_design",
      "sub_practical_military_design",
    ];
    for (const t of ["BC", "CV", "CVL", "AV", "SS", "MTB", "TR"] as const) {
      const a = evaluateShipTypeAvailability(t, ctxAt("1990-01", all));
      expect(a.reasons.map((r) => r.code)).toContain("SHIP_TYPE_MECHANICS_NOT_IMPLEMENTED");
    }
  });
  it("rejects an unknown id and a restricted type", () => {
    expect(evaluateShipTypeAvailability("ZZ", ctxAt("1880-01")).reasons[0]?.code).toBe(
      "SHIP_TYPE_UNREGISTERED",
    );
    const r = evaluateShipTypeAvailability("DD", { ...ctxAt("1880-01"), restrictedTypes: ["DD"] });
    expect(r.reasons.map((x) => x.code)).toEqual(["SHIP_TYPE_RESTRICTED"]);
  });
  it("never names a technology in a user-facing message (fog of war)", () => {
    for (const code of AVAILABILITY_REASON_CODES)
      expect(availabilityMessage(code)).not.toMatch(/sd_|sub_|_design/);
  });
  it("maps months to the DESIGN-22 bands and refuses malformed months", () => {
    expect(eraBandOf("1880-01")).toBe("EARLY");
    expect(eraBandOf("1899-12")).toBe("EARLY");
    expect(eraBandOf("1900-01")).toBe("PRE_WAR");
    expect(eraBandOf("1879-12")).toBeNull();
    expect(eraBandOf("1880-13")).toBeNull();
    expect(eraBandOf("nonsense")).toBeNull();
  });
});

const base = (o: Partial<ClassFacts>): ClassFacts => ({
  displacementKg: 1_000_000,
  speedUms: 12 * UM_PER_KNOT,
  beltUm: 0,
  anyQualifyingArmourUm: 0,
  maxMainGunUm: 0,
  maxGunUm: 0,
  mainTurretCount: 0,
  torpedoTubes: 0,
  aircraftCapacity: 0,
  deckUm: 0,
  maxHeavyMountBarrels: 0,
  merchantHull: false,
  ...o,
});
const codes = (t: (typeof CLASSIFIED_SHIP_TYPES)[number], f: ClassFacts) =>
  classRuleFailures[t](f, R).map((x) => x.code);

describe("opening-type rules (boundary matrix)", () => {
  it.each([
    ["KE displacement just below 2,500 t", "KE", { displacementKg: 2_499_999 }, true],
    ["KE displacement exactly 2,500 t", "KE", { displacementKg: 2_500_000 }, false],
    ["KE belt exactly 2 in", "KE", { beltUm: 2 * UM_PER_INCH }, true],
    ["KE belt over 2 in", "KE", { beltUm: 2 * UM_PER_INCH + 1 }, false],
    ["KE gun exactly 6 in", "KE", { maxGunUm: 6 * UM_PER_INCH }, true],
    ["KE gun over 6 in", "KE", { maxGunUm: 6 * UM_PER_INCH + 1 }, false],
    ["KE with a torpedo tube", "KE", { torpedoTubes: 1 }, false],
    ["AMC at exactly 1,700 t", "AMC", { displacementKg: 1_700_000, merchantHull: true }, false],
    [
      "AMC above 1,700 t on a merchant hull",
      "AMC",
      { displacementKg: 1_700_001, merchantHull: true },
      true,
    ],
    ["AMC on a warship hull", "AMC", { displacementKg: 5_000_000 }, false],
    [
      "AMC with 2 in armour",
      "AMC",
      { displacementKg: 5_000_000, merchantHull: true, anyQualifyingArmourUm: 2 * UM_PER_INCH },
      false,
    ],
    [
      "AMC with 1.99 in armour",
      "AMC",
      { displacementKg: 5_000_000, merchantHull: true, anyQualifyingArmourUm: 2 * UM_PER_INCH - 1 },
      true,
    ],
    [
      "AMC gun over 6 in",
      "AMC",
      { displacementKg: 5_000_000, merchantHull: true, maxGunUm: 6 * UM_PER_INCH + 1 },
      false,
    ],
    [
      "DD secondary gun over 6 in",
      "DD",
      { speedUms: 20 * UM_PER_KNOT, torpedoTubes: 1, maxGunUm: 8 * UM_PER_INCH },
      false,
    ],
    [
      "DD with only light guns",
      "DD",
      { speedUms: 20 * UM_PER_KNOT, torpedoTubes: 1, maxGunUm: 3 * UM_PER_INCH },
      true,
    ],
    [
      "CL belt of 2 in",
      "CL",
      { displacementKg: 4_000_000, speedUms: 17 * UM_PER_KNOT, beltUm: 2 * UM_PER_INCH },
      true,
    ],
    [
      "CL belt over 2 in (an armoured cruiser's belt)",
      "CL",
      { displacementKg: 4_000_000, speedUms: 17 * UM_PER_KNOT, beltUm: 4 * UM_PER_INCH },
      false,
    ],
    [
      "B with three turrets (dreadnought arrangement)",
      "B",
      {
        displacementKg: 9_000_000,
        beltUm: 9 * UM_PER_INCH,
        maxMainGunUm: 12 * UM_PER_INCH,
        mainTurretCount: 3,
      },
      false,
    ],
    [
      "B with two turrets",
      "B",
      {
        displacementKg: 9_000_000,
        beltUm: 9 * UM_PER_INCH,
        maxMainGunUm: 12 * UM_PER_INCH,
        mainTurretCount: 2,
      },
      true,
    ],
  ] as const)("%s", (_name, type, facts, passes) => {
    expect(codes(type, base(facts)).length === 0).toBe(passes);
  });

  it("reports every simultaneous failure of a corvette with stable codes", () => {
    const f = base({
      displacementKg: 3_000_000,
      beltUm: 5 * UM_PER_INCH,
      maxGunUm: 9 * UM_PER_INCH,
      torpedoTubes: 2,
    });
    expect(codes("KE", f)).toEqual([
      "KE_DISPLACEMENT_LIMIT_EXCEEDED",
      "KE_BELT_TOO_THICK",
      "KE_MAIN_GUN_TOO_LARGE",
      "KE_TORPEDO_PROHIBITED",
    ]);
    for (const x of classRuleFailures.KE(f, R)) expect(x.suggestion).toBeTruthy();
  });

  it("resolves the AMC/KE/CL/DD overlaps by the canonical precedence", () => {
    const liner = base({
      displacementKg: 3_000_000,
      merchantHull: true,
      speedUms: 17 * UM_PER_KNOT,
    });
    expect(naturalClass(liner, R)).toBe("AMC");
    expect(naturalClass({ ...liner, merchantHull: false }, R)).toBe("CL");
    expect(naturalClass(base({ displacementKg: 1_200_000 }), R)).toBe("KE");
    expect(
      naturalClass(
        base({ displacementKg: 1_200_000, torpedoTubes: 2, speedUms: 21 * UM_PER_KNOT }),
        R,
      ),
    ).toBe("DD");
  });

  it("derives the player-facing envelope from the rules, not from a second table", () => {
    expect(shipTypeEnvelope("KE", R).displacementKg).toMatchObject({
      max: 2_500_000,
      maxInclusive: false,
    });
    expect(shipTypeEnvelope("B", R).speedKn).toMatchObject({ max: 20, maxInclusive: false });
    expect(shipTypeEnvelope("DD", R).speedKn.min).toBe(R.ddMinSpeedUms / UM_PER_KNOT);
  });
});

describe("AMC fleet limit (DESIGN-22 section 15)", () => {
  const slow = 14 * UM_PER_KNOT;
  const fast = 22 * UM_PER_KNOT;
  it("allows two with no cruisers, then refuses the third", () => {
    const at = (amc: number) => evaluateAmcFleetLimit(slow, { cruisers: 0, amc, fastAmc: 0 }, R);
    expect(at(0).available).toBe(true);
    expect(at(1).available).toBe(true);
    expect(at(2).reasons.map((r) => r.code)).toEqual(["AMC_FLEET_LIMIT_EXCEEDED"]);
  });
  it("scales at 20 % of the cruisers, rounded down", () => {
    expect(evaluateAmcFleetLimit(slow, { cruisers: 19, amc: 2, fastAmc: 0 }, R).available).toBe(
      true,
    );
    expect(evaluateAmcFleetLimit(slow, { cruisers: 19, amc: 3, fastAmc: 0 }, R).available).toBe(
      false,
    );
    expect(evaluateAmcFleetLimit(slow, { cruisers: 20, amc: 3, fastAmc: 0 }, R).available).toBe(
      true,
    );
    expect(evaluateAmcFleetLimit(slow, { cruisers: 20, amc: 4, fastAmc: 0 }, R).available).toBe(
      false,
    );
  });
  it("limits fast ones to 25 % of the auxiliary fleet with a minimum of one", () => {
    expect(evaluateAmcFleetLimit(fast, { cruisers: 40, amc: 0, fastAmc: 0 }, R).available).toBe(
      true,
    );
    const second = evaluateAmcFleetLimit(fast, { cruisers: 40, amc: 3, fastAmc: 1 }, R);
    expect(second.reasons.map((r) => r.code)).toEqual(["AMC_FAST_LIMIT_EXCEEDED"]);
    expect(evaluateAmcFleetLimit(fast, { cruisers: 40, amc: 7, fastAmc: 1 }, R).available).toBe(
      true,
    );
  });
});

describe("colonial service", () => {
  const ok = {
    displacementKg: 800_000,
    cruiseRangeNm: 3_500,
    accommodation: "STANDARD" as const,
    campaignAllows: true,
  };
  it("needs hull, endurance, accommodation and campaign permission together", () => {
    expect(colonialServiceEligibility(ok)).toEqual({ eligible: true, reasons: [] });
    expect(colonialServiceEligibility({ ...ok, displacementKg: 300_000 }).reasons).toEqual([
      "KE_COLONIAL_HULL_TOO_SMALL",
    ]);
    expect(colonialServiceEligibility({ ...ok, cruiseRangeNm: 2_999 }).reasons).toEqual([
      "KE_COLONIAL_ENDURANCE_SHORT",
    ]);
    expect(colonialServiceEligibility({ ...ok, accommodation: "SPARTAN" }).reasons).toEqual([
      "KE_COLONIAL_ACCOMMODATION_POOR",
    ]);
    expect(colonialServiceEligibility({ ...ok, campaignAllows: false }).reasons).toEqual([
      "KE_COLONIAL_CAMPAIGN_DISALLOWED",
    ]);
  });
});

describe("compile enforces availability and classification (domain is the authority)", () => {
  const ctx = earlyContext("1880-01");
  const draftOf = (id: string) => refs.find((r) => r.id === id)!.draft as DesignDraft;
  const as = (id: string, category: string): DesignDraft => ({
    ...draftOf(id),
    requirement: { ...draftOf(id).requirement, category },
  });
  it.each(FUTURE)("a %s design is a blocking finding at the opening date, not a throw", (t) => {
    const r = compileDesign(as("alexandra_1877", t), ctx);
    expect(r.valid).toBe(false);
    expect(r.findings.some((f) => f.id.startsWith("SHIP_TYPE_") && f.severity === "BLOCKING")).toBe(
      true,
    );
    for (const f of r.findings) expect(checkFindingShape(f)).toEqual([]);
  });
  it("a corvette that mounts a torpedo or a heavy secondary gun is blocked with the rule codes", () => {
    const ke = draftOf("starter_corvette_1880");
    const withTube: DesignDraft = {
      ...ke,
      placements: [
        ...ke.placements,
        {
          instanceId: "t",
          componentId: "tube_14in_above_water",
          zoneId: "SUPERSTRUCTURE",
          stationPermille: 500,
          params: { tubes: 1 },
        },
        {
          instanceId: "g",
          componentId: "gun_rml_8in_9ton",
          zoneId: "FORECASTLE",
          stationPermille: 40,
          params: { barrels: 1, rounds: 50 },
        },
      ],
    };
    const ids = compileDesign(withTube, ctx)
      .findings.filter((f) => f.severity === "BLOCKING")
      .map((f) => f.id);
    expect(ids).toContain("INTENDED_CLASSIFICATION_ILLEGAL");
    expect(ids).toContain("KE_TORPEDO_PROHIBITED");
    expect(ids).toContain("KE_MAIN_GUN_TOO_LARGE");
  });
  it("an armed merchant cruiser needs a merchant hull form", () => {
    const amc = draftOf("starter_armed_liner_1880");
    const warship: DesignDraft = {
      ...amc,
      hull: { ...amc.hull, hullFormId: "protected_cruiser_form" },
    };
    const ids = compileDesign(warship, ctx).findings.map((f) => f.id);
    expect(ids).toContain("AMC_MERCHANT_HULL_REQUIRED");
  });
  it("a belted protected cruiser is refused and a deckless one is only warned", () => {
    const cl = draftOf("starter_protected_cruiser_1880");
    const belted: DesignDraft = {
      ...cl,
      armour: {
        ...cl.armour,
        regions: [
          ...cl.armour.regions,
          {
            region: "BELT_MAIN",
            thicknessUm: 102_000,
            lengthMm: 40_000,
            heightMm: 2_000,
            materialId: "wrought_iron",
            cosObliquityBp: 10_000,
          },
        ],
      },
    };
    expect(compileDesign(belted, ctx).findings.map((f) => f.id)).toContain("CL_BELT_TOO_THICK");
    const deckless: DesignDraft = { ...cl, armour: { ...cl.armour, regions: [] } };
    const r = compileDesign(deckless, ctx);
    expect(r.valid).toBe(true);
    expect(r.findings.find((f) => f.id === "CL_ARMOUR_DECK_MISSING")?.severity).toBe("WARNING");
  });
  it("a warning never blocks and a blocker is never downgraded", () => {
    const r = compileDesign(draftOf("starter_corvette_1880"), ctx);
    expect(r.valid).toBe(true);
    expect(r.findings.filter((f) => f.severity === "BLOCKING")).toEqual([]);
  });
});

describe("starter designs", () => {
  const env = shipBuildingContent.environmentFor("1880-01");
  const roster = buildShipTypeRoster(env, starters);
  it.each(OPENING)(
    "%s has a starter that is legal and naturally its own type at the opening date",
    (t) => {
      const e = roster.find((x) => x.definition.id === t)!;
      expect(e.availability.available).toBe(true);
      expect(e.starter).not.toBeNull();
      expect(e.starter!.legal).toBe(true);
      const d = starters.find((s) => s.id === e.starter!.id)!;
      const c = compileDesign(d.draft, env.ctx);
      expect(c.naturalClass).toBe(t);
      expect(c.findings.filter((f) => f.severity === "BLOCKING")).toEqual([]);
      expect(validateDraftShape(JSON.parse(JSON.stringify(d.draft)))).toEqual([]);
    },
  );
  it("lists every registered type, offering starters only for available ones", () => {
    expect(roster).toHaveLength(14);
    for (const t of FUTURE) {
      const e = roster.find((x) => x.definition.id === t)!;
      expect(e.availability.available).toBe(false);
      expect(e.starter).toBeNull();
    }
  });
  it("never reaches into the future: a later starter is not used before its month", () => {
    expect(starterFor("DD", starters, "1880-01", "uk")?.id).toBe("starter_torpedo_gunboat_1880");
    expect(starterFor("DD", starters, "1895-06", "uk")?.id).toBe("havock_like");
    expect(starterFor("DD", starters, "1879-12", "uk")).toBeNull();
  });
});

describe("persisted designs are untrusted", () => {
  const legal = JSON.parse(
    JSON.stringify(refs.find((r) => r.id === "starter_corvette_1880")!.draft),
  ) as Record<string, unknown>;
  it("accepts a legal saved draft unchanged", () => {
    expect(validateDraftShape(legal)).toEqual([]);
  });
  it.each(["BATTLECRUISER", "battleship", "", 7, null])("rejects category %j", (category) => {
    const bad = { ...legal, requirement: { ...(legal.requirement as object), category } };
    expect(validateDraftShape(bad).join(";")).toMatch(/not a registered ship type/);
  });
  it("a draft with the category field removed is not defaulted into a type", () => {
    const { category: _drop, ...rest } = legal.requirement as Record<string, unknown>;
    expect(validateDraftShape({ ...legal, requirement: rest })).not.toEqual([]);
  });
});
