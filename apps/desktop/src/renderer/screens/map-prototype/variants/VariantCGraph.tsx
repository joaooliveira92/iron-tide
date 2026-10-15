/**
 * PROTOTYPE — throwaway. See ../README.md.
 *
 * Variant C — "Operational graph".
 *
 * Premise: the data model is a graph, so draw the graph. Areas are nodes, not
 * polygons. Coastlines survive only as a faint orientation wash. Ownership is
 * a node *ring* rather than a fill, because a fill on a node says nothing
 * about the water in between. Edges are the loudest thing on screen.
 *
 * The two things this variant exists to settle:
 *
 * - Node positions come from a **computed area centroid**, not the fixture's
 *   hand-placed label anchor. Flip between this and variant A to see whether
 *   the schema needs an authored label at all.
 * - It has no area polygons, so it is the cheapest possible authoring
 *   contract: an area needs one point, not a ring. If this reads well enough
 *   to play, ticket 01's asset layer gets dramatically smaller.
 *
 * Layout is a split, not an overlay: a permanent left rail listing every area,
 * cross-highlighted with the map. Ticket 09 will need a list like this anyway
 * as the keyboard-traversal surface, so it is here to be judged now.
 */

import { useMemo, useState } from "react";
import { Input } from "../../../components/ui/input.js";
import { Button } from "../../../components/ui/button.js";
import {
  AREAS,
  AREAS_BY_ID,
  EDGES,
  FLEETS,
  PASSAGES_BY_ID,
  POSSESSIONS,
} from "../../../components/world-map/fixture-world.js";
import { useCoastline } from "../../../components/world-map/useCoastline.js";
import {
  projectAreas,
  projectionById,
  ringToPath,
  WORLD_WRAP_TURNS,
  type Point,
} from "../../../components/world-map/projection.js";
import {
  areaControl,
  nationName,
  nationStroke,
  summariseArea,
} from "../../../components/world-map/map-state.js";
import { useMapCamera } from "../../../components/world-map/useMapCamera.js";
import type { MapViewProps } from "../../../components/world-map/map-contract.js";

