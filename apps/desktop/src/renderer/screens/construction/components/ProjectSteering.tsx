import { Ban, Gauge, Pause, PencilRuler, Play } from "lucide-react";
import { useState } from "react";
import { Button } from "../../../components/ui/button.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import type { ProjectRow } from "../project-progress.js";
import {
  accelerateView as buildAccelerateView,
  haltView as buildHaltView,
} from "../steering-view.js";
import { Tip } from "../../../components/ui/tip.js";
import { SteeringConfirmDialog } from "./SteeringConfirmDialog.js";

export interface ProjectSteeringProps {
  readonly row: ProjectRow;
  readonly pending: boolean;
  readonly onHalt?: (projectId: string) => void;
  readonly onResume?: (projectId: string) => void;
  readonly onAccelerate?: (projectId: string, accelerated: boolean) => void;
  readonly onCancelProject?: (projectId: string) => void;
  readonly onRevise?: (projectId: string) => void;
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
  onRevise,
}: ProjectSteeringProps) {
  const format = usePresentationFormat();
  const [open, setOpen] = useState<"accelerate" | "halt" | null>(null);
  const isHeld = HELD.has(row.status);
  const steerable = !row.isForeign && STEERABLE.has(row.status);
  if (!steerable) return null;
  const preview = row.steering;
  const accelerateView =
    preview?.accelerate == null
      ? null
      : buildAccelerateView(row.className, preview.accelerate, format);
  const haltView =
    preview?.halt == null ? null : buildHaltView(row.className, preview.halt, format);
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
      {!isHeld && onHalt !== undefined && haltView !== null && (
        <>
          <Tip label={haltView.tip}>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              aria-label={`${row.className} halt`}
              onClick={() => setOpen("halt")}
            >
              <Pause aria-hidden="true" />
              Halt
            </Button>
          </Tip>
          <SteeringConfirmDialog
            view={haltView}
            open={open === "halt"}
            onOpenChange={(next) => setOpen(next ? "halt" : null)}
            onConfirm={() => onHalt(row.projectId)}
          />
        </>
      )}
      {onAccelerate !== undefined && row.status === "ACTIVE" && accelerateView !== null && (
        <>
          <Tip label={accelerateView.tip}>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              aria-label={`${row.className} accelerate`}
              onClick={() => setOpen("accelerate")}
            >
              <Gauge aria-hidden="true" />
              Accelerate
            </Button>
          </Tip>
          <SteeringConfirmDialog
            view={accelerateView}
            open={open === "accelerate"}
            onOpenChange={(next) => setOpen(next ? "accelerate" : null)}
            onConfirm={() => onAccelerate(row.projectId, true)}
          />
        </>
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
      {onRevise !== undefined && row.revisable && (
        <Tip label="Revise this project's design on the drawing board. How much it costs depends on how far the hull has progressed.">
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            aria-label={`${row.className} revise`}
            onClick={() => onRevise(row.projectId)}
          >
            <PencilRuler aria-hidden="true" />
            Revise
          </Button>
        </Tip>
      )}
      {onCancelProject !== undefined && (
        <Tip label="Cancel this project. Work already done is forfeited and is not refunded; a cancelled rebuild releases its ship on its old design.">
          <Button
            size="sm"
            variant="outline"
            className="text-destructive"
            disabled={pending}
            aria-label={`${row.className} cancel project`}

            onClick={() => onCancelProject(row.projectId)}
          >
            <Ban aria-hidden="true" />
            Cancel project
          </Button>
        </Tip>
      )}
    </div>
  );
}
