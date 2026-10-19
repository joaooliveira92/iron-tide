import type { DesignDraft } from "@bluewave/ship-design";
import type { DrawingBoardContent } from "../../content.js";
import { funnelPlacements } from "./funnelPlacements.js";
import { PLAN_MID, type PlanFrame } from "./geometry.js";

type Zone = { readonly startPermille: number; readonly endPermille: number };

/** Bridge starts a fifth along the superstructure and ends two thirds along it, as the profile's upper mass does. */
const BRIDGE_START = 0.2;
const BRIDGE_END = 0.65;

const along = (z: Zone, t: number) => z.startPermille + (z.endPermille - z.startPermille) * t;

/** CONVENTION, as in the profile: a foremast at the bridge and a mainmast at the aft end of the superstructure. */
function mastStations(z: Zone): number[] {
  return [Math.round(along(z, BRIDGE_START)), z.endPermille];
}

function bridgePoints(frame: PlanFrame, z: Zone, half: number): string {
  const x0 = frame.x(along(z, BRIDGE_START));
  const x1 = frame.x(along(z, BRIDGE_END));
  const h = half * 0.7;
  const point = Math.min(4, (x1 - x0) * 0.25);
  return [
    [x0 - point, PLAN_MID],
    [x0, PLAN_MID - h],
    [x1, PLAN_MID - h],
    [x1, PLAN_MID + h],
    [x0, PLAN_MID + h],
  ]
    .map(([x, y]) => `${x},${y}`)
    .join(" ");
}

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
            // Bridge house: from a fifth to two thirds along the block (the profile's upper mass), pointed forward as
            // the guide's plan diagrams draw it.
            points={bridgePoints(frame, sup, supHalf)}
            className="fill-muted stroke-muted-foreground"
            strokeWidth={0.8}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      )}
      {sup &&
        mastStations(sup).map((p) => (
          <g key={p} className="pointer-events-none" data-testid="hull-mast" aria-hidden="true">
            <line
              x1={frame.x(p)}
              x2={frame.x(p)}
              y1={PLAN_MID - 4}
              y2={PLAN_MID + 4}
              className="stroke-foreground"
              strokeWidth={0.8}
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={frame.x(p)} cy={PLAN_MID} r={1.4} className="fill-foreground" />
          </g>
        ))}
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
