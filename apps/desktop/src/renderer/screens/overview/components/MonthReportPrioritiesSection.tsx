import type { StrategicPriority } from "@bluewave/campaign-engine";
import { comparePriorities } from "../month-report-format.js";

export function MonthReportPrioritiesSection({
  priorities,
  previousPriorities,
}: {
  readonly priorities: readonly StrategicPriority[];
  readonly previousPriorities: readonly StrategicPriority[];
}) {
  if (priorities.length === 0 && previousPriorities.length === 0) {
    return (
      <section aria-label="Priorities">
        <p className="font-medium">Priorities</p>
        <p className="text-muted-foreground">No immediate priorities this month.</p>
      </section>
    );
  }

  const { created, resolved, continuing } = comparePriorities(priorities, previousPriorities);

  return (
    <section aria-label="Priorities" className="space-y-1">
      <p className="font-medium">Priorities</p>
      <p className="text-muted-foreground">
        {created.length} new · {resolved.length} resolved · {continuing.length} continuing
      </p>
      {created.length > 0 && (
        <ul aria-label="New priorities">
          {created.map((priority) => (
            <li key={priority.fingerprint}>{priority.title}</li>
          ))}
        </ul>
      )}
      {resolved.length > 0 && (
        <ul aria-label="Resolved priorities">
          {resolved.map((priority) => (
            <li key={priority.fingerprint}>{priority.title}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
