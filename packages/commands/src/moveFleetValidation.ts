import {
  describeFleetMoveProblem,
  fleetMoveProblem,
  type CampaignSnapshot,
} from "@bluewave/campaign";
import type { CommandBody, CommandEnvelope, MoveFleetCommand } from "./envelope.js";
import type { LifecycleStepResult } from "./types.js";
import { rejectValidation } from "./validation.js";

export function validateMoveFleet(
  envelope: CommandEnvelope<CommandBody>,
  snapshot: CampaignSnapshot,
): LifecycleStepResult {
  const move = envelope.body as MoveFleetCommand;
  const problem = fleetMoveProblem(
    snapshot,
    move.nationId,
    move.fleetId,
    move.toAreaId,
    move.shipIds,
  );
  return problem === null
    ? { ok: true }
    : rejectValidation(envelope, snapshot, problem.code, describeFleetMoveProblem(problem));
}
