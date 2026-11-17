import {
  monthId,
  presenceAfterOrders,
  type PresenceMeasurementRules,
  type PresenceOrder,
  type PresenceWarningSnapshot,
} from "@bluewave/campaign";
import type { CommandBody } from "@bluewave/commands";
import type { ExplanationTree } from "@bluewave/events";
import { explainPresenceShortfall } from "./fleet-explanations.js";
import type { PlayerProjectionMonth } from "./projection.js";

export interface PresenceWarningView {
  readonly areaId: string;
  readonly requiredTons: number;
  readonly presentTonsBefore: number;
  readonly presentTonsAfter: number;
  readonly shortfallBefore: number;
  readonly shortfallAfter: number;
  readonly causeCommandIds: readonly string[];
  readonly explanation: ExplanationTree;
}

export interface QueuedPresenceCommand {
  readonly commandId: string;
  readonly body: CommandBody;
}

export function presenceOrderFromCommand(
  body: CommandBody,
  nationId: string,
): PresenceOrder | undefined {
  switch (body.type) {
    case "MoveFleet":
      return body.nationId === nationId
        ? {
            type: "MOVE_FLEET",
            fleetId: body.fleetId,
            toAreaId: body.toAreaId,
            ...(body.shipIds === undefined ? {} : { shipIds: body.shipIds }),
          }
        : undefined;
    case "SetShipReadiness":
      return body.nationId === nationId
        ? { type: "SET_READINESS", shipIds: body.shipIds, readiness: body.readiness }
        : undefined;
    case "AssignForeignStation":
      return body.nationId === nationId
        ? {
            type: "ASSIGN_STATION",
            shipIds: body.shipIds,
            ...(body.stationAreaId === undefined ? {} : { stationAreaId: body.stationAreaId }),
          }
        : undefined;
    case "ClearForeignStation":
      return body.nationId === nationId
        ? { type: "CLEAR_STATION", shipIds: body.shipIds }
        : undefined;
    case "HoldFleetExercise":
      return body.nationId === nationId
        ? { type: "HOLD_EXERCISE", shipIds: body.shipIds }
        : undefined;
    default:
      return undefined;
  }
}

export function buildPresenceWarnings(
  snapshot: PresenceWarningSnapshot,
  nationId: string,
  queued: readonly QueuedPresenceCommand[],
  month: PlayerProjectionMonth,
  rules: PresenceMeasurementRules,
): readonly PresenceWarningView[] {
  const orders: PresenceOrder[] = [];
  const commandIds: string[] = [];
  for (const command of queued) {
    const order = presenceOrderFromCommand(command.body, nationId);
    if (order === undefined) continue;
    orders.push(order);
    commandIds.push(command.commandId);
  }
  if (orders.length === 0) return [];
  const result = presenceAfterOrders(
    snapshot,
    nationId,
    orders,
    rules,
    monthId(month.year, month.month),
  );
  return result.warnings.map((warning) => ({
    areaId: warning.areaId,
    requiredTons: warning.requiredTons,
    presentTonsBefore: warning.presentTonsBefore,
    presentTonsAfter: warning.presentTonsAfter,
    shortfallBefore: warning.shortfallBefore,
    shortfallAfter: warning.shortfallAfter,
    causeCommandIds: warning.causes.map((index) => commandIds[index]!),
    explanation: explainPresenceShortfall(
      warning.requiredTons,
      warning.presentTonsAfter,
      false,
      warning.shortfallAfter,
    ),
  }));
}
