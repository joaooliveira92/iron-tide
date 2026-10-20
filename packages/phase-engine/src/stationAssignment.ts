// S-5 (spec #73 R1/R2): the month's application of the foreign-station commands, and the single seam through which a
// ship's readiness leaves ACTIVE (clearing the assignment with a typed event). Value-free: no routing (S-5 07), no
// presence maths, no maintenance change — an FS ship keeps its ACTIVE readiness, crew and maintenance.
import type { CampaignSnapshot, NationState, Ship, ShipReadinessState } from "@bluewave/campaign";
import {
  STATION_ASSIGNED_REASON,
  STATION_CLEARED_BY_COMMAND_REASON,
  STATION_CLEARED_BY_READINESS_REASON,
  setShipReadiness,
  stationAssignmentProblems,
  withStationAssignment,
} from "@bluewave/campaign";
import type {
  AssignForeignStationCommand,
  ClearForeignStationCommand,
  CommandBody,
} from "@bluewave/commands";
import type { SafeInt } from "@bluewave/contracts";
import type { DomainEventEnvelope } from "@bluewave/events";
import { shipReadinessChangedEvent, shipStationAssignmentChangedEvent } from "./events.js";
import type { MonthContext } from "./monthContext.js";

const NO_ASSIGNMENT = "NONE";

/** Where the seam records its events; `MonthContext` satisfies it. */
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

/**
 * Change a ship's readiness through the shared seam. Records `ShipReadinessChanged`, and one
 * `ShipStationAssignmentChanged` (`READINESS_LEFT_ACTIVE`) when the change removed an assignment. A change to the
 * state the ship already has is a no-op.
 */
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

/**
 * Apply an assign or clear command. Commands are authorized against the month-start snapshot but applied in order, so
 * the batch is re-checked against the snapshot being applied: a stale batch (for example a second assignment of the
 * same ship) is refused whole and changes nothing.
 */
export function applyStationAssignmentCommand(ctx: MonthContext, body: CommandBody): boolean {
  if (body["type"] !== "AssignForeignStation" && body["type"] !== "ClearForeignStation") {
    return false;
  }
  const command = body as AssignForeignStationCommand | ClearForeignStationCommand;
  const intent = body["type"] === "AssignForeignStation" ? "assign" : "clear";
  const nation = ctx.currentSnapshot["nations"].get(command["nationId"]);
  if (nation === undefined) {
    ctx.collector.addError("NATION_NOT_FOUND", `Nation ${command["nationId"]} not found`, {
      stage: "command-collection",
    });
    return true;
  }
  const problems = stationAssignmentProblems(
    nation,
    command["nationId"],
    command["shipIds"],
    intent,
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
  const from = intent === "assign" ? NO_ASSIGNMENT : "FOREIGN_STATION";
  const to = intent === "assign" ? "FOREIGN_STATION" : NO_ASSIGNMENT;
  const reason = intent === "assign" ? STATION_ASSIGNED_REASON : STATION_CLEARED_BY_COMMAND_REASON;
  for (const shipId of [...command["shipIds"]].sort()) {
    ctx.currentSnapshot = mapShip(ctx.currentSnapshot, command["nationId"], shipId, (ship) =>
      withStationAssignment(ship, intent),
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
