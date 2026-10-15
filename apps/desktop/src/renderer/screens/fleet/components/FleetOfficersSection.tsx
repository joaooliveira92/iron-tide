import type { DivisionView } from "@bluewave/campaign-engine";
import { officerRows } from "../fleet-sections-state.js";

/** Division commanders (ADR-0065). Assigning officers is not offered here yet. */
export function FleetOfficersSection({
  divisions,
}: {
  readonly divisions: readonly DivisionView[];
}) {
  if (divisions.length === 0) {
    return <p className="text-sm text-muted-foreground">No divisions to command yet.</p>;
  }
  return (
    <ul className="space-y-1 text-sm" aria-label="Division commanders">
      {officerRows(divisions).map((row) => (
        <li key={row.divisionId} className="flex flex-wrap gap-x-2">
          <span className="font-medium">{row.divisionLabel}</span>
          {row.officer === null ? (
            <span className="text-muted-foreground">Commander vacant</span>
          ) : (
            <span className="text-muted-foreground">
              {row.rankLabel} {row.officer} · command rating {row.skill}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
