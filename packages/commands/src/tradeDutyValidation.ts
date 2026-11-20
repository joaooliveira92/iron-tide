import type { CampaignSnapshot } from "@bluewave/campaign";
import { TRADE_DUTIES, TRADE_DUTY_REJECTED, tradeDutyProblems } from "@bluewave/campaign";
import type { CommandBody, CommandEnvelope, SetTradeDutyCommand } from "./envelope.js";
import type { LifecycleStepResult } from "./types.js";
import { rejectValidation } from "./validation.js";

export function validateTradeDuty(
  envelope: CommandEnvelope<CommandBody>,
  snapshot: CampaignSnapshot,
): LifecycleStepResult {
  const body = envelope.body as SetTradeDutyCommand;
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
  if (!TRADE_DUTIES.includes(body.duty))
    return rejectValidation(
      envelope,
      snapshot,
      "INVALID_COMMAND_PAYLOAD",
      "duty must be TRADE_PROTECTION, RAIDER or NONE",
    );
  const problems = tradeDutyProblems(nation, body.nationId, body.shipIds, body.duty);
  if (problems.length === 0) return { ok: true };
  const detail = problems.map((p) => `${p.shipId || "<batch>"}=${p.reason}`).join(", ");
  return rejectValidation(
    envelope,
    snapshot,
    TRADE_DUTY_REJECTED,
    `Trade duty ${body.duty} rejected: ${detail}`,
  );
}
