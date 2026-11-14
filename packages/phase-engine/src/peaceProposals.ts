import type { PeaceOffer } from "@bluewave/campaign";
import { decidePeaceProposal } from "@bluewave/ai";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import type { PhaseContext } from "./pipeline.js";

export const PEACE_PROPOSAL_STREAM_FAMILY = "diplomacy/peace_proposal" as const;
export const PEACE_PROPOSAL_DRAW_RANGE_BP = 10_000 as const;

function sameTerm(a: PeaceOffer["term"], b: PeaceOffer["term"]): boolean {
  if (a._tag === "StatusQuo") return b._tag === "StatusQuo";
  return b._tag === "CedeArea" && b.areaId === a.areaId;
}

export function runPeaceProposals(ctx: PhaseContext): void {
  const rules = ctx.engineOptions?.peaceBehaviour;
  const player = ctx.playerNationId;
  if (rules === undefined || player === undefined) return;
  const wars = ctx.snapshot.read("wars");
  const world = ctx.snapshot.read("world");
  const nations = ctx.snapshot.read("nations");
  const rulesetVersion = ctx.snapshot.read("rulesetVersion");
  const engine = ctx.rng.engine();
  const existing = wars.peaceOffers ?? [];
  const next: PeaceOffer[] = [];

  for (const war of wars.wars) {
    if (war.status !== "ACTIVE") continue;
    if (war.attackerId !== player && war.defenderId !== player) continue;
    const aiId = war.attackerId === player ? war.defenderId : war.attackerId;
    const decision = decidePeaceProposal(
      { wars, world, nations },
      war.id,
      aiId,
      rules.acceptanceScoreMargin,
    );
    if (decision.term === undefined) continue;
    const pending = existing.find((o) => o.warId === war.id);
    if (pending !== undefined && sameTerm(pending.term, decision.term)) {
      next.push(pending);
      continue;
    }
    const draw = Math.floor(
      engine.stream(`${PEACE_PROPOSAL_STREAM_FAMILY}/${war.id}/${ctx.campaignMonth}`).next() *
        PEACE_PROPOSAL_DRAW_RANGE_BP,
    );
    const proposes = draw < rules.proposalChanceBp;
    ctx.randomLedger.record({
      streamId: PEACE_PROPOSAL_STREAM_FAMILY,
      entityKey: war.id,
      phase: "resolve_diplomacy",
      rulesetVersion,
      inputHash: sha256Hex(
        canonicalSerialize({
          warId: war.id,
          campaignMonth: ctx.campaignMonth,
          proposerId: aiId,
          term: decision.term,
          reason: decision.reason,
          attackerWarScore: war.attackerWarScore,
          defenderWarScore: war.defenderWarScore,
          proposalChanceBp: rules.proposalChanceBp,
        }),
      ),
      draw,
      outcome: proposes ? "PROPOSE" : "HOLD",
      reasonCode: decision.reason,
    });
    if (!proposes) continue;
    next.push({
      warId: war.id,
      proposerId: aiId,
      targetId: player,
      month: ctx.campaignMonth,
      term: decision.term,
      reasonCode: decision.reason,
    });
  }

  if (canonicalSerialize(next) === canonicalSerialize(existing)) return;
  ctx.snapshot.write("wars", { ...wars, peaceOffers: next });
}
