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
  role: "DECLARER",
  otherNationId: "germany",
  warId: "war_uk_germany_1880-03",
  cause: "UNRESTRICTED_SUBMARINE_INCIDENTS",
  tension: 10,
};

describe("MonthlyReportsSchema neutral war entries (#1144)", () => {
  it("still decodes a report stored before neutral war entries were listed", () => {
    expect(decodes({})).toBe(true);
  });

  it("accepts the additive neutral war list for both roles", () => {
    expect(decodes({ neutralWars: [row, { ...row, role: "TARGET" }] })).toBe(true);
  });

  it("rejects an unknown role, cause, empty nation, negative tension and unknown field", () => {
    expect(decodes({ neutralWars: [{ ...row, role: "OBSERVER" }] })).toBe(false);
    expect(decodes({ neutralWars: [{ ...row, cause: "BORDER_INCIDENT" }] })).toBe(false);
    expect(decodes({ neutralWars: [{ ...row, otherNationId: "" }] })).toBe(false);
    expect(decodes({ neutralWars: [{ ...row, tension: -1 }] })).toBe(false);
    expect(decodes({ neutralWars: [{ ...row, month: "1880-03" }] })).toBe(false);
  });
});
