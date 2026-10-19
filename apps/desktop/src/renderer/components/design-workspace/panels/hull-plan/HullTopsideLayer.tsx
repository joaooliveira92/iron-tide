import type { DesignDraft } from "@bluewave/ship-design";
import type { DrawingBoardContent } from "../../content.js";
import { funnelPlacements } from "./funnelPlacements.js";
import { PLAN_MID, type PlanFrame } from "./geometry.js";

/** Superstructure block (over its zone) and funnel ovals, in plan. Footprints are schematic: no data gives their width. */
export function HullTopsideLayer({
  frame,
  draft,
  content,
  zones,
}: {
  readonly frame: PlanFrame;
  readonly draft: DesignDraft;
  readonly content: DrawingBoardContent;
  readonly zones: readonly { id: string; startPermille: number; endPermille: number }[];
}) {
  const sup = zones.find((z) => z.id === "SUPERSTRUCTURE");
  const funnels = funnelPlacements(draft, content);
  const ry = Math.max(2, Math.min(frame.maxHalf * 0.4, 10));
  const supHalf =
    sup === undefined
      ? 0
      : Math.min(frame.half(sup.startPermille / 1000), frame.half(sup.endPermille / 1000)) * 0.55;
  return (
    <g data-testid="hull-topside">
      {sup && (
        <rect
          x={frame.x(sup.startPermille)}
          width={frame.x(sup.endPermille) - frame.x(sup.startPermille)}
          y={
            PLAN_MID -
            Math.min(frame.half(sup.startPermille / 1000), frame.half(sup.endPermille / 1000)) *
              0.55
          }
          height={
            Math.min(frame.half(sup.startPermille / 1000), frame.half(sup.endPermille / 1000)) * 1.1
          }
          rx={3}
          className="fill-muted stroke-muted-foreground"
          data-testid="hull-superstructure"
        >
          <title>Superstructure (schematic footprint)</title>
        </rect>
      )}
      {sup && supHalf > 1 && (
        <g className="pointer-events-none" data-testid="hull-bridge">
          <polygon
            // Bridge house: a tapered wedge on the forward end of the block, as the guide's plan diagrams draw it.
            points={`${frame.x(sup.startPermille) - 4},${PLAN_MID} ${frame.x(sup.startPermille)},${PLAN_MID - supHalf * 0.7} ${frame.x(sup.startPermille) + (frame.x(sup.endPermille) - frame.x(sup.startPermille)) * 0.35},${PLAN_MID - supHalf * 0.7} ${frame.x(sup.startPermille) + (frame.x(sup.endPermille) - frame.x(sup.startPermille)) * 0.35},${PLAN_MID + supHalf * 0.7} ${frame.x(sup.startPermille)},${PLAN_MID + supHalf * 0.7}`}
            className="fill-muted stroke-muted-foreground"
            strokeWidth={0.8}
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={
              frame.x(sup.startPermille) +
              (frame.x(sup.endPermille) - frame.x(sup.startPermille)) * 0.5
            }
            x2={frame.x(sup.endPermille) - 2}
            y1={PLAN_MID}
            y2={PLAN_MID}
            className="stroke-muted-foreground"
            strokeWidth={0.8}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      )}
      {funnels.map((f) => (
        <g key={f.instanceId}>
          <ellipse
            cx={frame.x(f.stationPermille)}
            cy={PLAN_MID}
            rx={Math.max(3, ry * 0.7)}
            ry={ry}
            className="fill-background stroke-foreground"
            data-testid="hull-funnel"
          >
            <title>{`Funnel @ ${f.stationPermille}‰ (schematic footprint)`}</title>
          </ellipse>
          <ellipse
            // The uptake opening, dark inside the rim.
            cx={frame.x(f.stationPermille)}
            cy={PLAN_MID}
            rx={Math.max(1.6, ry * 0.7 * 0.62)}
            ry={ry * 0.62}
            className="pointer-events-none fill-foreground"
            data-testid="hull-funnel-bore"
          />
        </g>
      ))}
    </g>
  );
}