export function VariantCGraph({
  state,
  route,
  onSelect,
  onRuler,
  onToggleClosedPassages,
}: MapViewProps) {
  const projection = projectionById(state.projection);
  const camera = useMapCamera(projection.width, projection.height);
  const control = areaControl();
  const [filter, setFilter] = useState("");

  const coastlineState = useCoastline();
  const coastline = useMemo(
    () =>
      (coastlineState.status === "ready" ? coastlineState.polygons : []).map((rings) =>
        rings
          .map((flat) => {
            const ring: Point[] = [];
            for (let i = 0; i < flat.length; i += 2) {
              ring.push([(flat[i] as number) - state.centre, flat[i + 1] as number]);
            }
            return ringToPath(ring, projection);
          })
          .join(""),
      ),
    [coastlineState, projection, state.centre],
  );

  const nodes = useMemo(() => {
    const projected = projectAreas(AREAS, projection, state.centre);
    return new Map(projected.map((area) => [area.id, area.centroid]));
  }, [projection, state.centre]);

  const weight = useMemo(() => {
    const map = new Map<string, number>();
    for (const possession of POSSESSIONS) {
      map.set(possession.area, (map.get(possession.area) ?? 0) + 1);
    }
    for (const fleet of FLEETS) {
      map.set(fleet.area, (map.get(fleet.area) ?? 0) + 1);
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
  const neighbourIds = new Set(summary?.neighbours.map((n) => n.id) ?? []);

  const listed = AREAS.filter((area) =>
    area.name.toLowerCase().includes(filter.trim().toLowerCase()),
  );

  function handleNodeClick(id: string, shiftKey: boolean) {
    if (camera.isDraggingRef.current) return;
    if (shiftKey) onRuler(id);
    else onSelect(id);
  }

  return (
    <div className="flex h-[calc(100svh-9rem)] gap-4">
      {/* The rail. Permanent, not a drawer — a graph needs an index. */}
      <div className="flex w-80 shrink-0 flex-col gap-3 overflow-hidden rounded-lg border bg-card p-3">
        <Input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter areas"
          className="h-8"
        />
        <div className="min-h-0 flex-1 overflow-auto">
          <ul className="m-0 flex list-none flex-col p-0">
            {listed.map((area) => {
              const held = control.get(area.id);
              const selected = state.selected === area.id;
              const adjacent = neighbourIds.has(area.id);
              return (
                <li key={area.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(area.id)}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs ${
                      selected
                        ? "bg-accent text-accent-foreground"
                        : adjacent
                          ? "bg-muted/60"
                          : "hover:bg-muted/50"
                    }`}
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: nationStroke(held?.owner ?? null) }}
                    />
                    <span className="truncate">{area.name}</span>
                    <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                      {weight.get(area.id) ?? 0}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        {summary !== null && (
          <div className="border-t pt-3 text-xs">
            <div className="font-medium">{summary.name}</div>
            <div className="text-muted-foreground">
              {nationName(summary.control.owner)}
              {summary.control.contested ? " · contested" : ""}
            </div>
            <div className="mt-2 text-muted-foreground">
              {summary.neighbours.length} edges,{" "}
              {summary.neighbours.filter((n) => n.passage !== null).length} gated
            </div>
          </div>
        )}
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border bg-background">
        <svg
          ref={camera.svgRef}
          className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
          viewBox={`0 0 ${projection.width} ${projection.height}`}
          preserveAspectRatio="xMidYMid meet"
          role="application"
          aria-label="Strategic map, operational graph variant"
        >
          <g ref={camera.worldRef}>
            {WORLD_WRAP_TURNS.map((turn) => (
              <g key={turn} transform={`translate(${turn * projection.width} 0)`}>
                {/* Geography demoted to a wash. It orients; it does not inform. */}
                {coastline.map((d, index) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <path key={index} d={d} fill="var(--muted)" fillRule="evenodd" />
                ))}

                {/* Edges are the primary object here. */}
                {EDGES.map((edge) => {
                  const from = nodes.get(edge.a);
                  const to = nodes.get(edge.b);
                  if (from === undefined || to === undefined) return null;
                  const key = edge.a < edge.b ? `${edge.a}|${edge.b}` : `${edge.b}|${edge.a}`;
                  const passage =
                    edge.passage === undefined ? null : (PASSAGES_BY_ID.get(edge.passage) ?? null);
                  const onRouteLeg = routeLegs.has(key);
                  const incident =
                    state.selected !== null &&
                    (edge.a === state.selected || edge.b === state.selected);
                  // Long spans are the Pacific wrapping. Drawn dimmed rather than
                  // hidden, so the seam is visible instead of quietly missing.
                  const wraps = Math.abs(from[0] - to[0]) > projection.width * 0.55;
                  return (
                    <g key={key}>
                      <line
                        x1={from[0]}
                        y1={from[1]}
                        x2={to[0]}
                        y2={to[1]}
                        stroke={
                          onRouteLeg
                            ? "var(--warning)"
                            : passage !== null && !passage.open
                              ? "var(--destructive)"
                              : incident
                                ? "var(--foreground)"
                                : "var(--muted-foreground)"
                        }
                        strokeOpacity={wraps ? 0.18 : onRouteLeg || incident ? 0.95 : 0.4}
                        strokeWidth={onRouteLeg ? 5 : incident ? 3 : 1.8}
                        strokeDasharray={passage !== null && !passage.open ? "8 6" : undefined}
                        strokeLinecap="round"
                      />
                      {state.layers.passages && passage !== null && !wraps && (
                        <g
                          transform={`translate(${(from[0] + to[0]) / 2} ${(from[1] + to[1]) / 2})`}
                        >
                          <rect
                            x={-9}
                            y={-9}
                            width={18}
                            height={18}
                            rx={4}
                            fill="var(--background)"
                            stroke={passage.open ? "var(--muted-foreground)" : "var(--destructive)"}
                            strokeWidth={2}
                          />
                          <text
                            y={4}
                            textAnchor="middle"
                            fontSize={11}
                            fontWeight={700}
                            fill={passage.open ? "var(--foreground)" : "var(--destructive)"}
                            style={{ pointerEvents: "none" }}
                          >
                            {passage.kind === "canal" ? "C" : "S"}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* Nodes. Radius carries presence; the ring carries ownership. */}
                {AREAS.map((area) => {
                  const node = nodes.get(area.id);
                  if (node === undefined) return null;
                  const held = control.get(area.id);
                  const selected = state.selected === area.id;
                  const onRouteLeg = routeSet.has(area.id);
                  const radius = 12 + (weight.get(area.id) ?? 0) * 2.6;
                  return (
                    <g
                      key={area.id}
                      transform={`translate(${node[0]} ${node[1]})`}
                      className="cursor-pointer"
                      onClick={(event) => handleNodeClick(area.id, event.shiftKey)}
                    >
                      <circle
                        r={radius}
                        fill="var(--card)"
                        stroke={
                          selected
                            ? "var(--ring)"
                            : onRouteLeg
                              ? "var(--warning)"
                              : nationStroke(held?.owner ?? null)
                        }
                        strokeWidth={selected || onRouteLeg ? 5 : 3.5}
                        strokeDasharray={held?.contested === true ? "5 4" : undefined}
                      />
                      <text
                        y={4}
                        textAnchor="middle"
                        fontSize={12}
                        fontWeight={600}
                        fill="var(--foreground)"
                        style={{ pointerEvents: "none" }}
                      >
                        {weight.get(area.id) ?? 0}
                      </text>
                      {state.layers.labels && (
                        <text
                          y={radius + 15}
                          textAnchor="middle"
                          fontSize={13}
                          fill="var(--foreground)"
                          stroke="var(--background)"
                          strokeWidth={4}
                          paintOrder="stroke"
                          style={{ pointerEvents: "none" }}
                        >
                          {camera.zoomBand === 0
                            ? (AREAS_BY_ID.get(area.id)?.short ?? "")
                            : area.name}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            ))}
          </g>
        </svg>

        <div className="absolute bottom-3 left-3 flex items-center gap-3 rounded-md border bg-card/95 px-3 py-2 text-xs backdrop-blur">
          {route === null ? (
            <span className="text-muted-foreground">Shift-click two nodes for a route reading</span>
          ) : (
            <>
              <span>
                <strong className="tabular-nums">{route.hops}</strong> hops
              </span>
              <span className="tabular-nums text-muted-foreground">
                {route.nauticalMiles.toLocaleString()} nm · {route.perHop.toLocaleString()} nm/hop ·
                ≈{route.months} months
              </span>
            </>
          )}
          <Button size="sm" variant="ghost" onClick={onToggleClosedPassages}>
            {state.respectClosedPassages ? "avoiding closures" : "ignoring closures"}
          </Button>
          <Button size="sm" variant="ghost" onClick={camera.reset}>
            Reset
          </Button>
          <span
            ref={camera.meterRef}
            className="font-mono text-[10px] tabular-nums text-muted-foreground"
          />
        </div>
      </div>
    </div>
  );
}
