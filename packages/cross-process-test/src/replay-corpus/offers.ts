import { makeRecordedInput, type RecordedInput } from "@bluewave/messages";
import type { MonthResult } from "@bluewave/phase-engine";

import { ReplayFileError, type ReplayOfferAnswer } from "./format.js";

export interface OfferSession {
  readonly answers: readonly ReplayOfferAnswer[];
  readonly record: boolean;
}

const MAX_OFFERS_PER_MONTH = 16;

export function recordedInputOf(answer: ReplayOfferAnswer): RecordedInput {
  return makeRecordedInput({
    ordinal: answer.ordinal,
    kind: "offer",
    interruptionId: answer.interruptionId,
    payload: {
      interruptionId: answer.interruptionId,
      battleId: answer.battleId,
      response: answer.response,
    },
  });
}

export function offerSessionFor(scenario: {
  readonly id: string;
  readonly battleOffers?: boolean;
  readonly playerNationId?: string;
  readonly engineDigests?: boolean;
}): OfferSession | undefined {
  if (scenario.battleOffers !== true) return undefined;
  if (scenario.playerNationId === undefined)
    throw new ReplayFileError({
      message: `scenario ${scenario.id} opts into battle offers without a player nation`,
    });
  if (scenario.engineDigests === true)
    throw new ReplayFileError({
      message: `scenario ${scenario.id} cannot pin engine digests with battle offers: the verifier replays a month without an interruption channel`,
    });
  return { answers: [], record: true };
}

export function executeAnswering(
  execute: (answers: readonly ReplayOfferAnswer[]) => MonthResult,
  offers: OfferSession | undefined,
  turnNumber: number,
): { readonly executed: MonthResult; readonly answers: readonly ReplayOfferAnswer[] } {
  let answers: readonly ReplayOfferAnswer[] = offers?.answers ?? [];
  let executed = execute(answers);
  while (offers?.record === true && executed.outcome === "suspended") {
    const request = executed.suspended?.request;
    if (request?.kind !== "offer" || answers.length >= MAX_OFFERS_PER_MONTH) {
      throw new ReplayFileError({
        message: `Month ${String(turnNumber)} suspended for ${request?.kind ?? "an unknown request"} after ${String(answers.length)} offers; a replay records only up to ${String(MAX_OFFERS_PER_MONTH)} delegated offers per month`,
      });
    }
    answers = [
      ...answers,
      {
        ordinal: request.ordinal,
        interruptionId: request.interruptionId,
        battleId: request.battleId,
        response: "delegate",
      },
    ];
    executed = execute(answers);
  }
  return { executed, answers };
}
