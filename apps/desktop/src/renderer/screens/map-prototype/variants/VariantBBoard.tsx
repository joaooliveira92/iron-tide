/**
 * PROTOTYPE — throwaway. See ../README.md.
 *
 * Variant B — "Stylised board".
 *
 * Premise: throw the coastlines away. There is no projection, no polygon and
 * no geography — an area is a tile on a grid, an edge is a drawn connector,
 * and a passage is a gate sitting on that connector. The player reads hops
 * directly because hops are the only thing on screen.
 *
 * Costs this variant makes visible, both of which are schema questions:
 *
 * - It needs a **second authored layout** (`tile`), unrelated to the polygon.
 *   Two layouts means two things to keep in sync when an area is added.
 * - A board has **no wrap**. The Pacific runs off both ends of the grid, and
 *   the three-copy trick that saves the geographic variants is unavailable
 *   because tiles are discrete. Long connectors are drawn as labelled stubs
 *   instead — the board-game answer, shown here so it can be judged.
 *
 * Unlike variant A this uses the app's own theme tokens throughout, so it can
 * be judged as "part of Bluewave" rather than as a chart pasted into Bluewave.
 */

import { useMemo } from "react";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import {
  AREAS,
  AREAS_BY_ID,
  EDGES,
  FLEETS,
  NATIONS,
  PASSAGES_BY_ID,
  POSSESSIONS,
} from "../../../components/world-map/fixture-world.js";
import {
  LAYERS,
  areaControl,
  nationFill,
  nationName,
  nationStroke,
  summariseArea,
} from "../../../components/world-map/map-state.js";
import { useMapCamera } from "../../../components/world-map/useMapCamera.js";
import type { MapViewProps } from "../../../components/world-map/map-contract.js";

const TILE_WIDTH = 152;
const TILE_HEIGHT = 108;
const GUTTER_X = 26;
const GUTTER_Y = 30;
const COLUMNS = 15;
const ROWS = 9;
const BOARD_WIDTH = COLUMNS * (TILE_WIDTH + GUTTER_X);
const BOARD_HEIGHT = ROWS * (TILE_HEIGHT + GUTTER_Y);

/** A connector this wide across the board would read as noise, so it stubs. */
const STUB_THRESHOLD = 6;

interface TileBox {
  readonly x: number;
  readonly y: number;
  readonly cx: number;
  readonly cy: number;
  readonly col: number;
}

function boxFor(col: number, row: number): TileBox {
  const x = col * (TILE_WIDTH + GUTTER_X) + GUTTER_X / 2;
  const y = row * (TILE_HEIGHT + GUTTER_Y) + GUTTER_Y / 2;
  return { x, y, cx: x + TILE_WIDTH / 2, cy: y + TILE_HEIGHT / 2, col };
}

