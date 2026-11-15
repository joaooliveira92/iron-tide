import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import {
  DOCK_EXPANSION_INSTALMENT_FORMULA_ID,
  DOCK_EXPANSION_PRICE_FORMULA_ID,
  dockExpansionInstalmentExplanation,
  dockExpansionPriceExplanation,
} from "../src/dockExpansionExplanation.js";
import { authorizeDockExpansion } from "../src/dockExpansion.js";
import { MonthExecutor } from "../src/index.js";
import { snapshot } from "./helpers/constructionFixtures.js";

describe("dock expansion price and instalment explanations", () => {
  const authorised = (durationMultiplierBp?: number) => {
    const base = snapshot([], new Map(), 0, 1_000_000);
    const result = authorizeDockExpansion(base, {
      nationId: "GBR",
      possessionId: "gbr-home",
      campaignMonth: "1880-02",
      ...(durationMultiplierBp === undefined ? {} : { durationMultiplierBp }),
    });
    if (!result.ok) throw new Error("authorization failed");
    return result;
  };

  it("explains the price as the work units, one treasury unit each", () => {
    const { project } = authorised();
    const tree = dockExpansionPriceExplanation(project);
    expect(tree.formulaId).toBe(DOCK_EXPANSION_PRICE_FORMULA_ID);
    expect(Number(tree.result)).toBe(1_200);
    expect((tree.children ?? []).map((child) => child.formulaId)).toEqual([
      "dock_expansion_price.work",
    ]);
  });

  it("explains the instalment as the price over the duration, rounded up", () => {
    const { project } = authorised(7_500);
    const tree = dockExpansionInstalmentExplanation(project);
    expect(tree.formulaId).toBe(DOCK_EXPANSION_INSTALMENT_FORMULA_ID);
    expect(tree.operation).toBe("divide");
    expect((tree.children ?? []).map((child) => child.formulaId)).toEqual([
      "dock_expansion_instalment.price",
      "dock_expansion_instalment.months",
    ]);
    expect(Number(tree.result)).toBe(Math.ceil(1_200 / project.dockExpansionDurationMonths!));
  });

  it("matches what the monthly pipeline debits for the authorised project", () => {
    const result = authorised();
    const price = Number(dockExpansionPriceExplanation(result.project).result);
    const instalment = Number(dockExpansionInstalmentExplanation(result.project).result);
    let state = result.snapshot;
    const debits: number[] = [];
    for (let turn = 1; turn <= result.durationMonths; turn++) {
      const before = Number(state.nations.get("GBR")!.treasury);
      state = new MonthExecutor().execute(
        { ...state, turnNumber: SafeInt(turn) },
        [],
        "dock-explanation",
        new DiagnosticCollector(),
      ).finalSnapshot;
      debits.push(before - Number(state.nations.get("GBR")!.treasury));
    }
    expect(debits[0]).toBe(instalment);
    expect(debits.reduce((sum, debit) => sum + debit, 0)).toBe(price);
  });
});
