import type {
  EventCounterpartRole,
  EventResolutionRules,
  EventStance,
  GameEvent,
} from "@bluewave/content-schema";
import { compareCodePoints } from "@bluewave/deterministic";
import type {
  DiplomaticRelation,
  EventResolver,
  NationEventHistory,
  NationState,
  PendingDilemma,
} from "./state.js";

export const EVENT_STREAM_FAMILY = "events" as const;
export const EVENT_ANSWER_STREAM_SUFFIX = "answer" as const;
export const EVENT_DRAW_RANGE_BP = 10_000 as const;

export function eventDrawStreamId(nationId: string, month: string): string {
  return `${EVENT_STREAM_FAMILY}/${nationId}/${month}`;
}

export function eventAnswerStreamId(nationId: string, month: string): string {
  return `${eventDrawStreamId(nationId, month)}/${EVENT_ANSWER_STREAM_SUFFIX}`;
}

export function monthIndex(month: string): number {
  const [year, number] = month.split("-");
  return Number(year) * 12 + Number(number) - 1;
}

export interface EventCounterpart {
  readonly nationId: string;
  readonly tension: number;
}

export function resolveEventCounterpart(
  nationId: string,
  role: EventCounterpartRole,
  relations: readonly DiplomaticRelation[],
): EventCounterpart | undefined {
  let best: EventCounterpart | undefined;
  for (const relation of relations) {
    const partner =
      relation.nationA === nationId
        ? relation.nationB
        : relation.nationB === nationId
          ? relation.nationA
          : undefined;
    if (partner === undefined) continue;
    const atWar = relation.relation === "at_war";
    if (atWar !== (role === "war_enemy")) continue;
    const better =
      best === undefined ||
      relation.tension > best.tension ||
      (relation.tension === best.tension && compareCodePoints(partner, best.nationId) < 0);
    if (better) best = { nationId: partner, tension: relation.tension };
  }
  return best;
}

export interface EventEligibilityContext {
  readonly nation: Pick<NationState, "id" | "governmentType" | "traits">;
  readonly history: NationEventHistory;
  readonly month: string;
  readonly relations: readonly DiplomaticRelation[];
}

export type EventIneligibleReason =
  | "GOVERNMENT_TYPE"
  | "ERA_WINDOW"
  | "TENSION_RANGE"
  | "REQUIRED_TRAIT"
  | "EXCLUDED_TRAIT"
  | "REQUIRED_FLAG"
  | "EXCLUDED_FLAG"
  | "ONCE_FIRED"
  | "COOLDOWN";

export function eventIneligibleReason(
  event: GameEvent,
  context: EventEligibilityContext,
): EventIneligibleReason | undefined {
  const { gates } = event;
  const { nation, history, month, relations } = context;
  const traits = nation.traits ?? [];

  if (gates.governmentTypes !== undefined) {
    if (
      nation.governmentType === undefined ||
      !gates.governmentTypes.includes(nation.governmentType)
    ) {
      return "GOVERNMENT_TYPE";
    }
  }
  if (gates.eraWindow !== undefined) {
    if (month < gates.eraWindow.fromMonth || month > gates.eraWindow.toMonth) return "ERA_WINDOW";
  }
  if (gates.tension !== undefined) {
    const counterpart = resolveEventCounterpart(nation.id, gates.tension.counterpart, relations);
    if (
      counterpart === undefined ||
      counterpart.tension < gates.tension.min ||
      counterpart.tension > gates.tension.max
    ) {
      return "TENSION_RANGE";
    }
  }
  if (gates.requiredTraits?.some((trait) => !traits.includes(trait)) === true) {
    return "REQUIRED_TRAIT";
  }
  if (gates.excludedTraits?.some((trait) => traits.includes(trait)) === true) {
    return "EXCLUDED_TRAIT";
  }
  if (gates.requiredFlags?.some((flag) => !history.flags.includes(flag)) === true) {
    return "REQUIRED_FLAG";
  }
  if (gates.excludedFlags?.some((flag) => history.flags.includes(flag)) === true) {
    return "EXCLUDED_FLAG";
  }

  const previous = history.fired.filter((record) => record.eventId === event.id);
  if (event.once && previous.length > 0) return "ONCE_FIRED";
  const lastFired = previous.reduce<string | undefined>(
    (latest, record) => (latest === undefined || record.month > latest ? record.month : latest),
    undefined,
  );
  if (lastFired !== undefined && monthIndex(month) - monthIndex(lastFired) < event.cooldownMonths) {
    return "COOLDOWN";
  }
  return undefined;
}

