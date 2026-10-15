import type { WideTelemetryEvent } from "../../../lib/telemetry.js";
import type { CompiledRecord, OutcomeFilter } from "../types.js";

export function filterRecords(
  records: readonly CompiledRecord[],
  searchTerm: string,
): readonly CompiledRecord[] {
  const term = searchTerm.toLowerCase();
  return records.filter(
    (record) => record.id.toLowerCase().includes(term) || record.kind.toLowerCase().includes(term),
  );
}

export function filterEvents(
  events: readonly WideTelemetryEvent[],
  searchTerm: string,
  outcomeFilter: OutcomeFilter,
): readonly WideTelemetryEvent[] {
  const term = searchTerm.toLowerCase();
  return events.filter(
    (event) =>
      (outcomeFilter === "all" || event.outcome === outcomeFilter) &&
      event.action.toLowerCase().includes(term),
  );
}
