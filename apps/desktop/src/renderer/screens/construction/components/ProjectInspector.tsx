import { memo } from "react";
import { Badge } from "../../../components/ui/badge.js";
import { Progress } from "../../../components/ui/progress.js";
import { cn } from "../../../lib/utils.js";
import type { ProjectRow } from "../project-progress.js";
import { packageStateText } from "./PackagePipeline.js";
import { ProjectReadout } from "./ProjectReadout.js";
import { ProjectSteering, type ProjectSteeringProps } from "./ProjectSteering.js";
import { StatusChip } from "./StatusChip.js";

export interface ProjectInspectorProps extends Omit<ProjectSteeringProps, "row"> {
  readonly row: ProjectRow | null;
}

export const ProjectInspector = memo(function ProjectInspector({
  row,
  ...steering
}: ProjectInspectorProps) {
  if (row === null) {
    return (
      <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        Select a ship on the slipways to see its schedule and steer its build.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold leading-tight">{row.className}</h3>
          <StatusChip status={row.status} />
          {row.isForeign && <Badge variant="outline">foreign yard</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">
          {row.shipType}
          {row.yard !== null ? ` · ${row.yard}` : ""}
          {row.holdUntilMonth !== null ? ` · on hold until ${row.holdUntilMonth}` : ""}
        </p>
        <div className="flex items-center gap-3">
          <Progress value={row.percent} aria-label={`${row.className} build progress`} />
          <span className="font-mono text-sm font-semibold tabular-nums">{row.percent}%</span>
        </div>
      </div>

      {row.isForeign ? (
        <p className="text-xs text-muted-foreground">
          This hull follows its foreign contract schedule, so it cannot be halted, accelerated or
          cancelled from here.
        </p>
      ) : (
        <ProjectSteering row={row} {...steering} />
      )}

      <section className="space-y-2">
        <h4 className="text-sm font-medium">Cost and schedule</h4>
        <ProjectReadout row={row} className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs" />
      </section>

      {row.packages.length > 0 && (
        <section className="space-y-2">
          <h4 className="text-sm font-medium">Work packages</h4>
          <p className="text-xs text-muted-foreground">
            A package starts when what it depends on is done, and the yard can only do so much work
            each month.
          </p>
          <ul aria-label={`${row.className} package detail`} className="space-y-1.5">
            {row.packages.map((pkg) => (
              <li key={pkg.id} className="space-y-1 rounded-md border p-2">
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="font-medium">{pkg.label}</span>
                  <span
                    className={cn(
                      "tabular-nums",
                      pkg.state === "done" ? "text-success" : "text-muted-foreground",
                    )}
                  >
                    {packageStateText(pkg)}
                  </span>
                </div>
                <Progress
                  value={pkg.percent}
                  className="h-1"
                  aria-label={`${pkg.label} progress`}
                />
                {pkg.dependsOn.length > 0 && (
                  <p className="text-xs text-muted-foreground">After {pkg.dependsOn.join(", ")}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
});
