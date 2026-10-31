import type { NationEventHistory, NationState } from "@bluewave/campaign";
import {
  aiStanceWeights,
  EVENT_DRAW_RANGE_BP,
  eligibleEvents,
  eventAnswerStreamId,
  eventDrawStreamId,
  EVENT_STREAM_FAMILY,
  isDilemmaOverdue,
  pickAiAnswer,
  recordEventAnswer,
  selectEvent,
  withPendingDilemma,
} from "@bluewave/campaign";
import { canonicalSerialize, compareCodePoints, sha256Hex } from "@bluewave/deterministic";
import type { PhaseContext } from "./pipeline.js";

const EVENT_PHASE = "resolve_diplomacy";
const NO_EVENT = "NO_EVENT";

function drawOf(ctx: PhaseContext, streamId: string): number {
  return Math.floor(ctx.rng.engine().stream(streamId).next() * EVENT_DRAW_RANGE_BP);
}

export function applyEventsForMonth(ctx: PhaseContext): void {
  const content = ctx.engineOptions?.events;
  if (content === undefined || content.catalogue.length === 0) return;
  const { rules, catalogue } = content;
  const nations = ctx.snapshot.read("nations");
  const relations = ctx.snapshot.read("politics").relations;
  const rulesetVersion = ctx.snapshot.read("rulesetVersion");
  const month = ctx.campaignMonth;
  const updated = new Map<string, NationState>();

  const nationIds = [...nations.keys()].sort(compareCodePoints);
  for (const nationId of nationIds) {
    const nation = nations.get(nationId)!;
    if (nation.governmentType === undefined) continue;
    const original: NationEventHistory = nation.eventHistory ?? { fired: [], flags: [] };
    let history = original;

    if (history.pending !== undefined && isDilemmaOverdue(history.pending, month, rules)) {
      const overdue = catalogue.find((event) => event.id === history.pending?.eventId);
      if (overdue === undefined) {
        const { pending: _dropped, ...rest } = history;
        history = rest;
      } else {
        history = recordEventAnswer(history, {
          eventId: overdue.id,
          month,
          answerId: overdue.defaultAnswerId,
          resolvedBy: "DEFAULT",
        });
      }
    }

    if (history.pending === undefined) {
      const eligible = eligibleEvents(catalogue, { nation, history, month, relations });
      if (eligible.length > 0) {
        const drawStream = eventDrawStreamId(nationId, month);
        const draw = drawOf(ctx, drawStream);
        const selection = selectEvent(eligible, draw);
        ctx.randomLedger.record({
          streamId: EVENT_STREAM_FAMILY,
          entityKey: `${nationId}/${month}`,
          phase: EVENT_PHASE,
          rulesetVersion,
          inputHash: sha256Hex(
            canonicalSerialize({
              nationId,
              month,
              eligible: eligible.map((event) => ({ id: event.id, weightBp: event.weightBp })),
              totalWeightBp: selection.totalWeightBp,
            }),
          ),
          draw,
          outcome: selection.event?.id ?? NO_EVENT,
          reasonCode: selection.event === undefined ? "NO_EVENT_DRAWN" : "EVENT_DRAWN",
        });

        const drawn = selection.event;
        if (drawn !== undefined) {
          if (nationId === ctx.playerNationId) {
            history = withPendingDilemma(history, { eventId: drawn.id, drawnMonth: month });
          } else {
            const answerStream = eventAnswerStreamId(nationId, month);
            const answerDraw = drawOf(ctx, answerStream);
            const choice = pickAiAnswer(drawn, nation, rules, answerDraw);
            ctx.randomLedger.record({
              streamId: EVENT_STREAM_FAMILY,
              entityKey: `${nationId}/${month}/answer`,
              phase: EVENT_PHASE,
              rulesetVersion,
              inputHash: sha256Hex(
                canonicalSerialize({
                  nationId,
                  month,
                  eventId: drawn.id,
                  governmentType: nation.governmentType,
                  traits: nation.traits ?? [],
                  weights: aiStanceWeights(nation, rules) ?? null,
                  answers: drawn.answers.map((answer) => ({
                    id: answer.id,
                    stance: answer.stance,
                  })),
                }),
              ),
              draw: answerDraw,
              outcome: choice.answerId,
              reasonCode: choice.reasonCode,
            });
            history = recordEventAnswer(history, {
              eventId: drawn.id,
              month,
              answerId: choice.answerId,
              resolvedBy: "AI",
            });
          }
        }
      }
    }

    if (history !== original) updated.set(nationId, { ...nation, eventHistory: history });
  }

  if (updated.size === 0) return;
  ctx.snapshot.write("nations", new Map([...nations, ...updated]));
}
