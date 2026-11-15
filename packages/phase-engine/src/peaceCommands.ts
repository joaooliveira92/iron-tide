import { decidePeaceResponse } from "@bluewave/ai";
import type { AcceptPeaceCommand, PeaceTerm, ProposePeaceCommand } from "@bluewave/commands";
import { applyAcceptPeace, applyProposePeace, type PeaceTermSink } from "./diplomacy.js";
import type { PhaseContext } from "./pipeline.js";

export const PEACE_REFUSED = "PEACE_REFUSED" as const;

function sinkOf(ctx: PhaseContext): PeaceTermSink {
  return {
    nextSeq: () => ctx.nextSeq(),
    append: (event) => ctx.eventLedger.append(event),
    reject: (code, message) =>
      ctx.collector.addError(code, message, { stage: "command-collection" }),
  };
}

const STATUS_QUO: PeaceTerm = { _tag: "StatusQuo" };

function refusesPeace(
  ctx: PhaseContext,
  nationId: string,
  warId: string,
  term: PeaceTerm,
): boolean {
  const snapshot = ctx.snapshot.current;
  const rules = ctx.engineOptions?.peaceBehaviour;
  const war = snapshot.wars.wars.find((w) => w.id === warId);
  if (
    rules === undefined ||
    ctx.playerNationId !== nationId ||
    war === undefined ||
    war.status !== "ACTIVE" ||
    (war.attackerId !== nationId && war.defenderId !== nationId)
  ) {
    return false;
  }
  const responderId = war.attackerId === nationId ? war.defenderId : war.attackerId;
  const decision = decidePeaceResponse(
    snapshot,
    warId,
    responderId,
    term,
    rules.acceptanceScoreMargin,
  );
  if (decision.accept) {
    return false;
  }
  ctx.collector.addWarning(
    PEACE_REFUSED,
    `${responderId} refused the peace term (${decision.reason})`,
    { stage: "command-collection", entityId: warId },
  );
  return true;
}

export function handleProposePeace(ctx: PhaseContext, body: ProposePeaceCommand): void {
  if (refusesPeace(ctx, body.nationId, body.warId, body.term)) {
    return;
  }
  ctx.snapshot.current = applyProposePeace(
    ctx.snapshot.current,
    body,
    ctx.campaignMonth,
    sinkOf(ctx),
  );
}

export function handleAcceptPeace(ctx: PhaseContext, body: AcceptPeaceCommand): void {
  const snapshot = ctx.snapshot.current;
  const offer = snapshot.wars.peaceOffers?.find(
    (o) => o.warId === body.warId && o.targetId === body.nationId,
  );
  if (offer === undefined && refusesPeace(ctx, body.nationId, body.warId, STATUS_QUO)) {
    return;
  }
  if (offer === undefined || offer.term._tag === "StatusQuo") {
    ctx.snapshot.current = applyAcceptPeace(snapshot, body, ctx.campaignMonth);
    return;
  }
  ctx.snapshot.current = applyProposePeace(
    snapshot,
    { type: "ProposePeace", nationId: offer.proposerId, warId: offer.warId, term: offer.term },
    ctx.campaignMonth,
    sinkOf(ctx),
  );
}
