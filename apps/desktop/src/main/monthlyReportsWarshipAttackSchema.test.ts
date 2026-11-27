import { Result, Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { MonthlyReportsSchema } from "../shared/monthly-reports-schemas.js";
import { VALID_MONTHLY_REPORT } from "./monthlyReportFixtures.js";

const decodes = (warshipAttacks: readonly unknown[] | undefined): boolean =>
  Result.isSuccess(
    Schema.decodeUnknownResult(MonthlyReportsSchema, { onExcessProperty: "error" })({
      reports: [
        {
          ...VALID_MONTHLY_REPORT,
          tradeProtection: {
            quota: 0,
            assigned: 0,
            shortfall: 0,
            shortfallBp: 0,
            ...(warshipAttacks === undefined ? {} : { warshipAttacks }),
          },
        },
      ],
    }),
  );

const damaged = {
  nationId: "germany",
  boatId: "germany-u1",
  victimShipId: "uk-bb1",
  outcome: "DAMAGED",
  damageBp: 2_500,
};

describe("MonthlyReportsSchema warship attack entries", () => {
  it("decodes a trade-protection report without the field", () => {
    expect(decodes(undefined)).toBe(true);
  });

  it("decodes a trade-protection report with damaged and sunk attacks", () => {
    expect(
      decodes([
        damaged,
        { ...damaged, victimShipId: "uk-cr1", outcome: "SUNK", damageBp: 10_000 },
        { ...damaged, victimShipName: "HMS Lion" },
      ]),
    ).toBe(true);
  });

  it("accepts an empty list", () => {
    expect(decodes([])).toBe(true);
  });

  it("rejects an unknown outcome, an empty id and an unknown field", () => {
    expect(decodes([{ ...damaged, outcome: "ESCAPED" }])).toBe(false);
    expect(decodes([{ ...damaged, victimShipId: "" }])).toBe(false);
    expect(decodes([{ ...damaged, areaId: "north-sea" }])).toBe(false);
  });

  it("rejects a negative damage value", () => {
    expect(decodes([{ ...damaged, damageBp: -1 }])).toBe(false);
  });
});
