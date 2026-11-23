import { colonyIncomeForNation } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { budgetChangedEvent, makeLedgerEntry } from "./events.js";
import type { PhaseContext } from "./pipeline.js";

export const COLONY_INCOME_CATEGORY = "COLONY_INCOME" as const;

export function creditColonyIncome(ctx: PhaseContext, nationId: string): void {
  const rules = ctx.engineOptions?.colonyIncome;
  if (rules === undefined) return;
  const nations = ctx.snapshot.read("nations");
  const nation = nations.get(nationId);
  if (nation === undefined) return;
  const step = colonyIncomeForNation(
    rules,
    ctx.snapshot.read("world").possessions ?? [],
    nationId,
    nation["baseResources"] ?? SafeInt(0),
    ctx.campaignMonth,
  );
  if (step === undefined) return;

  const previousBalance = nation["treasury"];
  const newBalance = SafeInt.add(previousBalance, step.amount);
  const updated = new Map(nations);
  updated.set(nationId, { ...nation, treasury: newBalance });
  ctx.snapshot.write("nations", updated);

  const reason = "Colony and possession income";
  ctx.financialLedger.append(
    makeLedgerEntry(
      nationId,
      "monthly_revenue",
      COLONY_INCOME_CATEGORY,
      step.amount,
      step.amount,
      previousBalance,
      newBalance,
      reason,
      ctx.campaignMonth,
    ),
  );
  ctx.eventLedger.append(
    budgetChangedEvent(
      nationId,
      previousBalance,
      newBalance,
      step.amount,
      reason,
      ctx.nextSeq(),
      ctx.campaignMonth,
    ),
  );
}
