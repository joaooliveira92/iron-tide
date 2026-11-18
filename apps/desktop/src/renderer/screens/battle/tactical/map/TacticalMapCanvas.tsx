import {
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type WheelEvent,
} from "react";
import { translate } from "../../../../lib/strings.js";
import { useBattleActions, useBattleCameraState } from "../../session/battle-session-contexts.js";
import { PROVISIONAL_ZOOM_STEP, panCamera, zoomCameraAt } from "../tactical-geometry.js";
import { TACTICAL_PALETTE } from "../tactical-palette.js";
import { rectangleFromCorners, type ScreenRectangle } from "../tactical-rectangle.js";
import { useTacticalMap } from "./tactical-map-context.js";

const PAN_KEY_PIXELS = 48;
const DRAG_THRESHOLD_PIXELS = 3;

interface Drag {
  readonly mode: "pan" | "zoom";
  readonly x: number;
  readonly y: number;
  readonly origin: readonly [number, number];
  readonly moved: boolean;
}

const localPoint = (event: PointerEvent<SVGSVGElement>): readonly [number, number] => {
  const rect = event.currentTarget.getBoundingClientRect();
  return [event.clientX - rect.left, event.clientY - rect.top];
};

export function TacticalMapCanvas({ children }: { readonly children: ReactNode }) {
  const { viewport, cursor } = useTacticalMap();
  const { camera } = useBattleCameraState();
  const { changeCamera, selectShip, toggleFollow, zoomToRectangle } = useBattleActions();
  const drag = useRef<Drag | null>(null);
  const [selection, setSelection] = useState<ScreenRectangle | null>(null);
  const centre: readonly [number, number] = [viewport.width / 2, viewport.height / 2];

  const onWheel = (event: WheelEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const anchor: readonly [number, number] = [event.clientX - rect.left, event.clientY - rect.top];
    changeCamera(
      zoomCameraAt(
        camera,
        viewport,
        event.deltaY < 0 ? PROVISIONAL_ZOOM_STEP : 1 / PROVISIONAL_ZOOM_STEP,
        anchor,
      ),
    );
  };

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    drag.current = {
      mode: event.shiftKey ? "zoom" : "pan",
      x: event.clientX,
      y: event.clientY,
      origin: localPoint(event),
      moved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const point = localPoint(event);
    cursor.write(point);
    const dragState = drag.current;
    if (dragState === null) return;
    const dx = event.clientX - dragState.x;
    const dy = event.clientY - dragState.y;
    if (dragState.mode === "zoom") {
      const travelled = Math.hypot(point[0] - dragState.origin[0], point[1] - dragState.origin[1]);
      if (!dragState.moved && travelled < DRAG_THRESHOLD_PIXELS) return;
      drag.current = { ...dragState, moved: true };
      setSelection(rectangleFromCorners(dragState.origin, point));
      return;
    }
    if (!dragState.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PIXELS) return;
    drag.current = { ...dragState, x: event.clientX, y: event.clientY, moved: true };
    changeCamera(panCamera(camera, [dx, dy]));
  };

  const onPointerUp = (event: PointerEvent<SVGSVGElement>) => {
    const dragState = drag.current;
    drag.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (dragState === null) return;
    if (dragState.mode === "zoom" && dragState.moved) {
      setSelection(null);
      zoomToRectangle(rectangleFromCorners(dragState.origin, localPoint(event)));
    } else if (!dragState.moved && event.target === event.currentTarget) {
      selectShip(null);
    }
  };

  const cancelSelection = () => {
    drag.current = null;
    setSelection(null);
  };

  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    const pan: Record<string, readonly [number, number]> = {
      ArrowLeft: [PAN_KEY_PIXELS, 0],
      ArrowRight: [-PAN_KEY_PIXELS, 0],
      ArrowUp: [0, PAN_KEY_PIXELS],
      ArrowDown: [0, -PAN_KEY_PIXELS],
    };
    const delta = pan[event.key];
    const plain = !event.ctrlKey && !event.metaKey && !event.altKey;
    if (delta !== undefined) {
      event.preventDefault();
      changeCamera(panCamera(camera, delta));
    } else if (
      event.key === "+" ||
      event.key === "=" ||
      (plain && event.key.toLowerCase() === "z")
    ) {
      changeCamera(zoomCameraAt(camera, viewport, PROVISIONAL_ZOOM_STEP, centre));
    } else if (event.key === "-" || (plain && event.key.toLowerCase() === "x")) {
      changeCamera(zoomCameraAt(camera, viewport, 1 / PROVISIONAL_ZOOM_STEP, centre));
    } else if (event.key === "f" || event.key === "F") {
      toggleFollow();
    } else if (event.key === "Escape") {
      if (selection === null) selectShip(null);
      else cancelSelection();
    }
  };

  return (
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
      onPointerLeave={() => cursor.write(null)}
      onPointerUp={onPointerUp}
      onPointerCancel={cancelSelection}
      onKeyDown={onKeyDown}
    >
      <rect width={viewport.width} height={viewport.height} fill={TACTICAL_PALETTE.sea} />
      {children}
      {selection === null ? null : (
        <rect
          data-testid="tactical-zoom-rectangle"
          x={selection.left}
          y={selection.top}
          width={selection.width}
          height={selection.height}
          fill={TACTICAL_PALETTE.selection}
          fillOpacity={0.12}
          stroke={TACTICAL_PALETTE.selection}
          strokeWidth={1.5}
          strokeDasharray="6 4"
          pointerEvents="none"
        />
      )}
    </svg>
  );
}
