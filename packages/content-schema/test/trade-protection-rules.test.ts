import { describe, expect, it } from "vite-plus/test";
import { decodeTradeProtectionRules } from "../src/index.js";

const provenance = {
  sourceStatus: "BALANCE_TARGET",
  confidence: "LOW",
  kind: "balance_adjustment",
  sources: [],
  note: "PROVISIONAL trade protection coefficients",
};

function rules(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sectionVersion: 1,
    fleetShareBp: 1000,
    resourcesPerRequiredShip: 400,
    contributingHullTypes: ["destroyer", "armed_merchant_cruiser"],
    raiderHullTypes: ["protected_cruiser", "armed_merchant_cruiser"],
    amcHullType: "armed_merchant_cruiser",
    amcMinSpeedUms: 4_115_552,
    raiderHitBp: 1500,
    shortfallAmplifyBp: 5000,
    lossPerHitBp: 150,
    pressureChanceBp: 1500,
    pressureLossBp: 100,
    recoveryBpPerMonth: 50,
    revenueSensitivityBp: 5000,
    unrestThresholdBp: 1500,
    unrestCadenceMonths: 3,
    unrestStep: 1,
    provenance,
    ...overrides,
  };
}

const interception = {
  interceptBaseBp: 300,
  interceptPatrolBp: 2000,
  breakoutInterceptBp: 3500,
  raiderSunkBp: 2500,
  maxEngagementDamageBp: 6000,
  scuttleThresholdBp: 2500,
  scuttleShareBp: 5000,
  fuelInternBp: 150,
  breakdownInternBp: 100,
};

const submarine = {
  hullType: "submarine",
  quotaPerBoatBp: 2500,
  attackBp: 1000,
  lossPerHitBp: 120,
  blockadeReductionBp: 8000,
};

const prestige = { thresholdBp: 2000, lossBp: 150 };

