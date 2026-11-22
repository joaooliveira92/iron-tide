import { Result, Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { MonthlyReportsSchema } from "../shared/monthly-reports-schemas.js";
import { VALID_MONTHLY_REPORT } from "./monthlyReportFixtures.js";

const decodes = (extra: Record<string, unknown>): boolean =>
  Result.isSuccess(
    Schema.decodeUnknownResult(MonthlyReportsSchema, { onExcessProperty: "error" })({
      reports: [{ ...VALID_MONTHLY_REPORT, ...extra }],
    }),
  );

const row = {
  nationId: "france",
  governmentBefore: "autocratic",
  governmentAfter: "communist",
};

describe("MonthlyReportsSchema foreign revolutions (#1087)", () => {
  it("still decodes a report stored before revolutions were listed", () => {
    expect(decodes({})).toBe(true);
  });

  it("accepts the additive revolution list", () => {
    expect(decodes({ foreignRevolutions: [row] })).toBe(true);
  });

  it("rejects an empty government and an unknown field", () => {
    expect(decodes({ foreignRevolutions: [{ ...row, governmentAfter: "" }] })).toBe(false);
    expect(decodes({ foreignRevolutions: [{ ...row, cause: "war" }] })).toBe(false);
  });
});
