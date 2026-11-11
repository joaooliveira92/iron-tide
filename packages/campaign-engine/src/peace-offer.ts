import type { WarDeclaration } from "@bluewave/campaign";
import {
  peaceCessionOptions,
  type PeaceCessionOption,
  type PeaceCheckSnapshot,
} from "@bluewave/commands";
import { ExplanationBuilder, type ExplanationTree } from "@bluewave/events";

export const PEACE_FORMULA_VERSION = "peace_v1";

const UNIT_WAR_SCORE = "ws";
const BUDGET_SOURCE = {
  kind: "code",
  ref: "packages/campaign/src/state.ts WarDeclaration war score",
} as const;

export type DiplomacyPeaceTermRef =
  | { readonly _tag: "StatusQuo" }
  | { readonly _tag: "CedeArea"; readonly areaId: string };

export interface DiplomacyPeaceTerm {
  readonly term: DiplomacyPeaceTermRef;
  readonly label: string;
  readonly provisional: boolean;
  readonly affordable: boolean;
  readonly costExplanation: ExplanationTree;
  readonly remainingExplanation: ExplanationTree;
}

export interface DiplomacyPeaceOffer {
  readonly budgetExplanation: ExplanationTree;
  readonly terms: readonly DiplomacyPeaceTerm[];
}

export function explainPeaceBudget(warScore: number): ExplanationTree {
  const child = new ExplanationBuilder("peace_budget.war_score", PEACE_FORMULA_VERSION)
    .withInput("warScore", warScore)
    .withResult(warScore)
    .withUnit(UNIT_WAR_SCORE)
    .withSource(BUDGET_SOURCE)
    .build();
  return new ExplanationBuilder("peace_budget", PEACE_FORMULA_VERSION)
    .withInput("warScore", warScore)
    .withResult(warScore)
    .withUnit(UNIT_WAR_SCORE)
    .withOperation("identity")
    .withSource(BUDGET_SOURCE)
    .addChild(child)
    .build();
}

export function explainStatusQuoCost(): ExplanationTree {
  const child = new ExplanationBuilder("peace_cost.status_quo", PEACE_FORMULA_VERSION)
    .withResult(0)
    .withUnit(UNIT_WAR_SCORE)
    .withSource({ kind: "code", ref: "packages/commands/src/peaceProposal.ts peaceTermCost" })
    .build();
  return new ExplanationBuilder("peace_cost", PEACE_FORMULA_VERSION)
    .withResult(0)
    .withUnit(UNIT_WAR_SCORE)
    .withOperation("identity")
    .addChild(child)
    .build();
}

export function explainCessionCost(areaId: string, cost: number): ExplanationTree {
  const child = new ExplanationBuilder("peace_cost.area_price", PEACE_FORMULA_VERSION)
    .withInput("areaId", areaId)
    .withInput("sourceStatus", "PROVISIONAL")
    .withResult(cost)
    .withUnit(UNIT_WAR_SCORE)
    .withSource({ kind: "content", ref: `areas/${areaId}.cessionCost` })
    .build();
  return new ExplanationBuilder("peace_cost", PEACE_FORMULA_VERSION)
    .withInput("areaId", areaId)
    .withResult(cost)
    .withUnit(UNIT_WAR_SCORE)
    .withOperation("identity")
    .addChild(child)
    .build();
}

export function explainPeaceRemaining(budget: number, cost: number): ExplanationTree {
  const budgetChild = new ExplanationBuilder("peace_remaining.budget", PEACE_FORMULA_VERSION)
    .withResult(budget)
    .withUnit(UNIT_WAR_SCORE)
    .build();
  const costChild = new ExplanationBuilder("peace_remaining.cost", PEACE_FORMULA_VERSION)
    .withResult(cost)
    .withUnit(UNIT_WAR_SCORE)
    .build();
  return new ExplanationBuilder("peace_remaining", PEACE_FORMULA_VERSION)
    .withInput("budget", budget)
    .withInput("cost", cost)
    .withResult(budget - cost)
    .withUnit(UNIT_WAR_SCORE)
    .withOperation("subtract")
    .addChild(budgetChild)
    .addChild(costChild)
    .build();
}

function termOf(
  term: DiplomacyPeaceTermRef,
  label: string,
  provisional: boolean,
  budget: number,
  costExplanation: ExplanationTree,
): DiplomacyPeaceTerm {
  const cost = Number(costExplanation.result);
  return {
    term,
    label,
    provisional,
    affordable: cost <= budget,
    costExplanation,
    remainingExplanation: explainPeaceRemaining(budget, cost),
  };
}

export function buildPeaceOffer(
  snapshot: PeaceCheckSnapshot,
  war: WarDeclaration,
  playerNationId: string,
): DiplomacyPeaceOffer | undefined {
  if (war.status !== "ACTIVE") return undefined;
  const isAttacker = war.attackerId === playerNationId;
  if (!isAttacker && war.defenderId !== playerNationId) return undefined;
  const budget = isAttacker ? war.attackerWarScore : war.defenderWarScore;
  const cessions: readonly PeaceCessionOption[] = peaceCessionOptions(
    snapshot,
    war.id,
    playerNationId,
  );
  return {
    budgetExplanation: explainPeaceBudget(budget),
    terms: [
      termOf({ _tag: "StatusQuo" }, "Status quo", false, budget, explainStatusQuoCost()),
      ...cessions.map((option) =>
        termOf(
          { _tag: "CedeArea", areaId: option.areaId },
          option.name,
          true,
          budget,
          explainCessionCost(option.areaId, option.cost),
        ),
      ),
    ],
  };
}
