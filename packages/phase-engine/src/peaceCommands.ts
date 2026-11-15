import { decidePeaceResponse } from "@bluewave/ai";
import type { CampaignSnapshot } from "@bluewave/campaign";
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

export interface PeaceRefusal {
  readonly responderId: string;
  readonly reason: string;
}

export function peaceRefusal(
  snapshot: CampaignSnapshot,
  margin: number,
  nationId: string,
  warId: string,
  term: PeaceTerm,
): PeaceRefusal | undefined {
  const war = snapshot.wars.wars.find((w) => w.id === warId);
  if (
    war === undefined ||
    war.status !== "ACTIVE" ||
    (war.attackerId !== nationId && war.defenderId !== nationId)
  ) {
    return undefined;
  }
  const responderId = war.attackerId === nationId ? war.defenderId : war.attackerId;
  const decision = decidePeaceResponse(snapshot, warId, responderId, term, margin);
  return decision.accept ? undefined : { responderId, reason: decision.reason };
}

function refusesPeace(
  ctx: PhaseContext,
  nationId: string,
  warId: string,
  term: PeaceTerm,
): boolean {
  const rules = ctx.engineOptions?.peaceBehaviour;
  if (rules === undefined || ctx.playerNationId !== nationId) {
    return false;
  }
  const refusal = peaceRefusal(
    ctx.snapshot.current,
    rules.acceptanceScoreMargin,
    nationId,
    warId,
    term,
  );
  if (refusal === undefined) {
    return false;
  }
  ctx.collector.addWarning(
    PEACE_REFUSED,
    `${refusal.responderId} refused the peace term (${refusal.reason})`,
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
