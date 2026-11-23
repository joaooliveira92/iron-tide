import { TENSION_MAX, type CampaignSnapshot } from "@bluewave/campaign";
import type { DeclareWarCommand } from "@bluewave/commands";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, compareCodePoints, sha256Hex } from "@bluewave/deterministic";
import type { DomainEventEnvelope } from "@bluewave/events";
import type { PhaseContext } from "./pipeline.js";
import { pairKey, unrestrictedRaiderCheck } from "./submarineIncidents.js";

export const SUBMARINE_NEUTRAL_ENTRY_STREAM_FAMILY = "diplomacy/submarine_neutral_entry";
export const SUBMARINE_NEUTRAL_ENTRY_REASON = "SUBMARINE_NEUTRAL_ENTRY";
const ENTRY_DRAW_RANGE_BP = 10_000;

type EntryState = Pick<CampaignSnapshot, "nations" | "politics" | "wars">;

export type DeclareWar = (
  snapshot: EntryState,
  body: DeclareWarCommand,
  campaignMonth: string,
) => EntryState;

function inLiveWar(snapshot: EntryState, nationId: string): boolean {
  return snapshot.wars.wars.some(
    (war) =>
      (war.status === "ACTIVE" || war.status === "DECLARED_NOT_ACTIVE") &&
      (war.attackerSideMembers.includes(nationId) || war.defenderSideMembers.includes(nationId)),
  );
}

const NEUTRAL_ENTRY_EVENT_VERSION = "0.1.0" as const;

export function neutralWarEnteredEvent(
  declarer: string,
  target: string,
  tension: number,
  seq: SafeInt,
  campaignMonth: string,
): DomainEventEnvelope {
  return {
    eventId: `NeutralWarEntered-${declarer}-${target}-${String(seq)}`,
    version: NEUTRAL_ENTRY_EVENT_VERSION,
    aggregateType: "nation",
    aggregateId: declarer,
    eventType: "NeutralWarEntered",
    timestamp: `${campaignMonth}-01T00:00:00.000Z`,
    body: {
      kind: "NeutralWarEntered",
      nationId: declarer,
      targetNationId: target,
      warId: `war_${declarer}_${target}_${campaignMonth}`,
      month: campaignMonth,
      cause: "UNRESTRICTED_SUBMARINE_INCIDENTS",
      tension: SafeInt(tension),
    },
    sequenceNumber: seq,
  };
}

export function applySubmarineNeutralEntryForMonth(
  ctx: PhaseContext,
  declareWar: DeclareWar,
): void {
  const threat = ctx.engineOptions?.tradeProtection?.submarineThreat;
  const neutralEntryBp = threat?.unrestricted?.neutralEntryBp;
  if (threat === undefined || neutralEntryBp === undefined) return;
  const raiding = unrestrictedRaiderCheck(ctx, threat);
  const engine = ctx.rng.engine();
  const rulesetVersion = ctx.snapshot.read("rulesetVersion");
  const initial: EntryState = {
    nations: ctx.snapshot.read("nations"),
    politics: ctx.snapshot.read("politics"),
    wars: ctx.snapshot.read("wars"),
  };
  let snapshot = initial;

  const order = snapshot.politics.relations
    .map((relation) => ({ relation, key: pairKey(relation.nationA, relation.nationB) }))
    .sort((a, b) => compareCodePoints(a.key, b.key));

  for (const { relation, key } of order) {
    if (relation.relation !== "neutral" && relation.relation !== "trade_agreement") continue;
    if (relation.tension < TENSION_MAX || relation.nap) continue;
    const [first, second] = key.split("\u0000") as [string, string];
    const firstRaiding = raiding(snapshot.nations.get(first));
    const secondRaiding = raiding(snapshot.nations.get(second));
    if (!firstRaiding && !secondRaiding) continue;
    const declarer = firstRaiding && !secondRaiding ? second : first;
    const target = declarer === first ? second : first;
    if (inLiveWar(snapshot, declarer)) continue;

    const entityKey = `${first}|${second}`;
    const draw = Math.floor(
      engine
        .stream(`${SUBMARINE_NEUTRAL_ENTRY_STREAM_FAMILY}/${entityKey}/${ctx.campaignMonth}`)
        .next() * ENTRY_DRAW_RANGE_BP,
    );
    const hit = draw < neutralEntryBp;
    ctx.randomLedger.record({
      streamId: SUBMARINE_NEUTRAL_ENTRY_STREAM_FAMILY,
      entityKey,
      phase: "resolve_diplomacy",
      rulesetVersion,
      inputHash: sha256Hex(
        canonicalSerialize({
          pair: entityKey,
          campaignMonth: ctx.campaignMonth,
          relation: relation.relation,
          tension: relation.tension,
          declarer,
          neutralEntryBp,
        }),
      ),
      draw,
      outcome: hit ? "HIT" : "MISS",
      reasonCode: SUBMARINE_NEUTRAL_ENTRY_REASON,
    });
    if (!hit) continue;
    snapshot = declareWar(
      snapshot,
      { type: "DeclareWar", nationId: declarer, targetNationId: target },
      ctx.campaignMonth,
    );
    ctx.eventLedger.append(
      neutralWarEnteredEvent(declarer, target, relation.tension, ctx.nextSeq(), ctx.campaignMonth),
    );
  }

  if (snapshot.politics !== initial.politics) ctx.snapshot.write("politics", snapshot.politics);
  if (snapshot.wars !== initial.wars) ctx.snapshot.write("wars", snapshot.wars);
}
