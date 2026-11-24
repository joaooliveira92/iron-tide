import {
  heavilyDamagedDisposition,
  type InternmentCause,
  type RaiderInterceptionRules,
  type Ship,
} from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import type { DomainEventEnvelope } from "@bluewave/events";
import type { PhaseContext } from "./pipeline.js";

export const STREAM_DISPOSITION = "trade/disposition";
export const RAIDER_DISPOSITION_REASON = "RAIDER_DISPOSITION";

const DRAW_RANGE_BP = 10_000;
const EVENT_VERSION = "0.1.0" as const;

type EventBody = DomainEventEnvelope["body"];

export type RaiderDraw = (
  stream: string,
  entityKey: string,
  chanceBp: number,
  reasonCode: string,
  outcome: (value: number) => string,
  inputs: Readonly<Record<string, unknown>>,
) => number;

export function createRaiderDraw(ctx: PhaseContext, phase: string): RaiderDraw {
  const engine = ctx.rng.engine();
  const rulesetVersion = ctx.snapshot.read("rulesetVersion");
  return (stream, entityKey, chanceBp, reasonCode, outcome, inputs) => {
    const value = Math.floor(engine.stream(`${stream}/${entityKey}`).next() * DRAW_RANGE_BP);
    ctx.randomLedger.record({
      streamId: stream,
      entityKey,
      phase,
      rulesetVersion,
      inputHash: sha256Hex(canonicalSerialize({ entityKey, chanceBp, ...inputs })),
      draw: value,
      outcome: outcome(value),
      reasonCode,
    });
    return value;
  };
}

export function raiderEnvelope(
  eventType: "RaiderEngaged" | "RaiderInterned" | "RaiderReleased",
  nationId: string,
  shipId: string,
  month: string,
  seq: SafeInt,
  body: EventBody,
): DomainEventEnvelope {
  return {
    eventId: `${eventType}-${shipId}-${String(seq)}`,
    version: EVENT_VERSION,
    aggregateType: "nation",
    aggregateId: nationId,
    eventType,
    timestamp: `${month}-01T00:00:00.000Z`,
    body,
    sequenceNumber: seq,
  };
}

export function raiderInternedEvent(
  nationId: string,
  shipId: string,
  month: string,
  seq: SafeInt,
  cause: InternmentCause,
): DomainEventEnvelope {
  return raiderEnvelope("RaiderInterned", nationId, shipId, month, seq, {
    kind: "RaiderInterned",
    nationId,
    shipId,
    month,
    cause,
  });
}

export function internedShip(ship: Ship, month: string, cause: InternmentCause): Ship {
  const { stationAssignment: _assignment, ...rest } = ship;
  return {
    ...rest,
    readiness: "MOTHBALLED",
    internment: { sinceMonth: month, cause, readinessBefore: ship.readiness },
  };
}

export function drawHeavyDamageDisposition(
  draw: RaiderDraw,
  rules: RaiderInterceptionRules,
  entityKey: string,
  hitPointsAfter: number,
): "SCUTTLED" | "INTERNED" {
  return heavilyDamagedDisposition(
    rules,
    draw(
      STREAM_DISPOSITION,
      entityKey,
      rules.scuttleShareBp,
      RAIDER_DISPOSITION_REASON,
      (value) => heavilyDamagedDisposition(rules, value),
      { hitPointsAfter },
    ),
  );
}
