import type { MonthlyReportConstruction } from "../../../../shared/reports-contract.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";

export function MonthReportConstructionSection({
  construction,
}: {
  readonly construction: MonthlyReportConstruction;
}) {
  const format = usePresentationFormat();
  const quiet =
    construction.projects.length === 0 &&
    construction.completedShips.length === 0 &&
    construction.newlyActiveProjectIds.length === 0;
  if (quiet) {
    return (
      <section aria-label="Construction">
        <p className="font-medium">Construction</p>
        <p className="text-muted-foreground">No construction activity this month.</p>
      </section>
    );
  }

  return (
    <section aria-label="Construction" className="space-y-1">
      <p className="font-medium">Construction</p>
      {construction.projects.length > 0 && (
        <ul className="text-muted-foreground" aria-label="Construction progress">
          {construction.projects.map((project) => (
            <li key={project.projectId}>
              {project.projectId}: work {format.count(project.previousWork)} →{" "}
              {format.count(project.newWork)}
            </li>
          ))}
        </ul>
      )}
      {construction.newlyActiveProjectIds.length > 0 && (
        <p className="text-muted-foreground">
          Newly active: {construction.newlyActiveProjectIds.join(", ")}
        </p>
      )}
      {construction.completedShips.length > 0 && (
        <p className="text-muted-foreground">
          Completed: {construction.completedShips.map((ship) => ship.name).join(", ")}
        </p>
      )}
    </section>
  );
}
