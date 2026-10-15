import { memo } from "react";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.js";
import { Empty, EmptyDescription, EmptyTitle } from "../../../components/ui/empty.js";
import { Progress } from "../../../components/ui/progress.js";
import type { PackageState, ProjectRow } from "../project-progress.js";
import { ProjectReadout } from "./ProjectReadout.js";

const STATE_TEXT: Record<PackageState, string> = {
  done: "Done",
  active: "In progress",
  ready: "Ready to start",
  waiting: "Waiting",
};

const STATE_CLASS: Record<PackageState, string> = {
  done: "text-success",
  active: "text-foreground",
  ready: "text-muted-foreground",
  waiting: "text-muted-foreground",
};

export interface ProjectsCardProps {
  readonly rows: readonly ProjectRow[];
  /** Halt a project (DESIGN-23 section 7); absent disables the control. */
  readonly onHalt?: (projectId: string) => void;
  /** Resume a halted or delayed project. */
  readonly onResume?: (projectId: string) => void;
  /** Toggle engine-side acceleration (DESIGN-23 section 8): `true` enables, `false` disables. */
  readonly onAccelerate?: (projectId: string, accelerated: boolean) => void;
  /** Cancel a committed project and settle it (DESIGN-23 section 23): work already done is forfeited and a rebuild's ship is released. */
  readonly onCancelProject?: (projectId: string) => void;
  /** True while a steering command for this project is in flight, so the controls disable. */
  readonly pendingProjectId?: string | null;
}

const STATUS_LABEL: Readonly<Record<string, string>> = {
  ACTIVE: "active",
  ACCELERATED: "accelerated",
  HALTED: "halted",
  DELAYED: "delayed",
  AWAITING_CAPACITY: "awaiting capacity",
  IMPOUNDED: "impounded",
};

/** The halt/resume/accelerate controls for one project row, keyed off its DESIGN-23 section 2 status. */
function SteeringControls({
  row,
  pending,
  onHalt,
  onResume,
  onAccelerate,
  onCancelProject,
}: {
  readonly row: ProjectRow;
  readonly pending: boolean;
  readonly onHalt?: (projectId: string) => void;
  readonly onResume?: (projectId: string) => void;
  readonly onAccelerate?: (projectId: string, accelerated: boolean) => void;
  readonly onCancelProject?: (projectId: string) => void;
}) {
  const isHeld =
    row.status === "HALTED" || row.status === "DELAYED" || row.status === "AWAITING_CAPACITY";
  // A foreign-contract project's work is driven by its instalment schedule, not by halt/resume, so it offers no
  // steering controls (the status badge still shows its state).
  const steerable =
    !row.isForeign &&
    (row.status === "ACTIVE" ||
      row.status === "ACCELERATED" ||
      row.status === "HALTED" ||
      row.status === "DELAYED" ||
      row.status === "AWAITING_CAPACITY");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="secondary">{STATUS_LABEL[row.status] ?? row.status.toLowerCase()}</Badge>
      {steerable && isHeld && onResume !== undefined && (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          aria-label={`${row.className} resume`}
          onClick={() => onResume(row.projectId)}
        >
          Resume
        </Button>
      )}
      {steerable && !isHeld && onHalt !== undefined && (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          aria-label={`${row.className} halt`}
          onClick={() => onHalt(row.projectId)}
        >
          Halt
        </Button>
      )}
      {onAccelerate !== undefined && !row.isForeign && row.status === "ACTIVE" && (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          aria-label={`${row.className} accelerate`}
          title="Builds 10% faster for a one-time 5% cost premium; accelerating many ships risks delaying others (capacity pressure)."
          onClick={() => onAccelerate(row.projectId, true)}
        >
          Accelerate
        </Button>
      )}
      {onAccelerate !== undefined && !row.isForeign && row.status === "ACCELERATED" && (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          aria-label={`${row.className} stop accelerating`}
          onClick={() => onAccelerate(row.projectId, false)}
        >
          Stop accelerating
        </Button>
      )}
      {steerable && onCancelProject !== undefined && (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          aria-label={`${row.className} cancel project`}
          title="Cancel this project. Work already done is forfeited and is not refunded; a cancelled rebuild releases its ship on its old design."
          onClick={() => onCancelProject(row.projectId)}
        >
          Cancel project
        </Button>
      )}
    </div>
  );
}

/** Ships under construction: overall progress, the yard, each work package's state, and the steering controls. */
export const ProjectsCard = memo(function ProjectsCard({
  rows,
  onHalt,
  onResume,
  onAccelerate,
  onCancelProject,
  pendingProjectId = null,
}: ProjectsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Under construction</CardTitle>
        <CardDescription>
          {rows.some((r) => r.packages.length > 0)
            ? "Ships ordered from your own designs are built in work packages: a package starts when what it depends on is done, and the yard can only do so much work each month."
            : "How far each ship is along."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <Empty>
            <EmptyTitle>No ships under construction</EmptyTitle>
            <EmptyDescription>Order a design from the Design Catalog.</EmptyDescription>
          </Empty>
        ) : (
          <ul className="space-y-4" aria-label="Ships under construction">
            {rows.map((row) => (
              <li key={row.projectId} className="space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{row.className}</span>
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    {row.yard !== null && <Badge variant="outline">{row.yard}</Badge>}
                    {row.holdUntilMonth !== null && (
                      <Badge variant="secondary">on hold until {row.holdUntilMonth}</Badge>
                    )}
                    <span className="tabular-nums">{row.percent}%</span>
                  </span>
                </div>
                <Progress value={row.percent} aria-label={`${row.className} progress`} />
                <SteeringControls
                  row={row}
                  pending={pendingProjectId === row.projectId}
                  {...(onHalt === undefined ? {} : { onHalt })}
                  {...(onResume === undefined ? {} : { onResume })}
                  {...(onAccelerate === undefined ? {} : { onAccelerate })}
                  {...(onCancelProject === undefined ? {} : { onCancelProject })}
                />
                <ProjectReadout row={row} />
                {row.packages.length > 0 && (
                  <ul
                    className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2"
                    aria-label={`${row.className} work packages`}
                  >
                    {row.packages.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-2">
                        <span>{p.label}</span>
                        <span className={STATE_CLASS[p.state]}>
                          {STATE_TEXT[p.state]}
                          {p.state === "active" ? ` · ${p.percent}%` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
});
