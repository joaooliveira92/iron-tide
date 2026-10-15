import { TERMINAL_STATUSES, type CommandRecord } from "@bluewave/commands";
import type { ConstructionCommandStatus } from "@bluewave/campaign-engine";

/**
 * The one mapping between the command machinery's statuses and the Construction
 * screen's four-way UI status, plus the terminal-status predicate. Dependency-
 * free (only the two status vocabularies), so the workspace domain
 * (`construction/commandRecord.ts`, `construction/view.ts`) and this folder's
 * UI-projection module can share it without coupling. Terminality reuses the
 * machinery's own canonical `TERMINAL_STATUSES` rather than a private copy.
 */

export function isTerminal(record: CommandRecord): boolean {
  return TERMINAL_STATUSES.has(record.status);
}

/** Map a `CommandRecord`'s machinery status onto the screen's four-way UI status. */
export function uiStatusFor(record: CommandRecord): ConstructionCommandStatus {
  switch (record.status) {
    case "SUPERSEDED":
      return "superseded";
    case "CANCELLED":
      return "cancelled";
    default:
      // SUBMITTED..ACCEPTED (and the mid-pipeline LOCKED/RESOLVING) are all
      // "in flight" for the UI: the Command Ledger shows submit/replace/cancel
      // actions only for these.
      return "submitted";
  }
}
