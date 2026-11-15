import type { CampaignSnapshot, NationState, Ship, ShipReadinessState } from "@bluewave/campaign";
import {
  READINESS_SET_BY_COMMAND_REASON,
  STATION_ASSIGNED_REASON,
  STATION_CLEARED_BY_COMMAND_REASON,
  STATION_CLEARED_BY_READINESS_REASON,
  STATION_RETARGETED_REASON,
  readinessCommandProblems,
  setShipReadiness,
  stationAssignmentProblems,
  stationTargetFor,
  withStationAssignment,
} from "@bluewave/campaign";
import type {
  AssignForeignStationCommand,
  ClearForeignStationCommand,
  CommandBody,
  SetShipReadinessCommand,
} from "@bluewave/commands";
import type { SafeInt } from "@bluewave/contracts";
import type { DomainEventEnvelope } from "@bluewave/events";
import { shipReadinessChangedEvent, shipStationAssignmentChangedEvent } from "./events.js";
import type { PhaseContext } from "./pipeline.js";

const NO_ASSIGNMENT = "NONE";

export interface StationEventSink {
  readonly campaignMonth: string;
  readonly nextSeq: () => SafeInt;
  readonly append: (event: DomainEventEnvelope) => void;
}

function mapShip(
  snapshot: CampaignSnapshot,
  nationId: string,
  shipId: string,
  change: (ship: Ship) => Ship,
): CampaignSnapshot {
  const nation = snapshot["nations"].get(nationId);
  if (nation === undefined) return snapshot;
  const fleets = nation["fleets"].map((fleet) => ({
    ...fleet,
    ships: fleet["ships"].map((ship) => (ship["id"] === shipId ? change(ship) : ship)),
  }));
  const nations = new Map(snapshot["nations"]);
  nations.set(nationId, { ...nation, fleets } satisfies NationState);
  return { ...snapshot, nations };
}

export function transitionShipReadiness(
  snapshot: CampaignSnapshot,
  nationId: string,
  shipId: string,
  to: ShipReadinessState,
  reason: string,
  sink: StationEventSink,
): CampaignSnapshot {
  return mapShip(snapshot, nationId, shipId, (ship) => {
    if (ship["readiness"] === to) return ship;
    const result = setShipReadiness(ship, to);
    sink.append(
      shipReadinessChangedEvent(
        shipId,
        nationId,
        ship["readiness"],
        to,
        reason,
        ship["crewQuality"],
        sink.nextSeq(),
        sink.campaignMonth,
      ),
    );
    if (result.clearedAssignment) {
      sink.append(
        shipStationAssignmentChangedEvent(
          shipId,
          nationId,
          ship["stationAssignment"] ?? NO_ASSIGNMENT,
          NO_ASSIGNMENT,
          STATION_CLEARED_BY_READINESS_REASON,
          sink.nextSeq(),
          sink.campaignMonth,
        ),
      );
    }
    return result.ship;
  });
}

export function applyStationAssignmentCommand(ctx: PhaseContext, body: CommandBody): boolean {
  if (body["type"] !== "AssignForeignStation" && body["type"] !== "ClearForeignStation") {
    return false;
  }
  const command = body as AssignForeignStationCommand | ClearForeignStationCommand;
  const intent = body["type"] === "AssignForeignStation" ? "assign" : "clear";
  const nation = ctx.snapshot.current["nations"].get(command["nationId"]);
  if (nation === undefined) {
    ctx.collector.addError("NATION_NOT_FOUND", `Nation ${command["nationId"]} not found`, {
      stage: "command-collection",
    });
    return true;
  }
  const stationAreaId =
    command["type"] === "AssignForeignStation" ? command.stationAreaId : undefined;
  const problems = stationAssignmentProblems(
    nation,
    command["nationId"],
    command["shipIds"],
    intent,
    stationTargetFor(ctx.snapshot.current.world, command["nationId"], stationAreaId),
  );
  if (problems.length > 0) {
    ctx.collector.addError(
      "STATION_ASSIGNMENT_REJECTED",
      `Foreign-station ${intent} no longer applies: ${problems
        .map((p) => `${p.shipId || "<batch>"}=${p.reason}`)
        .join(", ")}`,
      { stage: "command-collection" },
    );
    return true;
  }
  const posted = new Set(
    nation["fleets"]
      .flatMap((fleet) => fleet["ships"])
      .filter((ship) => ship["stationAssignment"] === "FOREIGN_STATION")
      .map((ship) => ship["id"]),
  );
  const to = intent === "assign" ? "FOREIGN_STATION" : NO_ASSIGNMENT;
  for (const shipId of [...command["shipIds"]].sort()) {
    const retarget = intent === "assign" && posted.has(shipId);
    const from = intent === "clear" || retarget ? "FOREIGN_STATION" : NO_ASSIGNMENT;
    let reason: string = STATION_CLEARED_BY_COMMAND_REASON;
    if (intent === "assign")
      reason = retarget ? STATION_RETARGETED_REASON : STATION_ASSIGNED_REASON;
    ctx.snapshot.current = mapShip(ctx.snapshot.current, command["nationId"], shipId, (ship) =>
      withStationAssignment(ship, intent, stationAreaId),
    );
    ctx.eventLedger.append(
      shipStationAssignmentChangedEvent(
        shipId,
        command["nationId"],
        from,
        to,
        reason,
        ctx.nextSeq(),
        ctx.campaignMonth,
      ),
    );
  }
  return true;
}

export function applyShipReadinessCommand(ctx: PhaseContext, body: CommandBody): boolean {
  if (body["type"] !== "SetShipReadiness") return false;
  const command = body as SetShipReadinessCommand;
  const nation = ctx.snapshot.current["nations"].get(command["nationId"]);
  if (nation === undefined) {
    ctx.collector.addError("NATION_NOT_FOUND", `Nation ${command["nationId"]} not found`, {
      stage: "command-collection",
    });
    return true;
  }
  const problems = readinessCommandProblems(
    nation,
    command["nationId"],
    command["shipIds"],
    command["readiness"],
  );
  if (problems.length > 0) {
    ctx.collector.addError(
      "SHIP_READINESS_REJECTED",
      `Readiness change no longer applies: ${problems
        .map((p) => `${p.shipId || "<batch>"}=${p.reason}`)
        .join(", ")}`,
      { stage: "command-collection" },
    );
    return true;
  }
  const sink: StationEventSink = {
    campaignMonth: ctx.campaignMonth,
    nextSeq: () => ctx.nextSeq(),
    append: (event) => ctx.eventLedger.append(event),
  };
  for (const shipId of [...command["shipIds"]].sort()) {
    ctx.snapshot.current = transitionShipReadiness(
      ctx.snapshot.current,
      command["nationId"],
      shipId,
      command["readiness"],
      READINESS_SET_BY_COMMAND_REASON,
      sink,
    );
  }
  return true;
}
