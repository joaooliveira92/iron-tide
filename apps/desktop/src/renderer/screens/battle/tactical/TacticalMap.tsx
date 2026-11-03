import type { PlayerBattleShipView, PlayerBattleView } from "@bluewave/combat/battleResolution";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type WheelEvent,
} from "react";
import { playerSideOf } from "../../../../shared/player-battle-orders.js";
import { niceScaleBar } from "../../../components/world-map/map-scale.js";
import { formatMeasurement } from "../../../lib/presentation-format/format.js";
import { UM_PER_METRE, UM_PER_NAUTICAL_MILE } from "../../../lib/presentation-format/units.js";
import { usePreferences } from "../../../lib/preferences-context.js";
import { translate } from "../../../lib/strings.js";
import { lodBandFor } from "../../tactical-map/tacticalScale.js";
import {
  PROVISIONAL_ZOOM_STEP,
  compassFromHeading,
  panCamera,
  screenToWorld,
  visibleLabelKeys,
  worldToScreen,
  zoomCameraAt,
  type LabelCandidate,
  type TacticalCamera,
  type TacticalViewport,
} from "./tactical-geometry.js";
import type { TransientMarkers } from "./tactical-log.js";
import { shipPoint, shipStatus, type Trails } from "./tactical-model.js";
import { TACTICAL_PALETTE } from "./tactical-palette.js";

export type NameFilter = "all" | "selected" | "none";

export interface StandingCourse {
  readonly shipId: string;
  readonly headingDeg: number;
}

export interface MapOverlays {
  readonly labels: NameFilter;
  readonly tracks: boolean;
  readonly rings: boolean;
  readonly fire: boolean;
}

export interface CoursePreview {
  readonly shipId: string;
  readonly headingDeg: number;
}

export interface TacticalMapProps {
  readonly view: PlayerBattleView;
  readonly camera: TacticalCamera;
  readonly onCameraChange: (camera: TacticalCamera) => void;
  readonly onViewportChange: (viewport: TacticalViewport) => void;
  readonly selectedShipId: string | null;
  readonly onSelectShip: (shipId: string | null) => void;
  readonly overlays: MapOverlays;
  readonly trails: Trails;
  readonly markers: TransientMarkers;
  readonly stepIntervalMs: number;
  readonly paused: boolean;
  readonly coursePreview: CoursePreview | null;
  readonly standingCourses: readonly StandingCourse[];
}

const FALLBACK_VIEWPORT: TacticalViewport = { width: 800, height: 480 };
const PAN_KEY_PIXELS = 48;
const SCALE_BAR_MAX_PX = 140;
const LABEL_CHAR_PX = 6.8;
const LABEL_HEIGHT_PX = 16;
const PREVIEW_LENGTH_PX = 90;
const STANDING_COURSE_LENGTH_PX = 260;
const RING_COUNT = 4;

const SIDE_COLOUR = { own: TACTICAL_PALETTE.own, hostile: TACTICAL_PALETTE.hostile } as const;

function symbolSize(band: ReturnType<typeof lodBandFor>): number {
  if (band === "symbols") return 5;
  if (band === "hulls") return 8;
  return 12;
}

