import { type KeyboardEvent, useRef, useState } from "react";
import type { DesignDraft } from "@bluewave/ship-design";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../../ui/hover-card.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import { NON_SCALING, STROKE } from "../panels/hull-plan/drafting.js";
import {
  fittingPoint,
  PLAN_H,
  PLAN_MID,
  PLAN_W,
  type PlanFrame,
} from "../panels/hull-plan/geometry.js";
import { SECTIONS, type ZoneRange } from "../panels/hull-plan/sections.js";
import { machineryRooms } from "../selection/facts.js";
import { sameEntity, type ShipEntity } from "../selection/store.js";
import { useSelectionStore, useShipSelection } from "../selection/useShipSelection.js";
import type { BoardFinding } from "./boardFindings.js";
import { valueLine } from "./format.js";
import { SEVERITY_STYLE, severityRank, type MarkerShape } from "./severity.js";

const R = 6;
const STEP = 2 * R + 1;
const FITTING_OFFSET = 11;

export interface MarkerGroup {
  readonly entity: Exclude<ShipEntity, { kind: "ship" }>;
  readonly findings: readonly BoardFinding[];
  readonly x: number;
  readonly y: number;
}

const entityKey = (e: ShipEntity) =>
  e.kind === "fitting"
    ? `f:${e.instanceId}`
    : e.kind === "section"
      ? `s:${e.id}`
      : e.kind === "machinery-room"
        ? `r:${e.index}`
        : "ship";

export function layoutMarkers(
  findings: readonly BoardFinding[],
  frame: PlanFrame,
  draft: DesignDraft,
  zones: readonly ZoneRange[],
): MarkerGroup[] {
  const groups = new Map<string, { entity: MarkerGroup["entity"]; findings: BoardFinding[] }>();
  for (const f of findings)
    for (const e of f.entities) {
      if (e.kind === "ship") continue;
      const k = entityKey(e);
      const g = groups.get(k) ?? { entity: e, findings: [] };
      if (!g.findings.includes(f)) g.findings.push(f);
      groups.set(k, g);
    }
  const rowY = Math.min(PLAN_H - R - 1, PLAN_MID + frame.maxHalf + R + 4);
  const rooms = machineryRooms(draft);
  const anchored: (MarkerGroup & { readonly row: boolean })[] = [];
  for (const g of groups.values()) {
    let at: { x: number; y: number; row: boolean } | null = null;
    const e = g.entity;
    if (e.kind === "fitting") {
      const index = draft.placements.findIndex((p) => p.instanceId === e.instanceId);
      const p = draft.placements[index];
      if (p) {
        const pt = fittingPoint(frame, p.stationPermille, p.side, index);
        at = { x: pt.x + FITTING_OFFSET, y: pt.y - FITTING_OFFSET, row: false };
      }
    } else if (e.kind === "section") {
      const z = zones.find((q) => q.id === SECTIONS[e.id].zoneId);
      if (z) at = { x: frame.x((z.startPermille + z.endPermille) / 2), y: rowY, row: true };
    } else {
      const room = rooms[e.index];
      if (room) at = { x: frame.x(room.stationPermille), y: rowY, row: true };
    }
    if (!at) continue;
    const sorted = [...g.findings].sort(
      (a, b) =>
        severityRank(a.severity) - severityRank(b.severity) ||
        (a.rule < b.rule ? -1 : a.rule > b.rule ? 1 : 0),
    );
    anchored.push({ entity: e, findings: sorted, ...at });
  }
  anchored.sort((a, b) => a.x - b.x || a.y - b.y);
  const placed: MarkerGroup[] = [];
  for (const m of anchored) {
    let { x, y } = m;
    for (let i = 0; i < 8 && placed.some((q) => Math.hypot(q.x - x, q.y - y) < STEP); i++) {
      if (m.row) x += STEP;
      else y -= STEP;
    }
    placed.push({
      entity: m.entity,
      findings: m.findings,
      x: Math.min(PLAN_W - R, x),
      y: Math.max(R, y),
    });
  }
  return placed;
}

function shapePath(shape: MarkerShape, x: number, y: number): string {
  switch (shape) {
    case "octagon": {
      const a = R * 0.41;
      return `M${x - a},${y - R} L${x + a},${y - R} L${x + R},${y - a} L${x + R},${y + a} L${x + a},${y + R} L${x - a},${y + R} L${x - R},${y + a} L${x - R},${y - a} Z`;
    }
    case "diamond":
      return `M${x},${y - R - 1} L${x + R + 1},${y} L${x},${y + R + 1} L${x - R - 1},${y} Z`;
    case "triangle":
      return `M${x},${y - R - 1} L${x + R + 1},${y + R - 1} L${x - R - 1},${y + R - 1} Z`;
    case "circle":
      return `M${x - R},${y} a${R},${R} 0 1,0 ${2 * R},0 a${R},${R} 0 1,0 ${-2 * R},0`;
  }
}

