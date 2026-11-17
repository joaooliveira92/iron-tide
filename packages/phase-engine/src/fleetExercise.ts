import {
  completeFleetExercise,
  exerciseLimitReached,
  exerciseMonthAfter,
  exerciseProblems,
  FLEET_EXERCISE_DORMANT,
  FLEET_EXERCISE_LIMIT_REACHED,
  FLEET_EXERCISE_REJECTED,
  scheduleFleetExercise,
  type NationState,
} from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import type { DomainEventEnvelope } from "@bluewave/events";
import type { CommandBody, HoldFleetExerciseCommand } from "@bluewave/commands";
import type { PhaseContext } from "./pipeline.js";

const EXERCISE_EVENT_VERSION = "0.1.0" as const;

export function fleetExerciseScheduledEvent(
  nationId: string,
  month: string,
  shipIds: readonly string[],
  seq: SafeInt,
  campaignMonth: string,
): DomainEventEnvelope {
  return {
    eventId: `FleetExerciseScheduled-${nationId}-${String(seq)}`,
    version: EXERCISE_EVENT_VERSION,
    aggregateType: "nation",
    aggregateId: nationId,
    eventType: "FleetExerciseScheduled",
    timestamp: `${campaignMonth}-01T00:00:00.000Z`,
    body: {
      kind: "FleetExerciseScheduled",
      nationId,
      month,
      shipIds: [...shipIds],
    },
    sequenceNumber: seq,
  };
}

export function fleetExerciseCompletedEvent(
  nationId: string,
  month: string,
  shipIds: readonly string[],
  experienceGained: number,
  seq: SafeInt,
  campaignMonth: string,
): DomainEventEnvelope {
  return {
    eventId: `FleetExerciseCompleted-${nationId}-${String(seq)}`,
    version: EXERCISE_EVENT_VERSION,
    aggregateType: "nation",
    aggregateId: nationId,
    eventType: "FleetExerciseCompleted",
    timestamp: `${campaignMonth}-01T00:00:00.000Z`,
    body: {
      kind: "FleetExerciseCompleted",
      nationId,
      month,
      shipIds: [...shipIds],
      experienceGained: SafeInt(experienceGained),
    },
    sequenceNumber: seq,
  };
}

export function exerciseTensionRaisedEvent(
  nationId: string,
  otherNationId: string,
  before: number,
  after: number,
  seq: SafeInt,
  campaignMonth: string,
): DomainEventEnvelope {
  return {
    eventId: `ExerciseTensionRaised-${nationId}-${otherNationId}-${String(seq)}`,
    version: EXERCISE_EVENT_VERSION,
    aggregateType: "nation",
    aggregateId: nationId,
    eventType: "ExerciseTensionRaised",
    timestamp: `${campaignMonth}-01T00:00:00.000Z`,
    body: {
      kind: "ExerciseTensionRaised",
      nationId,
      otherNationId,
      before: SafeInt(before),
      after: SafeInt(after),
      delta: SafeInt(after - before),
    },
    sequenceNumber: seq,
  };
}

const byId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export function applyFleetExerciseCommand(ctx: PhaseContext, body: CommandBody): boolean {
  if (body["type"] !== "HoldFleetExercise") return false;
  const command = body as HoldFleetExerciseCommand;
  const refuse = (code: string, message: string) =>
    ctx.collector.addError(code, message, {
      stage: "command-collection",
      entityId: command["nationId"],
    });

  const rules = ctx.fleetManagement?.exercise;
  if (rules === undefined) {
    refuse(
      FLEET_EXERCISE_DORMANT,
      "Fleet exercises are not available: the section is not authored",
    );
    return true;
  }
  const nation = ctx.snapshot.current["nations"].get(command["nationId"]);
  if (nation === undefined) return true;

  const held = exerciseMonthAfter(ctx.campaignMonth);
  if (exerciseLimitReached(nation["fleetExercise"], held.year, rules)) {
    refuse(
      FLEET_EXERCISE_LIMIT_REACHED,
      `${command["nationId"]} has already held its fleet exercise for ${held.year}`,
    );
    return true;
  }
  const problems = exerciseProblems(nation, command["nationId"], command["shipIds"]);
  if (problems.length > 0) {
    refuse(
      FLEET_EXERCISE_REJECTED,
      `Fleet exercise rejected: ${problems.map((p) => `${p.shipId}=${p.reason}`).join(", ")}`,
    );
    return true;
  }
  const nations = new Map(ctx.snapshot.current["nations"]);
  nations.set(
    command["nationId"],
    scheduleFleetExercise(nation, command["shipIds"], ctx.campaignMonth, rules),
  );
  ctx.snapshot.current = { ...ctx.snapshot.current, nations };
  ctx.eventLedger.append(
    fleetExerciseScheduledEvent(
      command["nationId"],
      held.month,
      [...command["shipIds"]].sort(byId),
      ctx.nextSeq(),
      ctx.campaignMonth,
    ),
  );
  return true;
}

export function completeFleetExerciseForMonth(ctx: PhaseContext): void {
  const rules = ctx.fleetManagement;
  if (rules === undefined) return;

  let changed = false;
  const updated = new Map<string, NationState>();
  const nationIds = [...ctx.snapshot.read("nations").keys()].sort(byId);
  for (const nationId of nationIds) {
    const nation = ctx.snapshot.read("nations").get(nationId)!;
    const record = nation["fleetExercise"];
    const completed = completeFleetExercise(
      nation,
      ctx.campaignMonth,
      rules.divisionExperience.perExercise,
    );
    if (completed !== nation) changed = true;
    if (record !== undefined && record.month === ctx.campaignMonth) {
      ctx.eventLedger.append(
        fleetExerciseCompletedEvent(
          nationId,
          record.month,
          record.shipIds,
          rules.divisionExperience.perExercise,
          ctx.nextSeq(),
          ctx.campaignMonth,
        ),
      );
    }
    updated.set(nationId, completed);
  }
  if (changed) ctx.snapshot.write("nations", updated);
}
