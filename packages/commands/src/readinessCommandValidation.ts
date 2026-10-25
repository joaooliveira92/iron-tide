import type { CampaignSnapshot } from "@bluewave/campaign";
import { isCommandableReadiness, readinessCommandProblems } from "@bluewave/campaign";
import type { CommandBody, CommandEnvelope, SetShipReadinessCommand } from "./envelope.js";
import type { LifecycleStepResult } from "./types.js";
import { rejectValidation } from "./validation.js";

export const SHIP_READINESS_REJECTED = "SHIP_READINESS_REJECTED";

export function validateShipReadinessCommand(
  envelope: CommandEnvelope<CommandBody>,
  snapshot: CampaignSnapshot,
): LifecycleStepResult {
  const body = envelope.body as SetShipReadinessCommand;
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
  if (!isCommandableReadiness(body.readiness))
    return rejectValidation(
      envelope,
      snapshot,
      "INVALID_COMMAND_PAYLOAD",
      "readiness must be ACTIVE, RESERVE or MOTHBALLED",
    );
  const problems = readinessCommandProblems(nation, body.nationId, body.shipIds, body.readiness);
  if (problems.length === 0) return { ok: true };
  const detail = problems.map((p) => `${p.shipId || "<batch>"}=${p.reason}`).join(", ");
  return rejectValidation(
    envelope,
    snapshot,
    SHIP_READINESS_REJECTED,
    `Readiness change to ${body.readiness} rejected: ${detail}`,
  );
}
