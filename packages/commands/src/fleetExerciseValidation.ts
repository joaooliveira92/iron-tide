import type { CampaignSnapshot } from "@bluewave/campaign";
import { exerciseProblems, FLEET_EXERCISE_REJECTED } from "@bluewave/campaign";
import type { CommandBody, CommandEnvelope, HoldFleetExerciseCommand } from "./envelope.js";
import type { LifecycleStepResult } from "./types.js";
import { rejectValidation } from "./validation.js";

export function validateFleetExercise(
  envelope: CommandEnvelope<CommandBody>,
  snapshot: CampaignSnapshot,
): LifecycleStepResult {
  const body = envelope.body as HoldFleetExerciseCommand;
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
  const problems = exerciseProblems(nation, body.nationId, body.shipIds);
  if (problems.length === 0) return { ok: true };
  const detail = problems.map((p) => `${p.shipId || "<batch>"}=${p.reason}`).join(", ");
  return rejectValidation(
    envelope,
    snapshot,
    FLEET_EXERCISE_REJECTED,
    `Fleet exercise rejected: ${detail}`,
  );
}
