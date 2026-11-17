import { describe, expect, it } from "vite-plus/test";
import { decodeFleetMoraleRules } from "../src/index.js";

const provenance = {
  sourceStatus: "BALANCE_TARGET",
  confidence: "LOW",
  kind: "balance_adjustment",
  sources: [],
  note: "PROVISIONAL fleet morale coefficients",
};

function rules(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sectionVersion: 1,
    unpaidFundsLoss: 10,
    blockadeCrampedLoss: 5,
    longWarMonths: 12,
    recoveryPerMonth: 3,
    provenance,
    ...overrides,
  };
}

describe("decodeFleetMoraleRules", () => {
  it("accepts a complete section", () => {
    expect(decodeFleetMoraleRules(rules()).ok).toBe(true);
  });

  it.each([
    "unpaidFundsLoss",
    "blockadeCrampedLoss",
    "longWarMonths",
    "recoveryPerMonth",
    "provenance",
  ])("requires %s with no default", (key) => {
    const { [key]: _removed, ...partial } = rules();
    const decoded = decodeFleetMoraleRules(partial);
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) expect(decoded.field).toContain(key);
  });

  it("rejects an excess key", () => {
    expect(decodeFleetMoraleRules(rules({ extra: 1 })).ok).toBe(false);
  });

  it.each([
    ["a fractional loss", { unpaidFundsLoss: 1.5 }],
    ["a zero loss", { blockadeCrampedLoss: 0 }],
    ["a loss above the scale", { unpaidFundsLoss: 101 }],
    ["a zero recovery", { recoveryPerMonth: 0 }],
    ["a zero long war threshold", { longWarMonths: 0 }],
    ["an unknown section version", { sectionVersion: 2 }],
  ])("rejects %s", (_name, override) => {
    expect(decodeFleetMoraleRules(rules(override)).ok).toBe(false);
  });
});
