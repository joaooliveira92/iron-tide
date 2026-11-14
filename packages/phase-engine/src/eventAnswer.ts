import { recordEventAnswer } from "@bluewave/campaign";
import type { DiplomaticRelation, NationEventHistory, NationState } from "@bluewave/campaign";
import type { GameEvent } from "@bluewave/content-schema";
import {
  ANSWER_PRESTIGE_FAILED,
  applyAnswerEffects,
  attachAnswerEffects,
} from "./answerEffects.js";
import type { PhaseContext } from "./pipeline.js";

export interface EventAnswerInput {
  readonly nation: NationState;
  readonly relations: readonly DiplomaticRelation[];
  readonly history: NationEventHistory;
  readonly event: GameEvent;
  readonly answerId: string;
  readonly resolvedBy: "PLAYER" | "AI" | "DEFAULT";
}

export interface EventAnswerResult {
  readonly nation: NationState;
  readonly relations: readonly DiplomaticRelation[];
  readonly history: NationEventHistory;
}

export function resolveEventAnswer(ctx: PhaseContext, input: EventAnswerInput): EventAnswerResult {
  const content = ctx.engineOptions?.events;
  const month = ctx.campaignMonth;
  const recorded = recordEventAnswer(input.history, {
    eventId: input.event.id,
    month,
    answerId: input.answerId,
    resolvedBy: input.resolvedBy,
  });
  if (content === undefined) {
    return { nation: input.nation, relations: input.relations, history: recorded };
  }
  const outcome = applyAnswerEffects({
    nation: input.nation,
    relations: input.relations,
    event: input.event,
    answerId: input.answerId,
    rules: content.rules.answerEffects,
    prestigeRules: ctx.snapshot.read("prestigeRules"),
    month,
    rulesetVersion: ctx.snapshot.read("rulesetVersion"),
    nextSeq: ctx.nextSeq,
  });
  if (outcome === undefined) {
    return { nation: input.nation, relations: input.relations, history: recorded };
  }
  for (const ledgerEvent of outcome.ledgerEvents) ctx.eventLedger.append(ledgerEvent);
  for (const failure of outcome.failures) {
    ctx.collector.addError(ANSWER_PRESTIGE_FAILED, failure, {
      stage: "events",
      entityId: input.nation.id,
    });
  }
  const quiet = outcome.effects.lines.every(
    (line) => line.budgetBp === 0 && line.unrestDelta === 0 && line.tensionDelta === 0,
  );
  const silent = quiet && outcome.effects.prestigeDelta === 0;
  return {
    nation: outcome.nation,
    relations: outcome.relations,
    history: silent ? recorded : attachAnswerEffects(recorded, outcome.effects),
  };
}
