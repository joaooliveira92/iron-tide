import type { CampaignSnapshot } from "@bluewave/campaign";
import { stationAssignmentProblems, stationTargetFor } from "@bluewave/campaign";
import type {
  AssignForeignStationCommand,
  ClearForeignStationCommand,
  CommandBody,
  CommandEnvelope,
} from "./envelope.js";
import type { LifecycleStepResult } from "./types.js";
import { rejectValidation } from "./validation.js";

export const STATION_ASSIGNMENT_REJECTED = "STATION_ASSIGNMENT_REJECTED";

export function validateStationAssignment(
  envelope: CommandEnvelope<CommandBody>,
  snapshot: CampaignSnapshot,
  intent: "assign" | "clear",
): LifecycleStepResult {
  const body = envelope.body as AssignForeignStationCommand | ClearForeignStationCommand;
  const nation = snapshot["nations"].get(body.nationId);
  if (nation === undefined)
    return rejectValidation(
      envelope,
      snapshot,
      "NATION_NOT_FOUND",
      `Nation ${String(body.nationId)} not found`,
    );
  if (!Array.isArray(body.shipIds) || body.shipIds.some((id) => typeof id !== "string"))
    return rejectValidation(
      envelope,
      snapshot,
      "INVALID_COMMAND_PAYLOAD",
      "shipIds must be an array of ship ids",
    );
  const stationAreaId = "stationAreaId" in body ? body.stationAreaId : undefined;
  if (stationAreaId !== undefined && typeof stationAreaId !== "string")
    return rejectValidation(
      envelope,
      snapshot,
      "INVALID_COMMAND_PAYLOAD",
      "stationAreaId must be an area id",
    );
  const problems = stationAssignmentProblems(
    nation,
    body.nationId,
    body.shipIds,
    intent,
    stationTargetFor(snapshot.world, body.nationId, stationAreaId),
  );
  if (problems.length === 0) return { ok: true };
  const detail = problems.map((p) => `${p.shipId || "<batch>"}=${p.reason}`).join(", ");
  return rejectValidation(
    envelope,
    snapshot,
    STATION_ASSIGNMENT_REJECTED,
    `Foreign-station ${intent} rejected: ${detail}`,
  );
}
