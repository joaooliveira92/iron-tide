import type { DesignDraft } from "@bluewave/ship-design";
import { arcSectors, sectorPath } from "./arcs.js";
import { useShipSelection } from "../../selection/useShipSelection.js";
import { NON_SCALING, STROKE } from "./drafting.js";
import { fittingPoint, type PlanFrame } from "./geometry.js";

/** The fittings' markers. Names, hover and selection are on the `FittingTargets` overlay above the drawing. */
export function HullFittingLayer({
  frame,
  draft,
  selectedId,
}: {
  readonly frame: PlanFrame;
  readonly draft: DesignDraft;
  /** Fitting to ring (the one being moved from the plan tools). */
  readonly selectedId?: string;
}) {
  return (
    <>
      {draft.placements.map((p, i) => {
        const { x, y } = fittingPoint(frame, p.stationPermille, p.side, i);
        return (
          <g key={p.instanceId}>
            {p.instanceId === selectedId && (
              <circle
                cx={x}
                cy={y}
                r={8}
                className="fill-none stroke-primary"
                strokeWidth={STROKE.structure}
                {...NON_SCALING}
                data-testid="plan-selected-ring"
              />
            )}
            <circle cx={x} cy={y} r={4} className="fill-primary" data-fitting={p.instanceId} />
          </g>
        );
      })}
    </>
  );
}

/** Schematic radius of an arc wedge, px. Range is not data. The section card draws its own (26) under magnification; do not unify them. */
const ARC_R = 30;

export function GunArcLayer({
  frame,
  draft,
  mounts,
}: {
  readonly frame: PlanFrame;
  readonly draft: DesignDraft;
  readonly mounts: readonly { instanceId: string; effectiveBeamArcDeg: number }[];
}) {
  const arcByInstance = new Map(mounts.map((m) => [m.instanceId, m.effectiveBeamArcDeg]));
  // A selected mount's arcs read strongest: the coverage it can actually bear on its own drawing.
  const selected = useShipSelection((s) => s.selected);
  const highlightId = selected?.kind === "fitting" ? selected.instanceId : undefined;
  return (
    <g data-testid="gun-arcs">
      {draft.placements.flatMap((p, i) => {
        const { x, y } = fittingPoint(frame, p.stationPermille, p.side, i);
        const highlighted = p.instanceId === highlightId;
        return arcSectors(p.instanceId, p.side, arcByInstance.get(p.instanceId)).map((s) => (
          <path
            key={`${p.instanceId}-${s.beam}`}
            d={sectorPath(x, y, ARC_R, s)}
            className="fill-primary stroke-primary"
            fillOpacity={highlighted ? 0.3 : 0.12}
            strokeOpacity={highlighted ? 0.9 : 0.4}
            data-arc={`${p.instanceId}:${s.beam}`}
            data-highlight={highlighted || undefined}
          >
            <title>{`${p.instanceId}: ${Math.round(s.widthDeg)}° ${s.beam === "STBD" ? "starboard" : "port"} beam arc`}</title>
          </path>
        ));
      })}
    </g>
  );
}
