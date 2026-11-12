import type { NationState } from "@bluewave/campaign";
import { recordEventAnswer, resolveEventCounterpart } from "@bluewave/campaign";
import type { EventAnswer, GameEvent } from "@bluewave/content-schema";
import type {
  DecisionDelta,
  DecisionOption,
  EffectHint,
  EffectMagnitude,
  PendingDecision,
} from "@bluewave/messages";
import type { PhaseContext } from "./pipeline.js";

export const DILEMMA_PHASE = "resolve_diplomacy" as const;

const SCHEMA_SCALE: Readonly<Record<string, number>> = {
  budgetBp: 10_000,
  prestigeBp: 10_000,
  unrest: 10,
  tension: 10,
};

export interface DilemmaHintContext {
  readonly prestige: number;
}

function magnitudeOf(size: number, scale: number): EffectMagnitude {
  if (size * 3 <= scale) return "minor";
  if (size * 3 <= scale * 2) return "moderate";
  return "major";
}

export function dilemmaHints(
  deltas: readonly DecisionDelta[],
  context: DilemmaHintContext,
): EffectHint[] {
  return deltas.map((entry) => {
    const size = Math.abs(entry.delta);
    const scale =
      entry.attribute === "prestige"
        ? Math.max(1, context.prestige)
        : (SCHEMA_SCALE[entry.attribute] ?? Math.max(1, size));
    return {
      target: entry.target,
      attribute: entry.attribute,
      direction: entry.delta > 0 ? "increase" : entry.delta < 0 ? "decrease" : "none",
      magnitude: size === 0 ? "minor" : magnitudeOf(size, scale),
    };
  });
}

function answerDeltas(
  answer: EventAnswer,
  nationId: string,
  counterpartOf: (role: "highest_tension_rival" | "war_enemy") => string | undefined,
): DecisionDelta[] {
  const self = { type: "nation", id: nationId } as const;
  const { effects } = answer;
  const deltas: DecisionDelta[] = [];
  if (effects.budgetBp !== 0) {
    deltas.push({ target: self, attribute: "budgetBp", delta: effects.budgetBp });
  }
  const prestige = effects.prestige;
  if (prestige?.kind === "FIXED_GAIN") {
    deltas.push({ target: self, attribute: "prestige", delta: prestige.amount });
  } else if (prestige?.kind === "FIXED_LOSS") {
    deltas.push({ target: self, attribute: "prestige", delta: -prestige.amount });
  } else if (prestige?.kind === "PROPORTIONAL_LOSS") {
    deltas.push({ target: self, attribute: "prestigeBp", delta: -prestige.basisPoints });
  }
  if (effects.unrest !== 0) {
    deltas.push({ target: self, attribute: "unrest", delta: effects.unrest });
  }
  if (effects.tension !== undefined && effects.tension.delta !== 0) {
    const counterpart = counterpartOf(effects.tension.counterpart);
    if (counterpart !== undefined) {
      deltas.push({
        target: { type: "nation", id: counterpart },
        attribute: "tension",
        delta: effects.tension.delta,
      });
    }
  }
  return deltas;
}

export interface DilemmaDecision {
  readonly nationId: string;
  readonly eventId: string;
  readonly pending: PendingDecision;
}

function dilemmaOptions(
  event: GameEvent,
  nation: NationState,
  counterpartOf: (role: "highest_tension_rival" | "war_enemy") => string | undefined,
): DecisionOption[] {
  return event.answers.map((answer) => {
    const deltas = answerDeltas(answer, nation.id, counterpartOf);
    return {
      optionId: answer.id,
      titleKey: answer.labelKey,
      bodyKey: answer.labelKey,
      hints: dilemmaHints(deltas, { prestige: Number(nation.prestige) }),
      effects: [],
      deltas,
    };
  });
}

export function pendingDilemma(ctx: PhaseContext): DilemmaDecision | undefined {
  const content = ctx.engineOptions?.events;
  const nationId = ctx.playerNationId;
  if (content === undefined || nationId === undefined) return undefined;
  const nation = ctx.snapshot.read("nations").get(nationId);
  const pending = nation?.eventHistory?.pending;
  if (nation === undefined || pending === undefined) return undefined;
  const event = content.catalogue.find((candidate) => candidate.id === pending.eventId);
  if (event === undefined) return undefined;
  const relations = ctx.snapshot.read("politics").relations;
  const counterpartOf = (role: "highest_tension_rival" | "war_enemy") =>
    resolveEventCounterpart(nationId, role, relations)?.nationId;
  return {
    nationId,
    eventId: event.id,
    pending: {
      phase: DILEMMA_PHASE,
      subjectKey: event.id,
      decisionId: event.id,
      titleKey: event.titleKey,
      bodyKey: event.bodyKey,
      interpolation: { eventId: event.id, nationId, drawnMonth: pending.drawnMonth },
      options: dilemmaOptions(event, nation, counterpartOf),
    },
  };
}

export function recordDilemmaAnswer(ctx: PhaseContext, dilemma: DilemmaDecision, answerId: string) {
  const nations = ctx.snapshot.read("nations");
  const nation = nations.get(dilemma.nationId);
  if (nation?.eventHistory === undefined) return;
  const eventHistory = recordEventAnswer(nation.eventHistory, {
    eventId: dilemma.eventId,
    month: ctx.campaignMonth,
    answerId,
    resolvedBy: "PLAYER",
  });
  ctx.snapshot.write("nations", new Map(nations).set(nation.id, { ...nation, eventHistory }));
}
