import { TERMINAL_STATUSES, type CommandRecord } from "@bluewave/commands";
import type { ConstructionCommandStatus } from "@bluewave/campaign-engine";

export function isTerminal(record: CommandRecord): boolean {
  return TERMINAL_STATUSES.has(record.status);
}

export function uiStatusFor(record: CommandRecord): ConstructionCommandStatus {
  switch (record.status) {
    case "SUPERSEDED":
      return "superseded";
    case "CANCELLED":
      return "cancelled";
    default:
      return "submitted";
  }
}