export function VariantBBoard({
  state,
  route,
  onSelect,
  onRuler,
  onToggleLayer,
  onToggleClosedPassages,
}: MapViewProps) {
  const format = usePresentationFormat();
  const camera = useMapCamera(BOARD_WIDTH, BOARD_HEIGHT, {
    wrapHorizontally: false,
  });
  const control = areaControl();

  const boxes = useMemo(() => {
    const map = new Map<string, TileBox>();
    for (const area of AREAS) {
      map.set(area.id, boxFor(area.tile[0], area.tile[1]));
    }
    return map;
  }, []);

  const possessionsByArea = useMemo(() => {
    const map = new Map<string, typeof POSSESSIONS>();
    for (const possession of POSSESSIONS) {
      map.set(possession.area, [...(map.get(possession.area) ?? []), possession]);
    }
    return map;
  }, []);

  const fleetsByArea = useMemo(() => {
    const map = new Map<string, typeof FLEETS>();
    for (const fleet of FLEETS) {
      map.set(fleet.area, [...(map.get(fleet.area) ?? []), fleet]);
    }
    return map;
  }, []);

  const routeSet = new Set(route?.path ?? []);
  const routeLegs = useMemo(() => {
    if (route === null) return new Set<string>();
    const legs = new Set<string>();
    for (let i = 0; i < route.path.length - 1; i += 1) {
      const a = route.path[i] as string;
      const b = route.path[i + 1] as string;
      legs.add(a < b ? `${a}|${b}` : `${b}|${a}`);
    }
    return legs;
  }, [route]);

  const summary = state.selected === null ? null : summariseArea(state.selected);

  function handleTileClick(id: string, shiftKey: boolean) {
    if (camera.isDraggingRef.current) return;
    if (shiftKey) onRuler(id);
    else onSelect(id);
  }

  return (
    <div className="flex h-[calc(100svh-9rem)] flex-col gap-3">
      {/* A legend band across the top: on a board, the key is chrome, not overlay. */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {NATIONS.map((nation) => (
            <span
              key={nation.id}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <span
                className="size-2.5 rounded-[2px]"
                style={{ background: nationStroke(nation.id) }}
              />
              {nation.name}
            </span>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {LAYERS.map((layer) => (
            <Button
              key={layer.id}
              type="button"
              size="sm"
              variant={state.layers[layer.id] ? "secondary" : "ghost"}
              onClick={() => onToggleLayer(layer.id)}
            >
              {layer.label}
            </Button>
          ))}
          <Button type="button" size="sm" variant="ghost" onClick={camera.reset}>
            Reset view
          </Button>
          <span
            ref={camera.meterRef}
            className="ml-2 font-mono text-[10px] tabular-nums text-muted-foreground"
          />
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border bg-muted/40">
        <svg
          ref={camera.svgRef}
          className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
          viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          role="application"
          aria-label="Strategic map, stylised board variant"
        >
          <g ref={camera.worldRef}>
            {/* Layer: connectors. On a board these are the geography. */}
            {EDGES.map((edge) => {
              const from = boxes.get(edge.a);
              const to = boxes.get(edge.b);
              if (from === undefined || to === undefined) return null;
              const passage =
                edge.passage === undefined ? null : (PASSAGES_BY_ID.get(edge.passage) ?? null);
              const key = edge.a < edge.b ? `${edge.a}|${edge.b}` : `${edge.b}|${edge.a}`;
              const onRouteLeg = routeLegs.has(key);
              const stroke =
                passage !== null && !passage.open
                  ? "var(--destructive)"
                  : onRouteLeg
                    ? "var(--warning)"
                    : "var(--border)";
              const width = onRouteLeg ? 6 : passage !== null ? 4 : 2.5;

              if (Math.abs(from.col - to.col) > STUB_THRESHOLD) {
                // Wrap-around leg: two stubs rather than a line across the board.
                return (
                  <g key={key}>
                    {[
                      {
                        box: from,
                        other: edge.b,
                        dir: from.col > to.col ? 1 : -1,
                      },
                      {
                        box: to,
                        other: edge.a,
                        dir: to.col > from.col ? 1 : -1,
                      },
                    ].map(({ box, other, dir }) => (
                      <g key={other}>
                        <line
                          x1={box.cx + dir * (TILE_WIDTH / 2)}
                          y1={box.cy}
                          x2={box.cx + dir * (TILE_WIDTH / 2 + 22)}
                          y2={box.cy}
                          stroke={stroke}
                          strokeWidth={width}
                          strokeLinecap="round"
                        />
                        <text
                          x={box.cx + dir * (TILE_WIDTH / 2 + 26)}
                          y={box.cy + 3}
                          fontSize={10}
                          textAnchor={dir > 0 ? "start" : "end"}
                          fill="var(--muted-foreground)"
                          style={{ pointerEvents: "none" }}
                        >
                          {dir > 0 ? "→ " : "← "}
                          {AREAS_BY_ID.get(other)?.short ?? other}
                        </text>
                      </g>
                    ))}
                  </g>
                );
              }

              const mx = (from.cx + to.cx) / 2;
              const my = (from.cy + to.cy) / 2;
              return (
                <g key={key}>
                  <line
                    x1={from.cx}
                    y1={from.cy}
                    x2={to.cx}
                    y2={to.cy}
                    stroke={stroke}
                    strokeWidth={width}
                    strokeLinecap="round"
                    strokeDasharray={passage !== null && !passage.open ? "10 7" : undefined}
                  />
                  {state.layers.passages && passage !== null && (
                    <g>
                      <rect
                        x={mx - 13}
                        y={my - 13}
                        width={26}
                        height={26}
                        rx={13}
                        fill="var(--card)"
                        stroke={passage.open ? "var(--border)" : "var(--destructive)"}
                        strokeWidth={2}
                      />
                      <text
                        x={mx}
                        y={my + 4}
                        textAnchor="middle"
                        fontSize={12}
                        fontWeight={600}
                        fill={passage.open ? "var(--foreground)" : "var(--destructive)"}
                        style={{ pointerEvents: "none" }}
                      >
                        {passage.kind === "canal" ? "⚓" : "⌁"}
                      </text>
                      {camera.zoomBand >= 1 && (
                        <text
                          x={mx}
                          y={my + 28}
                          textAnchor="middle"
                          fontSize={10}
                          fill="var(--muted-foreground)"
                          style={{ pointerEvents: "none" }}
                        >
                          {passage.name}
                        </text>
                      )}
                    </g>
                  )}
                </g>
              );
            })}

            {/* Layer: tiles. Ownership is a solid fill, not a wash. */}
            {AREAS.map((area) => {
              const box = boxes.get(area.id);
              if (box === undefined) return null;
              const held = control.get(area.id);
              const selected = state.selected === area.id;
              const onRouteLeg = routeSet.has(area.id);
              const areaPossessions = possessionsByArea.get(area.id) ?? [];
              const areaFleets = fleetsByArea.get(area.id) ?? [];
              return (
                <g
                  key={area.id}
                  className="cursor-pointer"
                  onClick={(event) => handleTileClick(area.id, event.shiftKey)}
                >
                  <rect
                    x={box.x}
                    y={box.y}
                    width={TILE_WIDTH}
                    height={TILE_HEIGHT}
                    rx={10}
                    fill={
                      state.layers.ownership
                        ? nationFill(held?.owner ?? null, selected ? 0.55 : 0.3)
                        : "var(--card)"
                    }
                    stroke={
                      selected ? "var(--ring)" : onRouteLeg ? "var(--warning)" : "var(--border)"
                    }
                    strokeWidth={selected || onRouteLeg ? 3 : 1.5}
                  />
                  {state.layers.labels && (
                    <text
                      x={box.cx}
                      y={box.y + 24}
                      textAnchor="middle"
                      fontSize={15}
                      fontWeight={500}
                      fill="var(--foreground)"
                      style={{ pointerEvents: "none" }}
                    >
                      {area.short}
                    </text>
                  )}
                  {state.layers.ownership && (
                    <text
                      x={box.cx}
                      y={box.y + 41}
                      textAnchor="middle"
                      fontSize={11}
                      fill="var(--muted-foreground)"
                      style={{ pointerEvents: "none" }}
                    >
                      {held?.owner == null ? "unclaimed" : nationName(held.owner)}
                      {held?.contested === true ? " · contested" : ""}
                    </text>
                  )}
                  {/* Possessions as pips along the tile's foot. */}
                  {state.layers.possessions &&
                    areaPossessions.map((possession, index) => (
                      <circle
                        key={possession.id}
                        cx={box.x + 16 + index * 13}
                        cy={box.y + TILE_HEIGHT - 14}
                        r={possession.base === "major" ? 5 : 3.5}
                        fill={nationStroke(possession.owner)}
                        stroke="var(--card)"
                        strokeWidth={1.5}
                      />
                    ))}
                  {/* Fleets as counters, stacked the way a wargame stacks them. */}
                  {state.layers.fleets &&
                    areaFleets.map((fleet, index) => (
                      <g
                        key={fleet.id}
                        transform={`translate(${box.x + TILE_WIDTH - 24 - index * 20} ${box.y + TILE_HEIGHT - 22})`}
                      >
                        <rect
                          width={26}
                          height={20}
                          rx={3}
                          fill={nationStroke(fleet.owner)}
                          stroke="var(--card)"
                          strokeWidth={1.5}
                        />
                        <text
                          x={13}
                          y={14}
                          textAnchor="middle"
                          fontSize={11}
                          fontWeight={700}
                          fill="oklch(0.18 0 0)"
                          style={{ pointerEvents: "none" }}
                        >
                          {fleet.ships}
                        </text>
                      </g>
                    ))}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Chrome: a drawer, not an overlay panel. It takes space when open. */}
        {summary !== null && (
          <div className="absolute inset-x-0 bottom-0 border-t bg-card/95 px-4 py-3 backdrop-blur">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <span className="text-sm font-medium">{summary.name}</span>
              <Badge variant="secondary">
                {nationName(summary.control.owner)}
                {summary.control.contested ? " · contested" : ""}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {summary.possessions.map((p) => p.name).join(", ") || "no possessions"}
              </span>
              {summary.fleets.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {summary.fleets.map((f) => `${f.name} (${f.ships})`).join(" · ")}
                </span>
              )}
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {summary.neighbours.length} adjacent
                </span>
                <Button size="sm" variant="ghost" onClick={() => onSelect(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 rounded-lg border bg-card px-4 py-2.5 text-xs">
        {route === null ? (
          <span className="text-muted-foreground">Shift-click two tiles for a route reading</span>
        ) : (
          <>
            <span>
              <strong className="tabular-nums">{format.count(route.hops)}</strong> hops
            </span>
            <span className="tabular-nums text-muted-foreground">
              {format.count(route.nauticalMiles)} nm
            </span>
            <span className="tabular-nums text-muted-foreground">
              {format.count(route.perHop)} nm/hop
            </span>
            <span className="tabular-nums text-muted-foreground">
              ≈{format.number(route.months, { maximumFractionDigits: 1 })} months at 3,100 nm/month
            </span>
            {route.passages.length > 0 && (
              <span className="text-muted-foreground">via {route.passages.join(", ")}</span>
            )}
          </>
        )}
        <Button className="ml-auto" size="sm" variant="outline" onClick={onToggleClosedPassages}>
          {state.respectClosedPassages ? "Avoiding closed passages" : "Ignoring closed passages"}
        </Button>
      </div>
    </div>
  );
}
