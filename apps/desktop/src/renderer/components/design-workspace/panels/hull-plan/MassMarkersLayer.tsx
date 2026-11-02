import { LABEL_FONT, NON_SCALING, STROKE } from "./drafting.js";
import { PLAN_MID, type PlanFrame } from "./geometry.js";

export function MassMarkersLayer({
  frame,
  lcgPermille,
}: {
  readonly frame: PlanFrame;
  readonly lcgPermille: number;
}) {
  const x = frame.x(lcgPermille);
  return (
    <g data-testid="mass-markers">
      <g data-testid="mass-cg">
        <circle
          cx={x}
          cy={PLAN_MID}
          r={4}
          className="pointer-events-none fill-none stroke-foreground"
          strokeWidth={STROKE.structure}
          {...NON_SCALING}
        />
        <line x1={x - 4} x2={x + 4} y1={PLAN_MID} y2={PLAN_MID} className="stroke-foreground" />
        <line x1={x} x2={x} y1={PLAN_MID - 4} y2={PLAN_MID + 4} className="stroke-foreground" />
        <text
          x={x + 6}
          y={PLAN_MID + 3}
          className="pointer-events-none fill-foreground font-medium"
          fontSize={LABEL_FONT}
        >
          G
        </text>
        <title>{`Longitudinal centre of gravity, ${Math.round(lcgPermille)}‰ from the bow`}</title>
      </g>
    </g>
  );
}
