import type { MonthlyReportResearch } from "../../../../shared/reports-contract.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";

export function MonthReportResearchSection({
  research,
}: {
  readonly research: MonthlyReportResearch;
}) {
  const format = usePresentationFormat();
  const quiet = research.progress.length === 0 && research.discoveries.length === 0;
  if (quiet) {
    return (
      <section aria-label="Research">
        <p className="font-medium">Research</p>
        <p className="text-muted-foreground">No research activity this month.</p>
      </section>
    );
  }

  return (
    <section aria-label="Research" className="space-y-1">
      <p className="font-medium">Research</p>
      {research.progress.length > 0 && (
        <ul className="text-muted-foreground" aria-label="Research progress">
          {research.progress.map((entry) => (
            <li key={entry.techId}>
              {entry.techId}: {format.count(entry.previousPoints)} → {format.count(entry.newPoints)}
            </li>
          ))}
        </ul>
      )}
      {research.discoveries.length > 0 && (
        <ul className="text-muted-foreground" aria-label="Discoveries">
          {research.discoveries.map((discovery) => (
            <li key={discovery.techId}>
              Discovered {discovery.techId} ({discovery.researchFieldId})
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
