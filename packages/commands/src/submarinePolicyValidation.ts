import type { CampaignSnapshot } from "@bluewave/campaign";
import { isSubmarinePolicy } from "@bluewave/campaign";
import type { CommandBody, CommandEnvelope, SetSubmarinePolicyCommand } from "./envelope.js";
import type { LifecycleStepResult } from "./types.js";
import { rejectValidation } from "./validation.js";

export function validateSubmarinePolicy(
  envelope: CommandEnvelope<CommandBody>,
  snapshot: CampaignSnapshot,
): LifecycleStepResult {
  const body = envelope.body as SetSubmarinePolicyCommand;
  if (!snapshot["nations"].has(body.nationId))
    return rejectValidation(
      envelope,
      snapshot,
      "NATION_NOT_FOUND",
      `Nation ${String(body.nationId)} not found`,
    );
  if (!isSubmarinePolicy(body.policy))
    return rejectValidation(
      envelope,
      snapshot,
      "INVALID_COMMAND_PAYLOAD",
      "policy must be PRIZE_RULES or UNRESTRICTED",
    );
  return { ok: true };
}
