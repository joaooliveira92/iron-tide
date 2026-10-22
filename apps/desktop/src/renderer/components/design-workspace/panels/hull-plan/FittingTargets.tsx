import { type KeyboardEvent, useRef, useState } from "react";
import type { DesignDraft } from "@bluewave/ship-design";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../../../ui/hover-card.js";
import { sameEntity, type ShipEntity } from "../../selection/store.js";
import { useSelectionStore, useShipSelection } from "../../selection/useShipSelection.js";
import { AnatomyCardContent } from "./anatomy/AnatomyCardContent.js";
import type { AnatomyShip } from "./anatomy/ship-anatomy.js";
import { NON_SCALING, STROKE } from "./drafting.js";
import { fittingPoint, PLAN_H, PLAN_W, type PlanFrame } from "./geometry.js";
import { WarningGlyph } from "./WarningGlyph.js";

export interface AnatomyViews {
  readonly starboard: AnatomyShip;
  readonly port: AnatomyShip;
}

const SIDE = { CENTRE: "centreline", PORT: "port", STBD: "starboard" } as const;
const HIT_R = 8;

export interface FittingTarget {
  readonly instanceId: string;
  readonly name: string;
  readonly mount: string | undefined;
}

export function FittingTargets({
  frame,
  draft,
  targets,
  disabled,
  warns,
  anatomy,
}: {
  readonly frame: PlanFrame;
  readonly draft: DesignDraft;
  readonly targets: ReadonlyMap<string, FittingTarget>;
  readonly disabled: boolean;
  readonly warns: (instanceId: string) => boolean;
  readonly anatomy?: AnatomyViews;
}) {
  const store = useSelectionStore();
  const selected = useShipSelection((s) => s.selected);
  const linked = useShipSelection((s) => s.linked);
  const placed = draft.placements
    .map((p, index) => ({ p, index }))
    .sort((a, b) => a.p.stationPermille - b.p.stationPermille);
  const [cursor, setCursor] = useState(0);
  const refs = useRef(new Map<string, SVGGElement>());
  const current = Math.min(cursor, Math.max(0, placed.length - 1));
  const label = (instanceId: string, side: keyof typeof SIDE, station: number) => {
    const t = targets.get(instanceId);
    return `${t?.name ?? instanceId}${t?.mount ? ` (mount ${t.mount})` : ""}, ${SIDE[side]}, ${station}‰`;
  };
  const move = (to: number, e: KeyboardEvent) => {
    e.preventDefault();
    const next = (to + placed.length) % placed.length;
    setCursor(next);
    refs.current.get(placed[next]!.p.instanceId)?.focus();
  };
  return (
    <svg
      viewBox={`0 0 ${PLAN_W} ${PLAN_H}`}
      className={`absolute inset-0 size-full ${disabled ? "pointer-events-none" : ""}`}
      role="toolbar"
      aria-label="Fittings on the plan"
      aria-disabled={disabled || undefined}
      data-testid="fitting-targets"
    >
      {placed.map(({ p, index }, i) => {
        const { x, y } = fittingPoint(frame, p.stationPermille, p.side, index);
        const entity: ShipEntity = { kind: "fitting", instanceId: p.instanceId };
        const isSelected = sameEntity(selected, entity);
        const isLinked = linked.some((l) => sameEntity(l, entity));
        const name = label(p.instanceId, p.side ?? "CENTRE", p.stationPermille);
        const plate =
          anatomy === undefined ? undefined : p.side === "PORT" ? anatomy.port : anatomy.starboard;
        const fact = plate?.facts.get(p.instanceId);
        const title = targets.get(p.instanceId)?.name ?? p.instanceId;
        return (
          <HoverCard key={p.instanceId}>
            <HoverCardTrigger
              render={
                <g
                  ref={(el) => {
                    if (el) refs.current.set(p.instanceId, el);
                    else refs.current.delete(p.instanceId);
                  }}
                  role="button"
                  aria-label={name}
                  aria-pressed={isSelected}
                  aria-disabled={disabled || undefined}
                  tabIndex={disabled ? -1 : i === current ? 0 : -1}
                  data-target={p.instanceId}
                  data-state={isSelected ? "selected" : isLinked ? "linked" : "default"}
                  className="group cursor-pointer outline-none"
                  onFocus={() => setCursor(i)}
                  onClick={() => store.select(entity)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      store.select(entity);
                    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") move(i + 1, e);
                    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") move(i - 1, e);
                    else if (e.key === "Home") move(0, e);
                    else if (e.key === "End") move(placed.length - 1, e);
                  }}
                />
              }
            >
              <circle
                cx={x}
                cy={y}
                r={HIT_R}
                className="fill-transparent stroke-transparent group-hover:stroke-primary/70 group-focus-visible:stroke-ring"
                strokeWidth={1.5}
                {...NON_SCALING}
              />
              {isLinked && !isSelected && (
                <circle
                  cx={x}
                  cy={y}
                  r={HIT_R + 1}
                  className="fill-none stroke-primary"
                  strokeWidth={1.5}
                  strokeDasharray="2 2"
                  {...NON_SCALING}
                  data-testid="fitting-linked-ring"
                />
              )}
              {isSelected && (
                <g data-testid="fitting-selected-ring">
                  <circle
                    cx={x}
                    cy={y}
                    r={HIT_R + 1}
                    className="fill-none stroke-primary"
                    strokeWidth={2.2}
                    {...NON_SCALING}
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r={HIT_R + 4}
                    className="fill-none stroke-primary"
                    strokeWidth={STROKE.guide}
                    {...NON_SCALING}
                  />
                  {warns(p.instanceId) && <WarningGlyph x={x + HIT_R + 6} y={y - HIT_R - 4} />}
                </g>
              )}
            </HoverCardTrigger>
            <HoverCardContent
              side="top"
              collisionPadding={12}
              className={
                plate === undefined
                  ? "w-auto max-w-64 px-3 py-1.5 text-xs"
                  : "w-[26rem] max-w-[min(26rem,calc(100vw-2rem))] p-2"
              }
            >
              {plate === undefined ? (
                name
              ) : (
                <AnatomyCardContent
                  plate={plate}
                  highlight={p.instanceId}
                  title={title}
                  aside={`${SIDE[p.side ?? "CENTRE"]} · ${p.stationPermille}‰`}
                  detail={fact}
                  testId="fitting-anatomy"
                />
              )}
            </HoverCardContent>
          </HoverCard>
        );
      })}
    </svg>
  );
}
