import {
  activeBudgetModifiers,
  applyExplicitPrestigeRule,
  applyTensionJump,
  applyUnrestDelta,
  nextMonthId,
  planAnswerEffects,
  resolveEventCounterpart,
} from "@bluewave/campaign";
import type {
  AnswerEffectLine,
  AnswerEffectRecord,
  BudgetModifier,
  DiplomaticRelation,
  NationEventHistory,
  NationState,
  PrestigeValueSet,
} from "@bluewave/campaign";
import type { EventAnswerEffectRules, GameEvent } from "@bluewave/content-schema";
import type { SafeInt } from "@bluewave/contracts";
import type { DomainEventEnvelope } from "@bluewave/events";
import { Result } from "effect";
import { prestigeChangedEvent } from "./events.js";

export function attachAnswerEffects(
  history: NationEventHistory,
  effects: AnswerEffectRecord,
): NationEventHistory {
  const fired = [...history.fired];
  const last = fired[fired.length - 1];
  if (last === undefined) return history;
  fired[fired.length - 1] = { ...last, effects };
  return { ...history, fired };
}

export const ANSWER_PRESTIGE_FAILED = "EVENT_ANSWER_PRESTIGE_FAILED" as const;

export interface AnswerEffectInput {
  readonly nation: NationState;
  readonly relations: readonly DiplomaticRelation[];
  readonly event: GameEvent;
  readonly answerId: string;
  readonly rules: EventAnswerEffectRules;
  readonly prestigeRules: PrestigeValueSet;
  readonly month: string;
  readonly rulesetVersion: string;
  readonly nextSeq: () => SafeInt;
}

export interface AnswerEffectOutcome {
  readonly nation: NationState;
  readonly relations: readonly DiplomaticRelation[];
  readonly effects: AnswerEffectRecord;
  readonly ledgerEvents: readonly DomainEventEnvelope[];
  readonly failures: readonly string[];
}

function adjustTension(
  input: AnswerEffectInput,
  counterpartRole: NonNullable<ReturnType<typeof planAnswerEffects>["counterpart"]>,
  delta: number,
): {
  readonly relations: readonly DiplomaticRelation[];
  readonly partner?: string;
  readonly before?: number;
  readonly after?: number;
} {
  const counterpart = resolveEventCounterpart(input.nation.id, counterpartRole, input.relations);
  if (counterpart === undefined) return { relations: input.relations };
  const index = input.relations.findIndex(
    (relation) =>
      (relation.nationA === input.nation.id && relation.nationB === counterpart.nationId) ||
      (relation.nationB === input.nation.id && relation.nationA === counterpart.nationId),
  );
  const relation = input.relations[index]!;
  const after = applyTensionJump(relation.tension, delta, input.rules.tensionJumpCap);
  const relations = [...input.relations];
  relations[index] = { ...relation, tension: after };
  return { relations, partner: counterpart.nationId, before: relation.tension, after };
}

export function applyAnswerEffects(input: AnswerEffectInput): AnswerEffectOutcome | undefined {
  const answer = input.event.answers.find((candidate) => candidate.id === input.answerId);
  if (answer === undefined) return undefined;
  const plan = planAnswerEffects(answer, input.nation.traits ?? [], input.rules);

  let nation = input.nation;
  const ledgerEvents: DomainEventEnvelope[] = [];
  const failures: string[] = [];
  const lines: AnswerEffectLine[] = [];
  const newModifiers: BudgetModifier[] = [];
  const prestigeBefore = nation.prestige as number;

  for (const planned of plan.lines) {
    let prestigeDelta = 0;
    if (planned.prestige !== undefined) {
      const applied = applyExplicitPrestigeRule(
        nation.prestige as number,
        input.prestigeRules,
        planned.prestige.rule,
      );
      if (Result.isFailure(applied)) {
        failures.push(`${planned.prestige.reasonCode}: ${applied.failure._tag}`);
      } else {
        const detail = applied.success;
        prestigeDelta = detail.delta as number;
        if (prestigeDelta !== 0) {
          nation = {
            ...nation,
            prestige: detail.after,
            prestigeLastChange: {
              reasonCode: planned.prestige.reasonCode,
              before: detail.before,
              after: detail.after,
              delta: detail.delta,
              month: input.month,
              appliedRule: detail.appliedRule,
              unclampedAfter: detail.unclampedAfter,
              bounds: detail.bounds,
            },
          };
          ledgerEvents.push(
            prestigeChangedEvent(
              nation.id,
              planned.prestige.reasonCode,
              planned.prestige.rule.kind,
              { before: detail.before, after: detail.after, delta: detail.delta },
              input.rulesetVersion,
              input.nextSeq(),
              input.month,
            ),
          );
        }
      }
    }
    if (planned.budgetBp !== 0) {
      newModifiers.push({
        eventId: input.event.id,
        answerId: answer.id,
        ...(planned.trait === undefined ? {} : { trait: planned.trait }),
        firstMonth: nextMonthId(input.month),
        initialBp: planned.budgetBp,
        decayMonths: input.rules.budgetDecayMonths,
        capBp: input.rules.budgetStackCapBp,
      });
    }
    lines.push({
      source: planned.source,
      ...(planned.trait === undefined ? {} : { trait: planned.trait }),
      ...(planned.reasonCode === undefined ? {} : { reasonCode: planned.reasonCode }),
      budgetBp: planned.budgetBp,
      prestigeDelta,
      unrestDelta: planned.unrestDelta,
      tensionDelta: planned.tensionDelta,
    });
  }

  const unrestBefore = nation.unrest ?? 0;
  const unrestAfter = applyUnrestDelta(nation.unrest, plan.unrest);
  const touchesUnrest = plan.unrest !== 0 || nation.unrest !== undefined;
  if (touchesUnrest) nation = { ...nation, unrest: unrestAfter };

  if (newModifiers.length > 0) {
    const horizon = nextMonthId(input.month);
    nation = {
      ...nation,
      budgetModifiers: activeBudgetModifiers(
        [...(nation.budgetModifiers ?? []), ...newModifiers],
        horizon,
      ),
    };
  }

  let relations = input.relations;
  let tension: ReturnType<typeof adjustTension> | undefined;
  if (plan.counterpart !== undefined && plan.tension !== 0) {
    tension = adjustTension(input, plan.counterpart, plan.tension);
    relations = tension.relations;
  }

  const effects: AnswerEffectRecord = {
    lines,
    budgetBp: lines.reduce((sum, line) => sum + line.budgetBp, 0),
    prestigeDelta: (nation.prestige as number) - prestigeBefore,
    unrestBefore,
    unrestAfter,
    ...(tension?.partner === undefined
      ? {}
      : {
          tensionPartner: tension.partner,
          tensionBefore: tension.before!,
          tensionAfter: tension.after!,
        }),
  };
  return { nation, relations, effects, ledgerEvents, failures };
}
