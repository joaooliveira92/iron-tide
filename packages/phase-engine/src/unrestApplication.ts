import {
  clampUnrest,
  unrestOf,
  withUnrestChange,
  type NationState,
  type UnrestContribution,
} from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import type { DomainEventEnvelope } from "@bluewave/events";
import { CURRENT_VERSION } from "./events.js";
import type { PhaseContext } from "./pipeline.js";

export type UnrestApplicationContext = Pick<
  PhaseContext,
  "snapshot" | "eventLedger" | "nextSeq" | "campaignMonth"
>;

export function unrestChangedEvent(
  nationId: string,
  reasonCode: string,
  before: number,
  after: number,
  rulesetVersion: string,
  seq: SafeInt,
  campaignMonth: string,
): DomainEventEnvelope {
  return {
    eventId: `UnrestChanged-${nationId}-${reasonCode}-${String(seq)}`,
    version: CURRENT_VERSION,
    aggregateType: "nation",
    aggregateId: nationId,
    eventType: "UnrestChanged",
    timestamp: `${campaignMonth}-01T00:00:00.000Z`,
    body: {
      kind: "UnrestChanged",
      nationId,
      reasonCode,
      before: SafeInt(before),
      after: SafeInt(after),
      delta: SafeInt(after - before),
      rulesetVersion,
    },
    sequenceNumber: seq,
  };
}

export function unrestConsequenceEvent(
  nationId: string,
  consequence: "STRIKE" | "REVOLUTION",
  unrest: number,
  rateBeforeBp: number,
  rateAfterBp: number,
  careerEnded: boolean,
  rulesetVersion: string,
  seq: SafeInt,
  campaignMonth: string,
): DomainEventEnvelope {
  return {
    eventId: `UnrestConsequence-${nationId}-${consequence}-${String(seq)}`,
    version: CURRENT_VERSION,
    aggregateType: "nation",
    aggregateId: nationId,
    eventType: "UnrestConsequence",
    timestamp: `${campaignMonth}-01T00:00:00.000Z`,
    body: {
      kind: "UnrestConsequence",
      nationId,
      consequence,
      unrest: SafeInt(unrest),
      rateBeforeBp: SafeInt(rateBeforeBp),
      rateAfterBp: SafeInt(rateAfterBp),
      careerEnded,
      rulesetVersion,
    },
    sequenceNumber: seq,
  };
}

export function applyUnrestContributions(
  ctx: UnrestApplicationContext,
  nationId: string,
  contributions: readonly UnrestContribution[],
): NationState | undefined {
  const nations = ctx.snapshot.read("nations");
  const nation = nations.get(nationId);
  if (nation === undefined) return undefined;
  if (contributions.length === 0) return nation;
  const updated = withUnrestChange(nation, ctx.campaignMonth, contributions);
  const next = new Map(nations);
  next.set(nationId, updated);
  ctx.snapshot.write("nations", next);
  const rulesetVersion = ctx.snapshot.read("rulesetVersion");
  let running = unrestOf(nation);
  for (const contribution of contributions) {
    const after = clampUnrest(running + contribution.delta);
    if (after !== running) {
      ctx.eventLedger.append(
        unrestChangedEvent(
          nationId,
          contribution.reasonCode,
          running,
          after,
          rulesetVersion,
          ctx.nextSeq(),
          ctx.campaignMonth,
        ),
      );
    }
    running = after;
  }
  return updated;
}