export function TacticalMap(props: TacticalMapProps) {
  const {
    view,
    camera,
    onCameraChange,
    onViewportChange,
    selectedShipId,
    onSelectShip,
    overlays,
    trails,
    markers,
    stepIntervalMs,
    paused,
    coursePreview,
    standingCourses,
  } = props;
  const { preferences } = usePreferences();
  const frame = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState<TacticalViewport>(FALLBACK_VIEWPORT);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const [cursor, setCursor] = useState<readonly [number, number] | null>(null);

  useEffect(() => {
    const element = frame.current;
    if (element === null || typeof ResizeObserver === "undefined") return undefined;
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      if (width > 0 && height > 0) {
        const next = { width: Math.round(width), height: Math.round(height) };
        setViewport(next);
        onViewportChange(next);
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [onViewportChange]);

  const playerSide = playerSideOf(view);
  const band = lodBandFor(camera.metresPerPixel);
  const size = symbolSize(band);
  const project = useCallback(
    (point: readonly [number, number]) => worldToScreen(camera, viewport, point),
    [camera, viewport],
  );

  const shipsById = useMemo(
    () => new Map(view.ships.map((ship) => [ship.shipId, ship])),
    [view.ships],
  );

  const visibleShips = useMemo(
    () => view.ships.filter((ship) => ship.position !== null),
    [view.ships],
  );

  const labelKeys = useMemo(() => {
    if (overlays.labels === "none") return new Set<string>();
    const named =
      overlays.labels === "selected"
        ? visibleShips.filter((ship) => ship.shipId === selectedShipId)
        : visibleShips;
    const candidates: LabelCandidate[] = named.map((ship) => {
      const [x, y] = project(shipPoint(ship)!);
      const width = ship.name.length * LABEL_CHAR_PX + 8;
      const priority =
        (ship.shipId === selectedShipId ? 100 : 0) +
        (ship.sideId === playerSide ? 10 : 0) +
        (view.divisions.some((division) => division.flagshipId === ship.shipId) ? 5 : 0);
      return {
        key: ship.shipId,
        priority,
        x: x + size + 4,
        y: y - LABEL_HEIGHT_PX / 2,
        width,
        height: LABEL_HEIGHT_PX,
      };
    });
    return visibleLabelKeys(candidates);
  }, [overlays.labels, visibleShips, project, selectedShipId, playerSide, view.divisions, size]);

  const pixelsPerNm = UM_PER_NAUTICAL_MILE / UM_PER_METRE / camera.metresPerPixel;
  const bar = niceScaleBar(pixelsPerNm, SCALE_BAR_MAX_PX);
  const barText =
    bar.nm > 0
      ? formatMeasurement(bar.nm * UM_PER_NAUTICAL_MILE, {
          locale: preferences.formattingLocale,
          category: "range",
          preset: preferences.measurementPreset,
          selections: preferences.measurementSelections,
        })
      : "";

  const selected = selectedShipId === null ? undefined : shipsById.get(selectedShipId);
  const measurement = {
    locale: preferences.formattingLocale,
    category: "range",
    preset: preferences.measurementPreset,
    selections: preferences.measurementSelections,
  } as const;
  const selectedPoint = selected === undefined ? null : shipPoint(selected);
  let cursorDistance: string | null = null;
  if (cursor !== null && selectedPoint !== null) {
    const world = screenToWorld(camera, viewport, cursor);
    cursorDistance = formatMeasurement(
      Math.round(Math.hypot(world[0] - selectedPoint[0], world[1] - selectedPoint[1])),
      measurement,
    );
  }
  const centre: readonly [number, number] = [viewport.width / 2, viewport.height / 2];

  const onWheel = (event: WheelEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const anchor: readonly [number, number] = [event.clientX - rect.left, event.clientY - rect.top];
    onCameraChange(
      zoomCameraAt(
        camera,
        viewport,
        event.deltaY < 0 ? PROVISIONAL_ZOOM_STEP : 1 / PROVISIONAL_ZOOM_STEP,
        anchor,
      ),
    );
  };

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    drag.current = { x: event.clientX, y: event.clientY, moved: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setCursor([event.clientX - rect.left, event.clientY - rect.top]);
    const state = drag.current;
    if (state === null) return;
    const dx = event.clientX - state.x;
    const dy = event.clientY - state.y;
    if (!state.moved && Math.hypot(dx, dy) < 3) return;
    drag.current = { x: event.clientX, y: event.clientY, moved: true };
    onCameraChange(panCamera(camera, [dx, dy]));
  };

  const onPointerUp = (event: PointerEvent<SVGSVGElement>) => {
    const state = drag.current;
    drag.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (state !== null && !state.moved && event.target === event.currentTarget) {
      onSelectShip(null);
    }
  };

  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    const pan: Record<string, readonly [number, number]> = {
      ArrowLeft: [PAN_KEY_PIXELS, 0],
      ArrowRight: [-PAN_KEY_PIXELS, 0],
      ArrowUp: [0, PAN_KEY_PIXELS],
      ArrowDown: [0, -PAN_KEY_PIXELS],
    };
    const delta = pan[event.key];
    if (delta !== undefined) {
      event.preventDefault();
      onCameraChange(panCamera(camera, delta));
    } else if (event.key === "+" || event.key === "=") {
      onCameraChange(zoomCameraAt(camera, viewport, PROVISIONAL_ZOOM_STEP, centre));
    } else if (event.key === "-") {
      onCameraChange(zoomCameraAt(camera, viewport, 1 / PROVISIONAL_ZOOM_STEP, centre));
    } else if (event.key === "Escape") {
      onSelectShip(null);
    }
  };

  const selectOnKey = (event: KeyboardEvent<SVGGElement>, ship: PlayerBattleShipView) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      onSelectShip(ship.shipId);
    }
  };

  const moveStyle = paused ? undefined : `transform ${String(stepIntervalMs)}ms linear`;

  return (
    <div
      ref={frame}
      className="relative h-full min-h-72 w-full overflow-hidden rounded border border-border bg-slate-950"
    >
      <svg
        data-testid="tactical-map"
        role="application"
        aria-label={translate("tactical.map.label")}
        tabIndex={0}
        width="100%"
        height="100%"
        viewBox={`0 0 ${String(viewport.width)} ${String(viewport.height)}`}
        className="block touch-none select-none cursor-grab active:cursor-grabbing"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setCursor(null)}
        onPointerUp={onPointerUp}
        onKeyDown={onKeyDown}
      >
        <rect width={viewport.width} height={viewport.height} fill={TACTICAL_PALETTE.sea} />

        {overlays.rings && selected?.position
          ? Array.from({ length: RING_COUNT }, (_, index) => {
              const radiusNm = bar.nm * (index + 1);
              if (radiusNm <= 0) return null;
              const [x, y] = project(shipPoint(selected)!);
              const radius = radiusNm * pixelsPerNm;
              return (
                <g key={radiusNm} data-testid="tactical-ring" pointerEvents="none">
                  <circle
                    cx={x}
                    cy={y}
                    r={radius}
                    fill="none"
                    stroke={TACTICAL_PALETTE.ring}
                    strokeWidth={1}
                    strokeDasharray="4 4"
                  />
                  <text
                    x={x}
                    y={y + radius + 12}
                    textAnchor="middle"
                    fill={TACTICAL_PALETTE.ringLabel}
                    fontSize={12}
                  >
                    {formatMeasurement(radiusNm * UM_PER_NAUTICAL_MILE, {
                      locale: preferences.formattingLocale,
                      category: "range",
                      preset: preferences.measurementPreset,
                      selections: preferences.measurementSelections,
                    })}
                  </text>
                </g>
              );
            })
          : null}

        {overlays.tracks
          ? visibleShips.map((ship) => {
              const history = trails[ship.shipId] ?? [];
              if (history.length < 2) return null;
              const points = history.map((point) => project(point).join(",")).join(" ");
              return (
                <polyline
                  key={`trail-${ship.shipId}`}
                  data-testid="tactical-trail"
                  points={points}
                  fill="none"
                  stroke={ship.sideId === playerSide ? SIDE_COLOUR.own : SIDE_COLOUR.hostile}
                  strokeOpacity={0.35}
                  strokeWidth={1.5}
                  pointerEvents="none"
                />
              );
            })
          : null}

        {overlays.fire
          ? markers.firing.map((line) => {
              const from = shipsById.get(line.actorShipId);
              const to = shipsById.get(line.targetShipId);
              const a = from === undefined ? null : shipPoint(from);
              const b = to === undefined ? null : shipPoint(to);
              if (a === null || b === null) return null;
              const [x1, y1] = project(a);
              const [x2, y2] = project(b);
              return (
                <line
                  key={`fire-${line.actorShipId}-${line.targetShipId}`}
                  data-testid="tactical-firing-line"
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={TACTICAL_PALETTE.firingLine}
                  strokeOpacity={0.55}
                  strokeWidth={1}
                  strokeDasharray="2 3"
                  pointerEvents="none"
                />
              );
            })
          : null}

        {overlays.fire
          ? markers.impacts.map((targetId) => {
              const target = shipsById.get(targetId);
              const point = target === undefined ? null : shipPoint(target);
              if (point === null) return null;
              const [x, y] = project(point);
              return (
                <circle
                  key={`impact-${targetId}`}
                  data-testid="tactical-impact"
                  cx={x}
                  cy={y}
                  r={size + 6}
                  fill="none"
                  stroke={TACTICAL_PALETTE.impact}
                  strokeWidth={2}
                  pointerEvents="none"
                />
              );
            })
          : null}

        {standingCourses.map((course) => {
          const target = shipsById.get(course.shipId);
          const point = target === undefined ? null : shipPoint(target);
          if (point === null) return null;
          const [x, y] = project(point);
          const radians = (course.headingDeg * Math.PI) / 180;
          return (
            <line
              key={`course-${course.shipId}`}
              data-testid="tactical-standing-course"
              x1={x}
              y1={y}
              x2={x + Math.cos(radians) * STANDING_COURSE_LENGTH_PX}
              y2={y - Math.sin(radians) * STANDING_COURSE_LENGTH_PX}
              stroke={TACTICAL_PALETTE.standingCourse}
              strokeOpacity={0.6}
              strokeWidth={1}
              strokeDasharray="8 5"
              pointerEvents="none"
            />
          );
        })}

        {coursePreview !== null
          ? (() => {
              const target = shipsById.get(coursePreview.shipId);
              const point = target === undefined ? null : shipPoint(target);
              if (point === null) return null;
              const [x, y] = project(point);
              const radians = (coursePreview.headingDeg * Math.PI) / 180;
              return (
                <line
                  data-testid="tactical-course-preview"
                  x1={x}
                  y1={y}
                  x2={x + Math.cos(radians) * PREVIEW_LENGTH_PX}
                  y2={y - Math.sin(radians) * PREVIEW_LENGTH_PX}
                  stroke={TACTICAL_PALETTE.coursePreview}
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  pointerEvents="none"
                />
              );
            })()
          : null}

        {visibleShips.map((ship) => {
          const [x, y] = project(shipPoint(ship)!);
          const own = ship.sideId === playerSide;
          const status = shipStatus(ship);
          const colour = own ? SIDE_COLOUR.own : SIDE_COLOUR.hostile;
          const heading = ship.headingDeg ?? 0;
          const opacity =
            status === "sunk"
              ? 0.4
              : ship.contactConfidenceBp === null
                ? 1
                : 0.45 + (0.55 * Math.min(ship.contactConfidenceBp, 10_000)) / 10_000;
          const isSelected = ship.shipId === selectedShipId;
          const isFlagship = view.divisions.some((division) => division.flagshipId === ship.shipId);
          const label = `${ship.name}, ${own ? translate("tactical.side.own") : translate("tactical.side.hostile")}, ${translate(`tactical.status.${status}`)}`;
          return (
            <g
              key={ship.shipId}
              data-testid={`tactical-ship-${ship.shipId}`}
              data-status={status}
              data-side={own ? "own" : "hostile"}
              role="button"
              tabIndex={0}
              aria-label={label}
              aria-pressed={isSelected}
              style={{
                transform: `translate(${String(x)}px, ${String(y)}px)`,
                transition: moveStyle,
                outline: "none",
              }}
              opacity={opacity}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onSelectShip(ship.shipId);
              }}
              onKeyDown={(event) => selectOnKey(event, ship)}
              className="cursor-pointer focus-visible:[&>circle.focus]:stroke-white"
            >
              {isSelected ? (
                <circle
                  r={size + 7}
                  fill="none"
                  stroke={TACTICAL_PALETTE.selection}
                  strokeWidth={2}
                  data-testid="tactical-selection"
                />
              ) : null}
              <circle
                className="focus"
                r={size + 10}
                fill="transparent"
                stroke="transparent"
                strokeWidth={2}
              />
              <g transform={`rotate(${String(-heading)})`}>
                {status === "sunk" ? (
                  <path
                    d={`M${String(-size)} ${String(-size)} L${String(size)} ${String(size)} M${String(-size)} ${String(size)} L${String(size)} ${String(-size)}`}
                    stroke={colour}
                    strokeWidth={2}
                  />
                ) : (
                  <path
                    d={`M${String(size * 1.4)} 0 L${String(-size)} ${String(size * 0.8)} L${String(-size * 0.5)} 0 L${String(-size)} ${String(-size * 0.8)} Z`}
                    fill={status === "damaged" ? "none" : colour}
                    stroke={colour}
                    strokeWidth={status === "damaged" ? 2 : 1}
                    strokeDasharray={status === "damaged" ? "3 2" : undefined}
                  />
                )}
              </g>
              {isFlagship ? (
                <circle r={2} fill={TACTICAL_PALETTE.selection} pointerEvents="none" />
              ) : null}
            </g>
          );
        })}

        {visibleShips
          .filter((ship) => labelKeys.has(ship.shipId))
          .map((ship) => {
            const [x, y] = project(shipPoint(ship)!);
            return (
              <g
                key={`label-${ship.shipId}`}
                pointerEvents="none"
                style={{
                  transform: `translate(${String(x)}px, ${String(y)}px)`,
                  transition: moveStyle,
                }}
              >
                <text
                  data-testid={`tactical-label-${ship.shipId}`}
                  x={size + 6}
                  y={4}
                  fill={
                    ship.sideId === playerSide
                      ? TACTICAL_PALETTE.ownLabel
                      : TACTICAL_PALETTE.hostileLabel
                  }
                  fontSize={12}
                >
                  {ship.name}
                </text>
              </g>
            );
          })}

        <g pointerEvents="none" transform={`translate(12 ${String(viewport.height - 16)})`}>
          <line x1={0} y1={0} x2={bar.px} y2={0} stroke={TACTICAL_PALETTE.chrome} strokeWidth={2} />
          <line x1={0} y1={-4} x2={0} y2={4} stroke={TACTICAL_PALETTE.chrome} strokeWidth={2} />
          <line
            x1={bar.px}
            y1={-4}
            x2={bar.px}
            y2={4}
            stroke={TACTICAL_PALETTE.chrome}
            strokeWidth={2}
          />
          <text
            x={bar.px + 8}
            y={4}
            fill={TACTICAL_PALETTE.chrome}
            fontSize={12}
            data-testid="tactical-scale"
          >
            {barText}
          </text>
        </g>
        <g
          pointerEvents="none"
          transform={`translate(${String(viewport.width - 28)} 28)`}
          aria-hidden="true"
        >
          <circle r={14} fill="none" stroke={TACTICAL_PALETTE.compassRing} />
          <path d="M0 -12 L4 2 L0 -2 L-4 2 Z" fill={TACTICAL_PALETTE.chrome} />
          <text y={-16} textAnchor="middle" fill={TACTICAL_PALETTE.chrome} fontSize={12}>
            N
          </text>
        </g>
      </svg>
      <div
        data-testid="tactical-conditions"
        className="pointer-events-none absolute bottom-2 right-3 space-y-0.5 text-right text-xs font-medium text-slate-300"
      >
        <p>
          {translate("tactical.weather.sky", { sky: view.weather.precipitation.toLowerCase() })}
        </p>
        <p>{translate("tactical.weather.sea", { sea: view.weather.seaState.toLowerCase() })}</p>
        <p>
          {view.weather.daylight
            ? translate("tactical.weather.day")
            : translate("tactical.weather.night")}
        </p>
        <p data-testid="battle-weather">
          {translate("tactical.weather.visibility", {
            range: formatMeasurement(view.weather.visibilityNm * UM_PER_NAUTICAL_MILE, measurement),
          })}
        </p>
        {cursorDistance === null ? null : (
          <p data-testid="tactical-cursor-distance">
            {translate("tactical.cursor.distance", { distance: cursorDistance })}
          </p>
        )}
      </div>
      {selected?.headingDeg == null ? null : (
        <span className="sr-only" data-testid="tactical-selected-bearing">
          {String(compassFromHeading(selected.headingDeg))}
        </span>
      )}
    </div>
  );
}
