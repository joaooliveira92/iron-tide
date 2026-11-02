import type { CampaignSnapshot } from "@bluewave/campaign";
import { Data, Result } from "effect";
import type { PeaceTerm, ProposePeaceCommand } from "./envelope.js";

export class PeaceWarNotFound extends Data.TaggedError("PeaceWarNotFound")<{
  readonly warId: string;
}> {}

export class PeaceWarNotActive extends Data.TaggedError("PeaceWarNotActive")<{
  readonly warId: string;
}> {}

export class PeaceCallerNotPrincipal extends Data.TaggedError("PeaceCallerNotPrincipal")<{
  readonly warId: string;
  readonly nationId: string;
}> {}

export class PeaceTermUnsupported extends Data.TaggedError("PeaceTermUnsupported")<{
  readonly termTag: string;
}> {}

export class PeaceTermOverBudget extends Data.TaggedError("PeaceTermOverBudget")<{
  readonly cost: number;
  readonly budget: number;
}> {}

export type ProposePeaceFailure =
  | PeaceWarNotFound
  | PeaceWarNotActive
  | PeaceCallerNotPrincipal
  | PeaceTermUnsupported
  | PeaceTermOverBudget;

export type UncheckedProposePeace = Omit<ProposePeaceCommand, "term"> & {
  readonly term: { readonly _tag: string };
};

export function peaceTermCost(term: PeaceTerm): number {
  switch (term._tag) {
    case "StatusQuo":
      return 0;
  }
}

export function checkPeaceBudget(
  cost: number,
  budget: number,
): Result.Result<void, PeaceTermOverBudget> {
  if (cost > budget) return Result.fail(new PeaceTermOverBudget({ cost, budget }));
  return Result.succeed(undefined);
}

function isSupportedTerm(term: { readonly _tag: string }): term is PeaceTerm {
  return term._tag === "StatusQuo";
}

export function checkProposePeace(
  snapshot: Pick<CampaignSnapshot, "wars">,
  body: UncheckedProposePeace,
): Result.Result<PeaceTerm, ProposePeaceFailure> {
  const war = snapshot.wars.wars.find((w) => w.id === body.warId);
  if (!war) return Result.fail(new PeaceWarNotFound({ warId: body.warId }));
  if (war.status !== "ACTIVE") return Result.fail(new PeaceWarNotActive({ warId: body.warId }));
  const isAttacker = war.attackerId === body.nationId;
  const isDefender = war.defenderId === body.nationId;
  if (!isAttacker && !isDefender)
    return Result.fail(new PeaceCallerNotPrincipal({ warId: body.warId, nationId: body.nationId }));
  if (!isSupportedTerm(body.term))
    return Result.fail(new PeaceTermUnsupported({ termTag: body.term._tag }));
  const budget = isAttacker ? war.attackerWarScore : war.defenderWarScore;
  const withinBudget = checkPeaceBudget(peaceTermCost(body.term), budget);
  if (Result.isFailure(withinBudget)) return Result.fail(withinBudget.failure);
  return Result.succeed(body.term);
}
