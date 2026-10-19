import type { DesignDraft } from "@bluewave/ship-design";
import { arcSectors, sectorPath } from "./arcs.js";
import { useShipSelection } from "../../selection/useShipSelection.js";
import { NON_SCALING, STROKE } from "./drafting.js";
import { fittingPoint, type PlanFrame } from "./geometry.js";
import type { FittingKind } from "./sections.js";

/** Drawn gun barrel length and turret radius, SVG units. Mount size is a convention, not data. */
const TURRET_R = 4.5;
const BARREL_LEN = 8;

/**
 * One fitting's plan symbol, centred on (x, y): guns are a turret ring with barrels pointing outboard-forward
 * (aft of amidships they point aft, as the plan diagrams draw it), torpedo tubes lie across the beam, spaces under
 * the deck are faint squares. The element carrying `data-fitting` is always a circle at (x, y).
 */
function PlanSymbol({
  kind,
  x,
  y,
  id,
  aft,
}: {
  readonly kind: FittingKind;
  readonly x: number;
  readonly y: number;
  readonly id: string;
  readonly aft: boolean;
}) {
  const stroke = { strokeWidth: STROKE.structure, ...NON_SCALING };
  switch (kind) {
    case "gun": {
      const dir = aft ? 1 : -1;
      return (
        <g data-kind="gun">
          {[-1.4, 1.4].map((dy) => (
            <line
              key={dy}
              x1={x}
              x2={x + dir * (TURRET_R + BARREL_LEN)}
              y1={y + dy}
              y2={y + dy}
              className="stroke-foreground"
              {...stroke}
            />
          ))}
          <circle
            cx={x}
            cy={y}
            r={TURRET_R}
            className="fill-background stroke-foreground"
            data-fitting={id}
            {...stroke}
          />
          <circle cx={x} cy={y} r={1.4} className="fill-primary" />
        </g>
      );
    }
    case "torpedo":
      return (
        <g data-kind="torpedo">
          <rect
            x={x - 1.8}
            y={y - 6}
            width={3.6}
            height={12}
            rx={1.8}
            className="fill-background stroke-foreground"
            {...stroke}
          />
          <circle cx={x} cy={y} r={1.4} className="fill-primary" data-fitting={id} />
        </g>
      );
    case "magazine":
    case "machinery":
      return (
        <g data-kind={kind}>
          <rect
            x={x - 3.5}
            y={y - 3.5}
            width={7}
            height={7}
            className="fill-none stroke-muted-foreground"
            strokeDasharray="2 1.5"
            {...stroke}
          />
          <circle cx={x} cy={y} r={1.6} className="fill-primary" data-fitting={id} />
        </g>
      );
    default:
      return <circle cx={x} cy={y} r={4} className="fill-primary" data-fitting={id} />;
  }
}

/** The fittings' markers. Names, hover and selection are on the `FittingTargets` overlay above the drawing. */
export function HullFittingLayer({
  frame,
  draft,
  selectedId,
  kindOf,
}: {
  readonly frame: PlanFrame;
  readonly draft: DesignDraft;
  /** Fitting to ring (the one being moved from the plan tools). */
  readonly selectedId?: string;
  /** The symbol class of a component; omitted, every fitting is a plain dot. */
  readonly kindOf?: (componentId: string) => FittingKind;
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
            <PlanSymbol
              kind={kindOf?.(p.componentId) ?? "other"}
              x={x}
              y={y}
              id={p.instanceId}
              aft={p.stationPermille >= 500}
            />
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
