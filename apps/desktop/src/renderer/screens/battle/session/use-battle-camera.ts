import type { PlayerBattleView } from "@bluewave/combat/battleResolution";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  PROVISIONAL_ZOOM_STEP,
  centreCameraOn,
  fitCamera,
  zoomCameraAt,
  type TacticalCamera,
  type TacticalViewport,
  type WorldPoint,
} from "../tactical/tactical-geometry.js";
import { appendTrails, knownPositions, type Trails } from "../tactical/tactical-model.js";

const INITIAL_CAMERA: TacticalCamera = { centreX: 0, centreY: 0, metresPerPixel: 400 };
const INITIAL_VIEWPORT: TacticalViewport = { width: 800, height: 480 };

export interface BattleCamera {
  readonly camera: TacticalCamera;
  readonly viewport: TacticalViewport;
  readonly trails: Trails;
  readonly changeCamera: (camera: TacticalCamera) => void;
  readonly setViewport: (viewport: TacticalViewport) => void;
  readonly zoomIn: () => void;
  readonly zoomOut: () => void;
  readonly fit: () => void;
  readonly focus: () => void;
}

export function useBattleCamera(
  view: PlayerBattleView | null,
  focusPoint: WorldPoint | null,
): BattleCamera {
  const [camera, setCamera] = useState<TacticalCamera>(INITIAL_CAMERA);
  const [viewport, setViewport] = useState<TacticalViewport>(INITIAL_VIEWPORT);
  const [trailed, setTrailed] = useState<{
    readonly view: PlayerBattleView | null;
    readonly trails: Trails;
  }>({ view: null, trails: {} });
  const fittedKey = useRef("");
  const userMoved = useRef(false);

  if (view !== null && trailed.view !== view) {
    setTrailed({ view, trails: appendTrails(trailed.trails, view) });
  }
  const trails = trailed.trails;

  useEffect(() => {
    if (view === null) return;
    const points = knownPositions(view);
    const key = `${String(points.length)}:${String(view.ended)}:${String(viewport.width)}x${String(viewport.height)}`;
    if (!userMoved.current && key !== fittedKey.current) {
      fittedKey.current = key;
      setCamera((current) => fitCamera(points, viewport, current));
    }
  }, [view, viewport]);

  const changeCamera = useCallback((next: TacticalCamera) => {
    userMoved.current = true;
    setCamera(next);
  }, []);

  const zoomIn = useCallback((): void => {
    const centre: WorldPoint = [viewport.width / 2, viewport.height / 2];
    setCamera((current) => zoomCameraAt(current, viewport, PROVISIONAL_ZOOM_STEP, centre));
  }, [viewport]);

  const zoomOut = useCallback((): void => {
    const centre: WorldPoint = [viewport.width / 2, viewport.height / 2];
    setCamera((current) => zoomCameraAt(current, viewport, 1 / PROVISIONAL_ZOOM_STEP, centre));
  }, [viewport]);

  const fit = useCallback((): void => {
    if (view === null) return;
    setCamera((current) => fitCamera(knownPositions(view), viewport, current));
  }, [view, viewport]);

  const focus = useCallback((): void => {
    if (focusPoint !== null) setCamera((current) => centreCameraOn(current, focusPoint));
  }, [focusPoint]);

  return { camera, viewport, trails, changeCamera, setViewport, zoomIn, zoomOut, fit, focus };
}