export function FindingMarkers({
  groups,
  names,
  hidden,
}: {
  readonly groups: readonly MarkerGroup[];
  readonly names: (entity: ShipEntity) => string;
  readonly hidden: boolean;
}) {
  const store = useSelectionStore();
  const selected = useShipSelection((s) => s.selected);
  const format = usePresentationFormat();
  const [cursor, setCursor] = useState(0);
  const refs = useRef(new Map<string, SVGGElement>());
  if (hidden || groups.length === 0) return null;
  const current = Math.min(cursor, groups.length - 1);
  const move = (to: number, e: KeyboardEvent) => {
    e.preventDefault();
    const next = (to + groups.length) % groups.length;
    setCursor(next);
    refs.current.get(entityKey(groups[next]!.entity))?.focus();
  };
  return (
    <svg
      viewBox={`0 0 ${PLAN_W} ${PLAN_H}`}
      className="pointer-events-none absolute inset-0 size-full"
      role="toolbar"
      aria-label="Findings on the plan"
      data-testid="finding-markers"
    >
      {groups.map((g, i) => {
        const top = g.findings[0]!;
        const style = SEVERITY_STYLE[top.severity];
        const more = g.findings.length - 1;
        const k = entityKey(g.entity);
        const isSelected = sameEntity(selected, g.entity);
        const name = `${style.label}: ${top.title} (${names(g.entity)})${more > 0 ? `, ${g.findings.length} findings` : ""}`;
        const activate = () => store.select(g.entity, top.key);
        const values = valueLine(top, format);
        return (
          <HoverCard key={k} onOpenChange={(open) => store.setMarkerPreview(open)}>
            <HoverCardTrigger
              render={
                <g
                  ref={(el) => {
                    if (el) refs.current.set(k, el);
                    else refs.current.delete(k);
                  }}
                  role="button"
                  aria-label={name}
                  aria-pressed={isSelected}
                  tabIndex={i === current ? 0 : -1}
                  data-marker={k}
                  data-severity={top.severity}
                  data-count={g.findings.length}
                  className="group pointer-events-auto cursor-pointer outline-none"
                  onFocus={() => setCursor(i)}
                  onClick={activate}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      activate();
                    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") move(i + 1, e);
                    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") move(i - 1, e);
                    else if (e.key === "Home") move(0, e);
                    else if (e.key === "End") move(groups.length - 1, e);
                  }}
                />
              }
            >
              <circle
                cx={g.x}
                cy={g.y}
                r={R + 3}
                className={
                  isSelected
                    ? "fill-none stroke-primary"
                    : "fill-none stroke-transparent group-hover:stroke-ring group-focus-visible:stroke-ring"
                }
                strokeWidth={isSelected ? 2 : 1.5}
                {...NON_SCALING}
              />
              <path
                d={shapePath(style.shape, g.x, g.y)}
                className={style.fill}
                strokeWidth={STROKE.structure}
                strokeLinejoin="round"
                {...NON_SCALING}
              />
              <text
                x={g.x}
                y={g.y + 2.6}
                textAnchor="middle"
                fontSize={7.5}
                className={
                  top.severity === "WARNING"
                    ? "fill-foreground font-bold"
                    : "fill-background font-bold"
                }
                aria-hidden="true"
              >
                {top.severity === "ADVISORY" ? "i" : "!"}
              </text>
              {more > 0 && (
                <g aria-hidden="true">
                  <circle
                    cx={g.x + R}
                    cy={g.y - R}
                    r={4}
                    className="fill-background stroke-foreground"
                    strokeWidth={0.8}
                    {...NON_SCALING}
                  />
                  <text
                    x={g.x + R}
                    y={g.y - R + 2.3}
                    textAnchor="middle"
                    fontSize={6}
                    className="fill-foreground"
                  >
                    {g.findings.length}
                  </text>
                </g>
              )}
            </HoverCardTrigger>
            <HoverCardContent className="w-80 space-y-0.5 text-left">
              <p className="font-medium">
                {style.label}: {top.title}
              </p>
              {values && <p>{values}</p>}
              {more > 0 && (
                <p>
                  And {more} more finding{more === 1 ? "" : "s"} here.
                </p>
              )}
            </HoverCardContent>
          </HoverCard>
        );
      })}
    </svg>
  );
}