describe("decodeTradeProtectionRules", () => {
  it("accepts a complete section", () => {
    expect(decodeTradeProtectionRules(rules())).toEqual({ ok: true, value: rules() });
  });

  it("accepts the optional raiderInterception block and decodes the section without it", () => {
    expect(decodeTradeProtectionRules(rules({ raiderInterception: interception }))).toEqual({
      ok: true,
      value: rules({ raiderInterception: interception }),
    });
  });

  it.each(Object.keys(interception))("rejects a raiderInterception block missing %s", (key) => {
    const { [key]: _removed, ...rest } = interception as Record<string, number>;
    expect(decodeTradeProtectionRules(rules({ raiderInterception: rest }))).toMatchObject({
      ok: false,
      field: `raiderInterception.${key}`,
    });
  });

  it("rejects a raiderInterception basis point above 10_000", () => {
    expect(
      decodeTradeProtectionRules(
        rules({ raiderInterception: { ...interception, scuttleShareBp: 10_001 } }),
      ),
    ).toMatchObject({ ok: false, field: "raiderInterception.scuttleShareBp" });
  });

  it("accepts the optional AMC surprise block and the interceptor cap, and keeps them absent otherwise", () => {
    const withBoth = {
      ...interception,
      amcSurprise: { chanceBp: 1500, startRangeM: 1200 },
      maxInterceptors: 4,
    };
    expect(decodeTradeProtectionRules(rules({ raiderInterception: withBoth }))).toEqual({
      ok: true,
      value: rules({ raiderInterception: withBoth }),
    });
    expect(decodeTradeProtectionRules(rules({ raiderInterception: interception }))).toMatchObject({
      ok: true,
    });
  });

  it.each([
    ["chanceBp", { chanceBp: 10_001, startRangeM: 1200 }],
    ["startRangeM", { chanceBp: 1500, startRangeM: 50 }],
    ["startRangeM", { chanceBp: 1500, startRangeM: 20_001 }],
  ])("rejects an out-of-range AMC surprise %s", (key, amcSurprise) => {
    expect(
      decodeTradeProtectionRules(rules({ raiderInterception: { ...interception, amcSurprise } })),
    ).toMatchObject({ ok: false, field: `raiderInterception.amcSurprise.${key}` });
  });

  it("rejects an AMC surprise block missing a key", () => {
    expect(
      decodeTradeProtectionRules(
        rules({ raiderInterception: { ...interception, amcSurprise: { chanceBp: 1500 } } }),
      ),
    ).toMatchObject({ ok: false, field: "raiderInterception.amcSurprise.startRangeM" });
  });

  it.each([
    "fleetShareBp",
    "resourcesPerRequiredShip",
    "contributingHullTypes",
    "raiderHullTypes",
    "amcHullType",
    "amcMinSpeedUms",
    "raiderHitBp",
    "shortfallAmplifyBp",
    "lossPerHitBp",
    "pressureChanceBp",
    "pressureLossBp",
    "recoveryBpPerMonth",
    "revenueSensitivityBp",
    "unrestThresholdBp",
    "unrestCadenceMonths",
    "unrestStep",
    "provenance",
  ])("requires %s with no default", (key) => {
    const { [key]: _removed, ...partial } = rules();
    const decoded = decodeTradeProtectionRules(partial);
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) expect(decoded.field).toContain(key);
  });

  it("accepts the optional submarineThreat and shortfallPrestige blocks", () => {
    const overrides = { submarineThreat: submarine, shortfallPrestige: prestige };
    expect(decodeTradeProtectionRules(rules(overrides))).toEqual({
      ok: true,
      value: rules(overrides),
    });
  });

  it("accepts an optional anti-submarine escort reduction and keeps it absent otherwise", () => {
    const withReduction = { submarineThreat: { ...submarine, aswEscortReductionBp: 2000 } };
    expect(decodeTradeProtectionRules(rules(withReduction))).toEqual({
      ok: true,
      value: rules(withReduction),
    });
    const decoded = decodeTradeProtectionRules(rules({ submarineThreat: submarine }));
    expect(decoded.ok && decoded.value.submarineThreat).toEqual(submarine);
  });

  it.each([0, 10_001, 1.5])("rejects an anti-submarine escort reduction of %s", (value) => {
    const override = { submarineThreat: { ...submarine, aswEscortReductionBp: value } };
    expect(decodeTradeProtectionRules(rules(override))).toMatchObject({
      ok: false,
      field: "submarineThreat.aswEscortReductionBp",
    });
  });

  it("accepts an optional Q-ship reduction", () => {
    const withReduction = { submarineThreat: { ...submarine, qShipReductionBp: 1000 } };
    expect(decodeTradeProtectionRules(rules(withReduction))).toEqual({
      ok: true,
      value: rules(withReduction),
    });
  });

  it.each([0, 10_001, 1.5])("rejects a Q-ship reduction of %s", (value) => {
    const override = { submarineThreat: { ...submarine, qShipReductionBp: value } };
    expect(decodeTradeProtectionRules(rules(override))).toMatchObject({
      ok: false,
      field: "submarineThreat.qShipReductionBp",
    });
  });

  it("accepts an optional unrestricted warfare block", () => {
    const withBlock = {
      submarineThreat: {
        ...submarine,
        unrestricted: { chanceMultiplierBp: 20_000, incidentBp: 2000 },
      },
    };
    expect(decodeTradeProtectionRules(rules(withBlock))).toEqual({
      ok: true,
      value: rules(withBlock),
    });
  });

  it.each([
    ["chanceMultiplierBp", 9999],
    ["chanceMultiplierBp", 100_001],
    ["chanceMultiplierBp", 15_000.5],
    ["incidentBp", 0],
    ["incidentBp", 10_001],
  ])("rejects an unrestricted %s of %s", (key, value) => {
    const block = { chanceMultiplierBp: 20_000, incidentBp: 2000, [key]: value };
    expect(
      decodeTradeProtectionRules(rules({ submarineThreat: { ...submarine, unrestricted: block } })),
    ).toMatchObject({ ok: false, field: `submarineThreat.unrestricted.${key}` });
  });

  it("accepts an unrestricted block with an optional neutralEntryBp and rejects out-of-range values", () => {
    const block = { chanceMultiplierBp: 20_000, incidentBp: 2000, neutralEntryBp: 2500 };
    const withEntry = { submarineThreat: { ...submarine, unrestricted: block } };
    expect(decodeTradeProtectionRules(rules(withEntry))).toEqual({
      ok: true,
      value: rules(withEntry),
    });
    for (const neutralEntryBp of [0, 10_001, 2500.5]) {
      expect(
        decodeTradeProtectionRules(
          rules({
            submarineThreat: { ...submarine, unrestricted: { ...block, neutralEntryBp } },
          }),
        ),
      ).toMatchObject({ ok: false, field: "submarineThreat.unrestricted.neutralEntryBp" });
    }
  });

  it("accepts an optional fleet support block and keeps it through decoding", () => {
    for (const block of [
      { chanceMultiplierBp: 4000, quotaMultiplierBp: 4000 },
      { chanceMultiplierBp: 0, quotaMultiplierBp: 10_000 },
    ]) {
      const withBlock = { submarineThreat: { ...submarine, fleetSupport: block } };
      expect(decodeTradeProtectionRules(rules(withBlock))).toEqual({
        ok: true,
        value: rules(withBlock),
      });
    }
  });

  it.each([
    ["chanceMultiplierBp", -1],
    ["chanceMultiplierBp", 10_001],
    ["chanceMultiplierBp", 4000.5],
    ["quotaMultiplierBp", -1],
    ["quotaMultiplierBp", 10_001],
  ])("rejects a fleet support %s of %s", (key, value) => {
    const block = { chanceMultiplierBp: 4000, quotaMultiplierBp: 4000, [key]: value };
    expect(
      decodeTradeProtectionRules(rules({ submarineThreat: { ...submarine, fleetSupport: block } })),
    ).toMatchObject({ ok: false, field: `submarineThreat.fleetSupport.${key}` });
  });

  it("keeps the quota multiplier optional and requires the chance multiplier", () => {
    const chanceOnly = {
      submarineThreat: { ...submarine, fleetSupport: { chanceMultiplierBp: 2500 } },
    };
    expect(decodeTradeProtectionRules(rules(chanceOnly))).toEqual({
      ok: true,
      value: rules(chanceOnly),
    });
    expect(
      decodeTradeProtectionRules(
        rules({
          submarineThreat: { ...submarine, fleetSupport: { quotaMultiplierBp: 4000 } },
        }),
      ),
    ).toMatchObject({ ok: false, field: "submarineThreat.fleetSupport.chanceMultiplierBp" });
  });

  it("rejects an unrestricted block missing a key", () => {
    expect(
      decodeTradeProtectionRules(
        rules({
          submarineThreat: { ...submarine, unrestricted: { chanceMultiplierBp: 20_000 } },
        }),
      ),
    ).toMatchObject({ ok: false, field: "submarineThreat.unrestricted.incidentBp" });
  });

  it.each(Object.keys(submarine))("rejects a submarineThreat block missing %s", (key) => {
    const { [key]: _removed, ...rest } = submarine as Record<string, unknown>;
    expect(decodeTradeProtectionRules(rules({ submarineThreat: rest }))).toMatchObject({
      ok: false,
      field: `submarineThreat.${key}`,
    });
  });

  it.each(Object.keys(prestige))("rejects a shortfallPrestige block missing %s", (key) => {
    const { [key]: _removed, ...rest } = prestige as Record<string, unknown>;
    expect(decodeTradeProtectionRules(rules({ shortfallPrestige: rest }))).toMatchObject({
      ok: false,
      field: `shortfallPrestige.${key}`,
    });
  });

  it.each([
    ["an empty submarine hull", { submarineThreat: { ...submarine, hullType: "" } }],
    ["a submarine attack of zero", { submarineThreat: { ...submarine, attackBp: 0 } }],
    [
      "a blockade reduction above 10000",
      { submarineThreat: { ...submarine, blockadeReductionBp: 10_001 } },
    ],
    ["a prestige loss above 10000", { shortfallPrestige: { ...prestige, lossBp: 10_001 } }],
  ])("rejects %s", (_label, override) => {
    expect(decodeTradeProtectionRules(rules(override)).ok).toBe(false);
  });

  it("rejects an excess key", () => {
    expect(decodeTradeProtectionRules(rules({ extra: 1 })).ok).toBe(false);
  });

  it.each([
    ["a wrong section version", { sectionVersion: 2 }],
    ["a basis-point value of zero", { raiderHitBp: 0 }],
    ["a basis-point value above 10000", { lossPerHitBp: 10_001 }],
    ["a non-integer basis-point value", { fleetShareBp: 10.5 }],
    ["a non-positive resources per ship", { resourcesPerRequiredShip: 0 }],
    ["a non-positive AMC speed floor", { amcMinSpeedUms: 0 }],
    ["an empty contributing hull list", { contributingHullTypes: [] }],
    ["an empty contributing hull string", { contributingHullTypes: ["destroyer", ""] }],
    ["an empty raider hull string", { raiderHullTypes: [""] }],
    ["an empty AMC hull string", { amcHullType: "" }],
    ["a duplicate raider hull", { raiderHullTypes: ["protected_cruiser", "protected_cruiser"] }],
    ["an unrest cadence of zero", { unrestCadenceMonths: 0 }],
    ["an unrest cadence above 24", { unrestCadenceMonths: 25 }],
    ["an unrest step above 10", { unrestStep: 11 }],
  ])("rejects %s", (_label, override) => {
    expect(decodeTradeProtectionRules(rules(override)).ok).toBe(false);
  });
});

