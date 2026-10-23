import { Ban, Gauge, Pause, Play } from "lucide-react";
import { Button } from "../../../components/ui/button.js";
import type { ProjectRow } from "../project-progress.js";

export interface ProjectSteeringProps {
  readonly row: ProjectRow;
  readonly pending: boolean;
  readonly onHalt?: (projectId: string) => void;
  readonly onResume?: (projectId: string) => void;
  readonly onAccelerate?: (projectId: string, accelerated: boolean) => void;
  readonly onCancelProject?: (projectId: string) => void;
}

const STEERABLE = new Set(["ACTIVE", "ACCELERATED", "HALTED", "DELAYED", "AWAITING_CAPACITY"]);
const HELD = new Set(["HALTED", "DELAYED", "AWAITING_CAPACITY"]);

export function ProjectSteering({
  row,
  pending,
  onHalt,
  onResume,
  onAccelerate,
  onCancelProject,
}: ProjectSteeringProps) {
  const isHeld = HELD.has(row.status);
  const steerable = !row.isForeign && STEERABLE.has(row.status);
  if (!steerable) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {isHeld && onResume !== undefined && (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          aria-label={`${row.className} resume`}
          onClick={() => onResume(row.projectId)}
        >
          <Play aria-hidden="true" />
          Resume
        </Button>
      )}
      {!isHeld && onHalt !== undefined && (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          aria-label={`${row.className} halt`}
          onClick={() => onHalt(row.projectId)}
        >
          <Pause aria-hidden="true" />
          Halt
        </Button>
      )}
      {onAccelerate !== undefined && row.status === "ACTIVE" && (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          aria-label={`${row.className} accelerate`}
          title="Builds 10% faster for a one-time 5% cost premium; accelerating many ships risks delaying others (capacity pressure)."
          onClick={() => onAccelerate(row.projectId, true)}
        >
          <Gauge aria-hidden="true" />
          Accelerate
        </Button>
      )}
      {onAccelerate !== undefined && row.status === "ACCELERATED" && (
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
      {onCancelProject !== undefined && (
        <Button
          size="sm"
          variant="outline"
          className="text-destructive"
          disabled={pending}
          aria-label={`${row.className} cancel project`}
          title="Cancel this project. Work already done is forfeited and is not refunded; a cancelled rebuild releases its ship on its old design."
          onClick={() => onCancelProject(row.projectId)}
        >
          <Ban aria-hidden="true" />
          Cancel project
        </Button>
      )}
    </div>
  );
}