export function eligibleEvents(
  catalogue: readonly GameEvent[],
  context: EventEligibilityContext,
): readonly GameEvent[] {
  return [...catalogue]
    .sort((a, b) => compareCodePoints(a.id, b.id))
    .filter((event) => eventIneligibleReason(event, context) === undefined);
}

function scaledDraw(draw: number, range: number): number {
  return Math.floor((draw * range) / EVENT_DRAW_RANGE_BP);
}

export interface EventSelection {
  readonly event?: GameEvent;
  readonly totalWeightBp: number;
}

export function selectEvent(eligible: readonly GameEvent[], draw: number): EventSelection {
  const totalWeightBp = eligible.reduce((sum, event) => sum + event.weightBp, 0);
  const position = scaledDraw(draw, Math.max(EVENT_DRAW_RANGE_BP, totalWeightBp));
  let cumulative = 0;
  for (const event of eligible) {
    cumulative += event.weightBp;
    if (position < cumulative) return { event, totalWeightBp };
  }
  return { totalWeightBp };
}

const STANCE_ORDER: readonly EventStance[] = ["hawk", "dove", "neutral"];

export function aiStanceWeights(
  nation: Pick<NationState, "governmentType" | "traits">,
  rules: EventResolutionRules,
): Readonly<Record<EventStance, number>> | undefined {
  if (nation.governmentType === undefined) return undefined;
  const base = rules.aiStanceWeightsBp[nation.governmentType];
  const weights: Record<EventStance, number> = {
    hawk: base.hawkBp,
    dove: base.doveBp,
    neutral: base.neutralBp,
  };
  const traits = nation.traits ?? [];
  for (const shift of rules.traitShifts) {
    if (traits.includes(shift.trait)) weights[shift.stance] += shift.deltaBp;
  }
  for (const stance of STANCE_ORDER) weights[stance] = Math.max(0, weights[stance]);
  return weights;
}

export type AiAnswerReason = "AI_STANCE_WEIGHTED" | "AI_NO_WEIGHT";

export interface AiAnswerChoice {
  readonly answerId: string;
  readonly stance: EventStance;
  readonly reasonCode: AiAnswerReason;
  readonly totalWeightBp: number;
}

export function pickAiAnswer(
  event: GameEvent,
  nation: Pick<NationState, "governmentType" | "traits">,
  rules: EventResolutionRules,
  draw: number,
): AiAnswerChoice {
  const fallback = (): AiAnswerChoice => {
    const answer = event.answers.find((candidate) => candidate.id === event.defaultAnswerId)!;
    return {
      answerId: answer.id,
      stance: answer.stance,
      reasonCode: "AI_NO_WEIGHT",
      totalWeightBp: 0,
    };
  };
  const weights = aiStanceWeights(nation, rules);
  if (weights === undefined) return fallback();

  const live = STANCE_ORDER.map((stance) => ({
    stance,
    weight: event.answers.some((answer) => answer.stance === stance) ? weights[stance] : 0,
  })).filter((entry) => entry.weight > 0);
  const totalWeightBp = live.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeightBp === 0) return fallback();

  const position = scaledDraw(draw, totalWeightBp);
  let start = 0;
  for (const entry of live) {
    if (position < start + entry.weight) {
      const answers = event.answers.filter((answer) => answer.stance === entry.stance);
      const index = Math.floor(((position - start) * answers.length) / entry.weight);
      const chosen = answers[index]!;
      return {
        answerId: chosen.id,
        stance: entry.stance,
        reasonCode: "AI_STANCE_WEIGHTED",
        totalWeightBp,
      };
    }
    start += entry.weight;
  }
  return fallback();
}

export function isDilemmaOverdue(
  pending: PendingDilemma,
  month: string,
  rules: Pick<EventResolutionRules, "defaultAnswerAfterMonths">,
): boolean {
  return monthIndex(month) - monthIndex(pending.drawnMonth) >= rules.defaultAnswerAfterMonths;
}

export function withPendingDilemma(
  history: NationEventHistory,
  pending: PendingDilemma,
): NationEventHistory {
  return { ...history, pending };
}

export function recordEventAnswer(
  history: NationEventHistory,
  answer: {
    readonly eventId: string;
    readonly month: string;
    readonly answerId: string;
    readonly resolvedBy: EventResolver;
  },
): NationEventHistory {
  const { pending: _cleared, ...rest } = history;
  return {
    ...rest,
    fired: [
      ...history.fired,
      {
        eventId: answer.eventId,
        month: answer.month,
        answerId: answer.answerId,
        resolvedBy: answer.resolvedBy,
      },
    ],
  };
}
