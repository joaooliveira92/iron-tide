import { describe, expect, it } from "vite-plus/test";

import {
  NationalCurrencyConfigurationSchema,
  isValidNationalCurrencyConfiguration,
  validateNationalCurrencyConfiguration,
  type NationalCurrencyConfiguration,
} from "../src/index.js";
import { decodeOk } from "./decode-helpers.js";

const VALID: NationalCurrencyConfiguration = {
  id: "gbr-gbp",
  nationId: "uk",
  displayName: "Pounds sterling",
  symbol: "£",
  symbolPosition: "prefix",
  spacing: false,
  decimals: 0,
  grouping: true,
  negatives: "minus",
  scale: null,
  period: { fromYear: 1880, toYear: 1939 },
  source: "Bank of England historical statistics, 1880-1939",
  interpretation: "relabel",
};

function reasons(config: NationalCurrencyConfiguration): readonly string[] {
  return validateNationalCurrencyConfiguration(config).map((diagnostic) => diagnostic.reason);
}

describe("national currency configuration schema (U-3 ticket 04)", () => {
  it("decodes a valid configuration strictly", () => {
    expect(decodeOk(NationalCurrencyConfigurationSchema, VALID)).toBe(true);
  });

  it("rejects an excess key and a non-integer (floating-point) scale", () => {
    expect(decodeOk(NationalCurrencyConfigurationSchema, { ...VALID, extra: 1 })).toBe(false);
    expect(
      decodeOk(NationalCurrencyConfigurationSchema, {
        ...VALID,
        interpretation: "transform",
        scale: { numerator: 1.5, denominator: 1 },
      }),
    ).toBe(false);
  });
});

describe("national currency production validation (U-3 ticket 04)", () => {
  it("accepts a sourced, unambiguous configuration", () => {
    expect(isValidNationalCurrencyConfiguration(VALID)).toBe(true);
  });

  it("rejects each unsafe class", () => {
    expect(reasons({ ...VALID, id: "" })).toContain("unidentified");
    expect(reasons({ ...VALID, displayName: "" })).toContain("symbol-only");
    expect(reasons({ ...VALID, source: "" })).toContain("unsourced");
    expect(reasons({ ...VALID, symbol: "£ 1" })).toContain("locale-conflicting");
    expect(reasons({ ...VALID, scale: { numerator: 25, denominator: 1 } })).toContain(
      "economy-altering",
    );
    expect(reasons({ ...VALID, interpretation: "transform", scale: null })).toContain(
      "economy-altering",
    );
  });
});
