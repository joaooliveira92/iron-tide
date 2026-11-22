import { Result, Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { MonthlyReportsSchema } from "../shared/monthly-reports-schemas.js";
import { VALID_MONTHLY_REPORT } from "./monthlyReportFixtures.js";

const decodes = (raiders: readonly unknown[]): boolean =>
  Result.isSuccess(
    Schema.decodeUnknownResult(MonthlyReportsSchema, { onExcessProperty: "error" })({
      reports: [
        {
          ...VALID_MONTHLY_REPORT,
          tradeProtection: { quota: 0, assigned: 0, shortfall: 0, shortfallBp: 0, raiders },
        },
      ],
    }),
  );

describe("MonthlyReportsSchema raider entries (#1084)", () => {
  it("still decodes a raider stored before ships were named", () => {
    expect(decodes([{ shipId: "s1", event: "RELEASED" }])).toBe(true);
  });

  it("accepts the additive ship name", () => {
    expect(decodes([{ shipId: "s1", shipName: "HMS Lion", event: "RELEASED" }])).toBe(true);
  });

  it("rejects an empty ship name and an unknown field", () => {
    expect(decodes([{ shipId: "s1", shipName: "", event: "RELEASED" }])).toBe(false);
    expect(decodes([{ shipId: "s1", nickname: "Lion", event: "RELEASED" }])).toBe(false);
  });
});
