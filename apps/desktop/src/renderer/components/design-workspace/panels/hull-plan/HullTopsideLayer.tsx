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
      {funnels.map((f) => (
        <ellipse
          key={f.instanceId}
          cx={frame.x(f.stationPermille)}
          cy={PLAN_MID}
          rx={Math.max(3, ry * 0.7)}
          ry={ry}
          className="fill-background stroke-foreground"
          data-testid="hull-funnel"
        >
          <title>{`Funnel @ ${f.stationPermille}‰ (schematic footprint)`}</title>
        </ellipse>
      ))}
    </g>
  );
}
