import type { DesignDraft, MountSide } from "@bluewave/ship-design";
import { arcSectors, bearingVector, sectorPath } from "./arcs.js";
import { useShipSelection } from "../../selection/useShipSelection.js";
import { LABEL_FONT, NON_SCALING, STROKE } from "./drafting.js";
import { fittingPoint, type PlanFrame } from "./geometry.js";
import type { PlanSymbolSpec } from "./plan-symbols.js";

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

export function HullFittingLayer({
  frame,
  draft,
  selectedId,
  symbolOf,
}: {
  readonly frame: PlanFrame;
  readonly draft: DesignDraft;
  readonly selectedId?: string;
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

const ARC_R = 30;
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
  readonly radius?: number;
  readonly labelled?: boolean;
}) {
  const arcByInstance = new Map(mounts.map((m) => [m.instanceId, m.effectiveBeamArcDeg]));
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
