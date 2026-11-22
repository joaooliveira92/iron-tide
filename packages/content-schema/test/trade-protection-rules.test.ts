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
