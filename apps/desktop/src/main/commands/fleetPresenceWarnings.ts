import { buildPresenceWarnings, type PresenceWarningView } from "@bluewave/campaign-engine";
import type { PresenceMeasurementRules } from "@bluewave/campaign";
import type { CampaignSessionRecord } from "../campaignSessions.js";
import type { PendingCommandEntry } from "../runtime/commandQueue.js";

export function queuedPresenceWarnings(
  record: CampaignSessionRecord,
  entries: readonly PendingCommandEntry[],
  rules: PresenceMeasurementRules | undefined,
): readonly PresenceWarningView[] {
  if (rules === undefined) return [];
  return buildPresenceWarnings(
    record.state.snapshot,
    record.playerSlotId,
    entries.map((entry) => ({ commandId: entry.envelope.commandId, body: entry.envelope.body })),
    record.month,
    rules,
  );
}
