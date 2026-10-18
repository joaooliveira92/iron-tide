import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import {
  monthlyNetBeforeConstruction,
  monthlyRevenue,
  shipMonthlyMaintenanceCost,
} from "@bluewave/campaign";
import { compileProductionCampaign } from "./economy-scenarios.helper.js";

// Economy spec #138: golden worked examples from the shipped 1880 pack, read through the shared calculators.
describe("1880 production economy start state", () => {
  const { state, diagnostics } = compileProductionCampaign();

  function flows(nationId: string) {
    const nation = state.snapshot.nations.get(nationId)!;
    let maintenance = SafeInt.ZERO;
    for (const fleet of nation.fleets)
      for (const ship of fleet.ships)
        maintenance = SafeInt.add(
          maintenance,
          shipMonthlyMaintenanceCost(ship.hitPoints, ship.readiness, false),
        );
    const revenue = monthlyRevenue(nation.baseResources, nation.navalAppropriationRateBp);
    const research = nation.research.standingResearchBudget ?? SafeInt.ZERO;
    const net = monthlyNetBeforeConstruction({
      revenue,
      obligations: nation.expenses,
      maintenance,
      research,
    });
    return { revenue, maintenance, obligations: nation.expenses, research, net };
  }

  it("compiles with no error diagnostics", () => {
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  });

  it.each([
    ["uk", { revenue: 100, maintenance: 16, obligations: 38, research: 5, net: 41 }],
    ["france", { revenue: 68, maintenance: 12, obligations: 26, research: 4, net: 26 }],
    ["portugal", { revenue: 3, maintenance: 2, obligations: 2, research: 0, net: -1 }],
  ])("%s start flows match the locked model", (nationId, expected) => {
    expect(flows(nationId)).toEqual(expected);
  });

  it("derives revenue equal to authored income for every nation", () => {
    for (const nation of state.snapshot.nations.values())
      expect(monthlyRevenue(nation.baseResources, nation.navalAppropriationRateBp)).toBe(
        nation.income,
      );
  });

  it("leaves Portugal as the only structural deficit", () => {
    const deficits = [...state.snapshot.nations.keys()].filter(
      (id) => (flows(id).net as number) < 0,
    );
    expect(deficits).toEqual(["portugal"]);
  });
});