const warshipAttack = {
  attackBp: 250,
  policyMultiplierBp: { FLEET_SUPPORT: 16_000, PRIZE_RULES: 10_000, UNRESTRICTED: 5000 },
  screenReductionBp: 7000,
  sunkBp: 1000,
  maxDamageBp: 4000,
  heavyHullTypes: ["dreadnought", "pre_dreadnought"],
  screenHullTypes: ["destroyer"],
};

const withWarship = (block: unknown) =>
  rules({ submarineThreat: { ...submarine, warshipAttack: block } });

describe("submarine warship attack block (#1158)", () => {
  it("keeps the block absent without it and decodes a complete block unchanged", () => {
    expect(decodeTradeProtectionRules(rules({ submarineThreat: submarine }))).toEqual({
      ok: true,
      value: rules({ submarineThreat: submarine }),
    });
    expect(decodeTradeProtectionRules(withWarship(warshipAttack))).toEqual({
      ok: true,
      value: withWarship(warshipAttack),
    });
  });

  it.each([
    ["extra", 1, "extra"],
    ["attackBp", -1, "attackBp"],
    ["attackBp", 10_001, "attackBp"],
    ["sunkBp", 2500.5, "sunkBp"],
    ["maxDamageBp", 10_001, "maxDamageBp"],
    ["screenReductionBp", -5, "screenReductionBp"],
    ["heavyHullTypes", [], "heavyHullTypes"],
    ["screenHullTypes", [], "screenHullTypes"],
    ["heavyHullTypes", ["dreadnought", "dreadnought"], "heavyHullTypes"],
  ])("rejects %s of %j", (key, value, field) => {
    const result = decodeTradeProtectionRules(withWarship({ ...warshipAttack, [key]: value }));
    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.field).toContain(field);
  });

  it("rejects a missing policy multiplier and an unknown policy", () => {
    expect(
      decodeTradeProtectionRules(
        withWarship({
          ...warshipAttack,
          policyMultiplierBp: { FLEET_SUPPORT: 1, PRIZE_RULES: 1 },
        }),
      ),
    ).toMatchObject({
      ok: false,
      field: "submarineThreat.warshipAttack.policyMultiplierBp.UNRESTRICTED",
    });
    expect(
      decodeTradeProtectionRules(
        withWarship({
          ...warshipAttack,
          policyMultiplierBp: { ...warshipAttack.policyMultiplierBp, BLOCKADE: 1 },
        }),
      ).ok,
    ).toBe(false);
  });
});
