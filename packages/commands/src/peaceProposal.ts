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

export class PeaceTermMalformed extends Data.TaggedError("PeaceTermMalformed")<{
  readonly termTag: string;
}> {}

export class PeaceAreaNotOwned extends Data.TaggedError("PeaceAreaNotOwned")<{
  readonly areaId: string;
  readonly nationId: string;
}> {}

export class PeaceAreaIsHome extends Data.TaggedError("PeaceAreaIsHome")<{
  readonly areaId: string;
  readonly nationId: string;
}> {}

export class PeaceAreaUnpriced extends Data.TaggedError("PeaceAreaUnpriced")<{
  readonly areaId: string;
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
  | PeaceTermMalformed
  | PeaceAreaNotOwned
  | PeaceAreaIsHome
  | PeaceAreaUnpriced
  | PeaceTermOverBudget;

export type UncheckedProposePeace = Omit<ProposePeaceCommand, "term"> & {
  readonly term: { readonly _tag: string; readonly areaId?: unknown };
};

export type PeaceCheckSnapshot = Pick<CampaignSnapshot, "wars" | "world" | "nations">;

type WorldAreas = Pick<CampaignSnapshot["world"], "areas">;

export function peaceTermCost(
  term: PeaceTerm,
  world: WorldAreas,
): Result.Result<number, PeaceAreaUnpriced> {
  switch (term._tag) {
    case "StatusQuo":
      return Result.succeed(0);
    case "CedeArea": {
      const cost = world.areas.find((a) => a.id === term.areaId)?.cessionCost;
      if (cost === undefined) return Result.fail(new PeaceAreaUnpriced({ areaId: term.areaId }));
      return Result.succeed(cost);
    }
  }
}

export function checkPeaceBudget(
  cost: number,
  budget: number,
): Result.Result<void, PeaceTermOverBudget> {
  if (cost > budget) return Result.fail(new PeaceTermOverBudget({ cost, budget }));
  return Result.succeed(undefined);
}

function readTerm(
  term: UncheckedProposePeace["term"],
): Result.Result<PeaceTerm, ProposePeaceFailure> {
  switch (term._tag) {
    case "StatusQuo":
      return Result.succeed({ _tag: "StatusQuo" });
    case "CedeArea":
      if (typeof term.areaId !== "string" || term.areaId.length === 0)
        return Result.fail(new PeaceTermMalformed({ termTag: term._tag }));
      return Result.succeed({ _tag: "CedeArea", areaId: term.areaId });
    default:
      return Result.fail(new PeaceTermUnsupported({ termTag: term._tag }));
  }
}

export function checkCedeArea(
  snapshot: Pick<CampaignSnapshot, "world" | "nations">,
  loserId: string,
  areaId: string,
): Result.Result<void, PeaceAreaNotOwned | PeaceAreaIsHome> {
  const area = snapshot.world.areas.find((a) => a.id === areaId);
  const heldByOthers = (snapshot.world.possessions ?? []).some(
    (p) => p.areaId === areaId && p.nationId !== loserId,
  );
  if (area === undefined || area.controller !== loserId || heldByOthers)
    return Result.fail(new PeaceAreaNotOwned({ areaId, nationId: loserId }));
  if (snapshot.nations.get(loserId)?.homeAreaId === areaId)
    return Result.fail(new PeaceAreaIsHome({ areaId, nationId: loserId }));
  return Result.succeed(undefined);
}

export interface PeaceCessionOption {
  readonly areaId: string;
  readonly name: string;
  readonly cost: number;
}

export function peaceCessionOptions(
  snapshot: PeaceCheckSnapshot,
  warId: string,
  nationId: string,
): readonly PeaceCessionOption[] {
  const war = snapshot.wars.wars.find((w) => w.id === warId);
  if (war === undefined || war.status !== "ACTIVE") return [];
  const isAttacker = war.attackerId === nationId;
  if (!isAttacker && war.defenderId !== nationId) return [];
  const loserId = isAttacker ? war.defenderId : war.attackerId;
  const options: PeaceCessionOption[] = [];
  for (const area of snapshot.world.areas) {
    if (Result.isFailure(checkCedeArea(snapshot, loserId, area.id))) continue;
    const cost = peaceTermCost({ _tag: "CedeArea", areaId: area.id }, snapshot.world);
    if (Result.isFailure(cost)) continue;
    options.push({ areaId: area.id, name: area.name, cost: cost.success });
  }
  return options;
}

export function checkProposePeace(
  snapshot: PeaceCheckSnapshot,
  body: UncheckedProposePeace,
): Result.Result<PeaceTerm, ProposePeaceFailure> {
  const war = snapshot.wars.wars.find((w) => w.id === body.warId);
  if (!war) return Result.fail(new PeaceWarNotFound({ warId: body.warId }));
  if (war.status !== "ACTIVE") return Result.fail(new PeaceWarNotActive({ warId: body.warId }));
  const isAttacker = war.attackerId === body.nationId;
  const isDefender = war.defenderId === body.nationId;
  if (!isAttacker && !isDefender)
    return Result.fail(new PeaceCallerNotPrincipal({ warId: body.warId, nationId: body.nationId }));
  const read = readTerm(body.term);
  if (Result.isFailure(read)) return Result.fail(read.failure);
  const term = read.success;
  if (term._tag === "CedeArea") {
    const loserId = isAttacker ? war.defenderId : war.attackerId;
    const owned = checkCedeArea(snapshot, loserId, term.areaId);
    if (Result.isFailure(owned)) return Result.fail(owned.failure);
  }
  const cost = peaceTermCost(term, snapshot.world);
  if (Result.isFailure(cost)) return Result.fail(cost.failure);
  const budget = isAttacker ? war.attackerWarScore : war.defenderWarScore;
  const withinBudget = checkPeaceBudget(cost.success, budget);
  if (Result.isFailure(withinBudget)) return Result.fail(withinBudget.failure);
  return Result.succeed(term);
}
