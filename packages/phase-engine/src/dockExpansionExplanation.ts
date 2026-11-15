import {
  dockExpansionInstalmentUnits,
  dockExpansionTotalUnits,
  type ConstructionProject,
} from "@bluewave/campaign";
import { ExplanationBuilder, type ExplanationTree } from "@bluewave/events";

export const DOCK_EXPANSION_PRICE_FORMULA_ID = "dock_expansion_price" as const;
export const DOCK_EXPANSION_INSTALMENT_FORMULA_ID = "dock_expansion_instalment" as const;

const PRICE_VERSION = "dock_expansion_price_v1";
const INSTALMENT_VERSION = "dock_expansion_instalment_v1";
const SOURCE = { kind: "code", ref: "packages/campaign/src/dockExpansionFunding.ts" } as const;

function leaf(formulaId: string, version: string, value: number, unit: string): ExplanationTree {
  return new ExplanationBuilder(formulaId, version)
    .withInput("amount", value)
    .withResult(value)
    .withUnit(unit)
    .withSource(SOURCE)
    .build();
}

export function dockExpansionPriceExplanation(project: ConstructionProject): ExplanationTree {
  const price = dockExpansionTotalUnits(project);
  return new ExplanationBuilder(DOCK_EXPANSION_PRICE_FORMULA_ID, PRICE_VERSION)
    .withInput("workUnits", price)
    .withResult(price)
    .withUnit("treasury")
    .withOperation("identity")
    .withSource(SOURCE)
    .addChild(leaf("dock_expansion_price.work", PRICE_VERSION, price, "treasury"))
    .build();
}

export function dockExpansionInstalmentExplanation(project: ConstructionProject): ExplanationTree {
  const price = dockExpansionTotalUnits(project);
  const months = project["dockExpansionDurationMonths"] ?? 1;
  return new ExplanationBuilder(DOCK_EXPANSION_INSTALMENT_FORMULA_ID, INSTALMENT_VERSION)
    .withInput("price", price)
    .withInput("months", months)
    .withResult(dockExpansionInstalmentUnits(project))
    .withUnit("treasury")
    .withOperation("divide")
    .withSource(SOURCE)
    .addChild(leaf("dock_expansion_instalment.price", INSTALMENT_VERSION, price, "treasury"))
    .addChild(leaf("dock_expansion_instalment.months", INSTALMENT_VERSION, months, "months"))
    .build();
}
