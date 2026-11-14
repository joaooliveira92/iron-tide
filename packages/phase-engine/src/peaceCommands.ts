import { decidePeaceResponse } from "@bluewave/ai";
import type { AcceptPeaceCommand, ProposePeaceCommand } from "@bluewave/commands";
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

export function handleProposePeace(ctx: PhaseContext, body: ProposePeaceCommand): void {
  const snapshot = ctx.snapshot.current;
  const rules = ctx.engineOptions?.peaceBehaviour;
  const war = snapshot.wars.wars.find((w) => w.id === body.warId);
  if (
    rules !== undefined &&
    ctx.playerNationId === body.nationId &&
    war !== undefined &&
    war.status === "ACTIVE" &&
    (war.attackerId === body.nationId || war.defenderId === body.nationId)
  ) {
    const responderId = war.attackerId === body.nationId ? war.defenderId : war.attackerId;
    const decision = decidePeaceResponse(
      snapshot,
      body.warId,
      responderId,
      body.term,
      rules.acceptanceScoreMargin,
    );
    if (!decision.accept) {
      ctx.collector.addError(
        PEACE_REFUSED,
        `${responderId} refused the peace term (${decision.reason})`,
        { stage: "command-collection", entityId: body.warId },
      );
      return;
    }
  }
  ctx.snapshot.current = applyProposePeace(snapshot, body, ctx.campaignMonth, sinkOf(ctx));
}

export function handleAcceptPeace(ctx: PhaseContext, body: AcceptPeaceCommand): void {
  const snapshot = ctx.snapshot.current;
  const offer = snapshot.wars.peaceOffers?.find(
    (o) => o.warId === body.warId && o.targetId === body.nationId,
  );
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
