import { describe, expect, it } from "vite-plus/test";
import { preservationCostPerMonthMicro, type ConstructionBalance } from "../src/index.js";
import { constructionBalance as productionBalance } from "./helpers/earlyContext.js";

const withBase = (over: Partial<ConstructionBalance>): ConstructionBalance => ({
  ...productionBalance,
  ...over,
});

describe("preservationCostPerMonthMicro (SB3-R5, DESIGN-23 section 7)", () => {
  it("charges exactly half the mothballed maintenance, floored to whole micro-units", () => {
    expect(
      preservationCostPerMonthMicro(
        withBase({ mothballedMaintenancePerMonthMicro: 1, preservationCostBp: 5_000 }),
      ),
    ).toBe(0);
    expect(
      preservationCostPerMonthMicro(
        withBase({ mothballedMaintenancePerMonthMicro: 3, preservationCostBp: 5_000 }),
      ),
    ).toBe(1);
    expect(
      preservationCostPerMonthMicro(
        withBase({ mothballedMaintenancePerMonthMicro: 100, preservationCostBp: 5_000 }),
      ),
    ).toBe(50);
  });

  it("is zero when no base is authored, and always a safe integer", () => {
    expect(
      preservationCostPerMonthMicro(
        withBase({ mothballedMaintenancePerMonthMicro: 0, preservationCostBp: 5_000 }),
      ),
    ).toBe(0);
    const value = preservationCostPerMonthMicro(productionBalance);
    expect(Number.isSafeInteger(value)).toBe(true);
    expect(value).toBe(Math.floor(productionBalance.mothballedMaintenancePerMonthMicro / 2));
  });

  it("carries the manual's half rule and a placeholder base in the production balance", () => {
    expect(productionBalance.preservationCostBp).toBe(5_000);
    expect(productionBalance.mothballedMaintenancePerMonthMicro).toBeGreaterThan(0);
  });
});
