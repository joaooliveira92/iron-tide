import { describe, it, expect } from "vite-plus/test";
import { balanceRows } from "../src/index.js";
import { formatBalanceTable } from "./support/balanceTable.js";
import { ctx, draft, costBalance, cveBalance } from "./fixtures/gunboat.js";

describe("balance report", () => {
  const rows = balanceRows(
    [
      { name: "gunboat", draft },
      {
        name: "overweight",
        draft: { ...draft, machinery: { ...draft.machinery, fuelCapacityKg: 400_000 } },
      },
    ],
    ctx,
    costBalance,
    { maturityBpByTech: {}, firstOfClass: false },
    cveBalance,
  );
  it("has one row per design with shares that fit in the displacement", () => {
    expect(rows).toHaveLength(2);
    const g = rows[0]!;
    expect(g.valid).toBe(true);
    expect(
      g.hullShareBp + g.machineryShareBp + g.fuelShareBp + g.armourShareBp + g.armamentShareBp,
    ).toBeLessThanOrEqual(10_000);
    expect(rows[1]!.valid).toBe(false);
    expect(rows[1]!.blocking).toBeGreaterThan(0);
  });
  it("formats a table that labels the dev metric", () => {
    const t = formatBalanceTable(rows);
    expect(t).toContain("gunboat");
    expect(t).toContain("overweight");
    expect(t).toContain("DEV METRIC: not a combat result");
    expect(t.split("\n").length).toBe(5);
  });
});
