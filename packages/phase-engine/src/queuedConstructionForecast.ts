import { campaignMonthId, type CampaignSnapshot } from "@bluewave/campaign";
import type { CommandBody, CommandEnvelope } from "@bluewave/commands";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import type { ShipBuildingContent } from "@bluewave/ship-design";
import { applyOrderConstruction } from "./commands.js";

export function snapshotWithQueuedConstruction(
  snapshot: CampaignSnapshot,
  queued: readonly CommandEnvelope<CommandBody>[],
  content: ShipBuildingContent | undefined,
): CampaignSnapshot {
  const month = campaignMonthId(snapshot.startYear, snapshot.startMonth, snapshot.turnNumber);
  const collector = new DiagnosticCollector();
  return queued.reduce(
    (current, envelope) =>
      envelope.body.type === "OrderConstruction"
        ? applyOrderConstruction(
            current,
            envelope.body,
            envelope.commandId,
            content,
            month,
            collector,
          )
        : current,
    snapshot,
  );
}
