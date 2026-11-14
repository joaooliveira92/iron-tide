import { formatMeasurement } from "../../../../lib/presentation-format/format.js";
import { UM_PER_NAUTICAL_MILE } from "../../../../lib/presentation-format/units.js";
import { useBattleState } from "../../session/battle-session-contexts.js";
import { shipPoint } from "../tactical-model.js";
import { TACTICAL_PALETTE } from "../tactical-palette.js";
import { useTacticalMap } from "./tactical-map-context.js";

const PREVIEW_LENGTH_PX = 90;
const STANDING_COURSE_LENGTH_PX = 260;
const RING_COUNT = 4;

function RangeRings() {
  const { shipsById, project, bar, pixelsPerNm, measurement } = useTacticalMap();
  const state = useBattleState();
  const selected = state.selectedShipId === null ? undefined : shipsById.get(state.selectedShipId);
  if (!state.overlays.rings || !selected?.position) return null;
  return Array.from({ length: RING_COUNT }, (_, index) => {
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
          {formatMeasurement(radiusNm * UM_PER_NAUTICAL_MILE, measurement)}
        </text>
      </g>
    );
  });
}

function Tracks() {
  const { visibleShips, project, playerSide } = useTacticalMap();
  const state = useBattleState();
  if (!state.overlays.tracks) return null;
  return visibleShips.map((ship) => {
    const history = state.trails[ship.shipId] ?? [];
    if (history.length < 2) return null;
    const points = history.map((point) => project(point).join(",")).join(" ");
    return (
      <polyline
        key={`trail-${ship.shipId}`}
        data-testid="tactical-trail"
        points={points}
        fill="none"
        stroke={ship.sideId === playerSide ? TACTICAL_PALETTE.own : TACTICAL_PALETTE.hostile}
        strokeOpacity={0.35}
        strokeWidth={1.5}
        pointerEvents="none"
      />
    );
  });
}

function FiringLines() {
  const { shipsById, project } = useTacticalMap();
  const state = useBattleState();
  if (!state.overlays.fire) return null;
  return state.markers.firing.map((line) => {
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
  });
}

function Impacts() {
  const { shipsById, project, symbolSize } = useTacticalMap();
  const state = useBattleState();
  if (!state.overlays.fire) return null;
  return state.markers.impacts.map((targetId) => {
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
        r={symbolSize + 6}
        fill="none"
        stroke={TACTICAL_PALETTE.impact}
        strokeWidth={2}
        pointerEvents="none"
      />
    );
  });
}

function StandingCourses() {
  const { shipsById, project } = useTacticalMap();
  const state = useBattleState();
  return state.standingCourses.map((course) => {
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
  });
}

function CoursePreviewLine() {
  const { shipsById, project } = useTacticalMap();
  const state = useBattleState();
  const { preview } = state;
  if (preview === null) return null;
  const target = shipsById.get(preview.shipId);
  const point = target === undefined ? null : shipPoint(target);
  if (point === null) return null;
  const [x, y] = project(point);
  const radians = (preview.headingDeg * Math.PI) / 180;
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
}

export function TacticalMapOverlays() {
  return (
    <>
      <RangeRings />
      <Tracks />
      <FiringLines />
      <Impacts />
      <StandingCourses />
      <CoursePreviewLine />
    </>
  );
}
