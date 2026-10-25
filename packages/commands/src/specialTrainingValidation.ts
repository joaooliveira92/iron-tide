import type { CampaignSnapshot } from "@bluewave/campaign";
import { TRAINING_SUBJECTS, trainingRefusal } from "@bluewave/campaign";
import type { CommandBody, CommandEnvelope, SetSpecialTrainingCommand } from "./envelope.js";
import type { LifecycleStepResult } from "./types.js";
import { rejectValidation } from "./validation.js";

export function validateSpecialTraining(
  envelope: CommandEnvelope<CommandBody>,
  snapshot: CampaignSnapshot,
): LifecycleStepResult {
  const body = envelope.body as SetSpecialTrainingCommand;
  if (snapshot["nations"].get(body.nationId) === undefined)
    return rejectValidation(
      envelope,
      snapshot,
      "NATION_NOT_FOUND",
      `Nation ${String(body.nationId)} not found`,
    );
  if (!Array.isArray(body.subjects))
    return rejectValidation(
      envelope,
      snapshot,
      "INVALID_COMMAND_PAYLOAD",
      "subjects must be an array of training subjects",
    );
  const refusal = trainingRefusal(body.subjects, { maxSubjects: TRAINING_SUBJECTS.length });
  if (refusal !== null)
    return rejectValidation(
      envelope,
      snapshot,
      refusal,
      "subjects must be distinct, known training subjects",
    );
  return { ok: true };
}
