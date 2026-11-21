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

describe("decodeTradeProtectionRules", () => {
  it("accepts a complete section", () => {
    expect(decodeTradeProtectionRules(rules())).toEqual({ ok: true, value: rules() });
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
