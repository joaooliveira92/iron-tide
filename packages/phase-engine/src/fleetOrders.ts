import {
  describeFleetMoveProblem,
  fleetMoveProblem,
  relocateFleet,
  type CampaignSnapshot,
} from "@bluewave/campaign";
import type { MoveFleetCommand } from "@bluewave/commands";
import type { DiagnosticCollector } from "@bluewave/diagnostics";

export function applyMoveFleet(
  currentSnapshot: CampaignSnapshot,
  body: MoveFleetCommand,
  collector: DiagnosticCollector,
): CampaignSnapshot {
  const problem = fleetMoveProblem(
    currentSnapshot,
    body["nationId"],
    body["fleetId"],
    body["toAreaId"],
  );
  if (problem !== null) {
    collector.addError(problem.code, describeFleetMoveProblem(problem), {
      stage: "command_collection",
    });
    return currentSnapshot;
  }
  return relocateFleet(currentSnapshot, body["nationId"], body["fleetId"], body["toAreaId"]);
}
