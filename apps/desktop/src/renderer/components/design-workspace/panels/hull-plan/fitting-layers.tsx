import type { DesignDraft, MountSide } from "@bluewave/ship-design";
import { arcSectors, bearingVector, sectorPath } from "./arcs.js";
import { useShipSelection } from "../../selection/useShipSelection.js";
import { LABEL_FONT, NON_SCALING, STROKE } from "./drafting.js";
import { fittingPoint, type PlanFrame } from "./geometry.js";
import type { PlanSymbolSpec } from "./plan-symbols.js";

/**
 * One fitting's plan symbol, centred on (x, y). Guns are a mount ring per its class with one barrel per gun, pointing
 * toward the bow forward of amidships and toward the stern aft of it (as the guide's plan diagrams draw them); torpedo
 * tubes lie across the beam; spaces below the deck are faint dashed marks. The element carrying `data-fitting` is
 * always a circle at (x, y).
 */
function PlanSymbol({
  spec,
  x,
  y,
  id,
  aft,
  side,
}: {
  readonly spec: PlanSymbolSpec;
  readonly x: number;
  readonly y: number;
  readonly id: string;
  readonly aft: boolean;
  readonly side?: MountSide;
}) {
  const stroke = { strokeWidth: STROKE.structure, ...NON_SCALING };
  switch (spec.shape) {
    case "gun": {
      const dir = aft ? 1 : -1;
      const r = spec.radius;
      const len = r + 3 + r * 0.9;
      const spread = spec.barrels > 1 ? r * 0.55 : 0;
      const offsets = Array.from(
        { length: spec.barrels },
        (_, i) => (spec.barrels === 1 ? 0 : (i / (spec.barrels - 1) - 0.5) * 2) * spread,
      );
      // A wing mount fires across the beam, outward on its own side (starboard is the upper side of the drawing); a
      // centreline mount points along the hull. The barrel is a vector (dx, dy) from the mount, spread perpendicular.
      const wing = side === "STBD" ? -1 : side === "PORT" ? 1 : 0;
      const barrels = offsets.map((o) =>
        wing === 0
          ? { x1: x, y1: y + o, x2: x + dir * len, y2: y + o }
          : { x1: x + o, y1: y, x2: x + o, y2: y + wing * len },
      );
      if (spec.mountClass === "CASEMATE") {
        return (
          <g data-kind="gun" data-mount-class="CASEMATE">
            <rect
              x={x - r}
              y={y - r * 0.6}
              width={r * 2}
              height={r * 1.2}
              className="fill-background stroke-foreground"
              {...stroke}
            />
            <circle cx={x} cy={y} r={1.2} className="fill-primary" data-fitting={id} />
          </g>
        );
      }
      return (
        <g data-kind="gun" data-mount-class={spec.mountClass}>
          {barrels.map((b) => (
            <line
              key={`${b.x1}:${b.y1}`}
              x1={b.x1}
              x2={b.x2}
              y1={b.y1}
              y2={b.y2}
              className="stroke-foreground"
              {...stroke}
            />
          ))}
          {spec.mountClass === "BARBETTE" && (
            <circle
              cx={x}
              cy={y}
              r={r + 1.6}
              className="fill-none stroke-muted-foreground"
              {...stroke}
            />
          )}
          <circle
            cx={x}
            cy={y}
            r={r}
            className="fill-background stroke-foreground"
            data-fitting={id}
            {...stroke}
          />
          <circle cx={x} cy={y} r={Math.min(1.4, r / 2)} className="fill-primary" />
        </g>
      );
    }
    case "anchor":
      return <circle cx={x} cy={y} r={1.4} className="fill-transparent" data-fitting={id} />;
    case "tube":
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
    case "space":
      return (
        <g data-kind={spec.kind}>
          {spec.kind === "other" ? (
            <polygon
              points={`${x},${y - 3.5} ${x + 3.5},${y} ${x},${y + 3.5} ${x - 3.5},${y}`}
              className="fill-none stroke-muted-foreground"
              strokeDasharray="2 1.5"
              {...stroke}
            />
          ) : (
            <rect
              x={x - 3.5}
              y={y - 3.5}
              width={7}
              height={7}
              className="fill-none stroke-muted-foreground"
              strokeDasharray="2 1.5"
              {...stroke}
            />
          )}
          <circle cx={x} cy={y} r={1.6} className="fill-primary" data-fitting={id} />
        </g>
      );
  }
}

