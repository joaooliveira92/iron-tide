import {
  useRef,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type WheelEvent,
} from "react";
import { translate } from "../../../../lib/strings.js";
import { useBattleSession } from "../../session/BattleSession.js";
import { PROVISIONAL_ZOOM_STEP, panCamera, zoomCameraAt } from "../tactical-geometry.js";
import { TACTICAL_PALETTE } from "../tactical-palette.js";
import { useTacticalMap } from "./tactical-map-context.js";

const PAN_KEY_PIXELS = 48;

export function TacticalMapCanvas({ children }: { readonly children: ReactNode }) {
  const { viewport, cursor } = useTacticalMap();
  const { state, actions } = useBattleSession();
  const { camera } = state;
  const { changeCamera, selectShip } = actions;
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
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
    drag.current = { x: event.clientX, y: event.clientY, moved: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    cursor.write([event.clientX - rect.left, event.clientY - rect.top]);
    const dragState = drag.current;
    if (dragState === null) return;
    const dx = event.clientX - dragState.x;
    const dy = event.clientY - dragState.y;
    if (!dragState.moved && Math.hypot(dx, dy) < 3) return;
    drag.current = { x: event.clientX, y: event.clientY, moved: true };
    changeCamera(panCamera(camera, [dx, dy]));
  };

  const onPointerUp = (event: PointerEvent<SVGSVGElement>) => {
    const dragState = drag.current;
    drag.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (dragState !== null && !dragState.moved && event.target === event.currentTarget) {
      selectShip(null);
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
      changeCamera(panCamera(camera, delta));
    } else if (event.key === "+" || event.key === "=") {
      changeCamera(zoomCameraAt(camera, viewport, PROVISIONAL_ZOOM_STEP, centre));
    } else if (event.key === "-") {
      changeCamera(zoomCameraAt(camera, viewport, 1 / PROVISIONAL_ZOOM_STEP, centre));
    } else if (event.key === "Escape") {
      selectShip(null);
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
      onKeyDown={onKeyDown}
    >
      <rect width={viewport.width} height={viewport.height} fill={TACTICAL_PALETTE.sea} />
      {children}
    </svg>
  );
}