/** A fitting's symbol, or the plain dot when it has none. */
function PlanMark(props: {
  readonly spec: PlanSymbolSpec | undefined;
  readonly x: number;
  readonly y: number;
  readonly id: string;
  readonly aft: boolean;
  readonly side?: MountSide;
}) {
  const { spec, x, y, id, aft, side } = props;
  if (spec === undefined)
    return <circle cx={x} cy={y} r={4} className="fill-primary" data-fitting={id} />;
  return <PlanSymbol spec={spec} x={x} y={y} id={id} aft={aft} side={side} />;
}

/** The fittings' markers. Names, hover and selection are on the `FittingTargets` overlay above the drawing. */
export function HullFittingLayer({
  frame,
  draft,
  selectedId,
  symbolOf,
}: {
  readonly frame: PlanFrame;
  readonly draft: DesignDraft;
  /** Fitting to ring (the one being moved from the plan tools). */
  readonly selectedId?: string;
  /** The symbol a placement is drawn with; omitted, or undefined for a placement, it is a plain dot. */
  readonly symbolOf?: (placement: DesignDraft["placements"][number]) => PlanSymbolSpec | undefined;
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
            <PlanMark
              spec={symbolOf?.(p)}
              x={x}
              y={y}
              id={p.instanceId}
              aft={p.stationPermille >= 500}
              side={p.side}
            />
          </g>
        );
      })}
    </>
  );
}

/** Schematic radius of an arc wedge, px. Range is not data. The section card draws its own (26) under magnification; do not unify them. */
const ARC_R = 30;
/** The larger radius the Firing arcs view draws, where the arcs are the subject and carry their width. */
export const ARC_R_FOCUS = 48;

export function GunArcLayer({
  frame,
  draft,
  mounts,
  radius = ARC_R,
  labelled = false,
}: {
  readonly frame: PlanFrame;
  readonly draft: DesignDraft;
  readonly mounts: readonly { instanceId: string; effectiveBeamArcDeg: number }[];
  /** Drawn radius of each wedge, SVG units. */
  readonly radius?: number;
  /** Write each wedge's width in degrees on it. */
  readonly labelled?: boolean;
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
        return arcSectors(p.instanceId, p.side, arcByInstance.get(p.instanceId)).map((s) => {
          const mid = bearingVector(s.startDeg + s.widthDeg / 2);
          return (
            <g key={`${p.instanceId}-${s.beam}`}>
              <path
                d={sectorPath(x, y, radius, s)}
                className="fill-primary stroke-primary"
                fillOpacity={highlighted ? 0.3 : 0.12}
                strokeOpacity={highlighted ? 0.9 : 0.4}
                data-arc={`${p.instanceId}:${s.beam}`}
                data-highlight={highlighted || undefined}
              >
                <title>{`${p.instanceId}: ${Math.round(s.widthDeg)}° ${s.beam === "STBD" ? "starboard" : "port"} beam arc`}</title>
              </path>
              {labelled && (
                <text
                  x={x + mid.dx * radius * 0.62}
                  y={y + mid.dy * radius * 0.62 + 2.5}
                  textAnchor="middle"
                  className="pointer-events-none fill-foreground font-medium"
                  fontSize={LABEL_FONT}
                  data-arc-label={`${p.instanceId}:${s.beam}`}
                >
                  {`${Math.round(s.widthDeg)}°`}
                </text>
              )}
            </g>
          );
        });
      })}
    </g>
  );
}
