import { useCallback, useMemo, useRef, useState } from "react";
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
import type { ScreenRectangle } from "../tactical/tactical-rectangle.js";
import type { TacticalView } from "../tactical/tactical-view.js";
import {
  applyCameraChange,
  frameRectangle,
  trackFocus,
  type CameraFollow,
} from "./camera-follow.js";

const INITIAL_CAMERA: TacticalCamera = { centreX: 0, centreY: 0, metresPerPixel: 400 };
const INITIAL_VIEWPORT: TacticalViewport = { width: 800, height: 480 };

export interface BattleCamera {
  readonly camera: TacticalCamera;
  readonly following: boolean;
  readonly viewport: TacticalViewport;
  readonly trails: Trails;
  readonly changeCamera: (camera: TacticalCamera) => void;
  readonly setViewport: (viewport: TacticalViewport) => void;
  readonly zoomIn: () => void;
  readonly zoomOut: () => void;
  readonly zoomToRectangle: (rect: ScreenRectangle) => void;
  readonly fit: () => void;
  readonly focus: () => void;
  readonly toggleFollow: () => void;
}

export function useBattleCamera(
  view: TacticalView | null,
  focusPoint: WorldPoint | null,
): BattleCamera {
  const [{ camera, following }, setCameraFollow] = useState<CameraFollow>({
    camera: INITIAL_CAMERA,
    following: false,
  });
  const [viewport, setViewport] = useState<TacticalViewport>(INITIAL_VIEWPORT);
  const [trailed, setTrailed] = useState<{
    readonly view: TacticalView | null;
    readonly trails: Trails;
  }>({ view: null, trails: {} });
  const [fittedKey, setFittedKey] = useState("");
  const [userMoved, setUserMoved] = useState(false);
  const [tracked, setTracked] = useState({ focusPoint, following: false });
  const focusRef = useRef<WorldPoint | null>(focusPoint);

  const setCamera = useCallback((update: (current: TacticalCamera) => TacticalCamera) => {
    setCameraFollow((state) => ({ ...state, camera: update(state.camera) }));
  }, []);

  if (view !== null && trailed.view !== view) {
    setTrailed({ view, trails: appendTrails(trailed.trails, view) });
  }
  const trails = trailed.trails;

  const points = useMemo(() => (view === null ? null : knownPositions(view)), [view]);
  if (view !== null && points !== null) {
    const key = `${String(points.length)}:${String(view.ended)}:${String(viewport.width)}x${String(viewport.height)}`;
    if (!userMoved && key !== fittedKey) {
      setFittedKey(key);
      setCamera((current) => fitCamera(points, viewport, current));
    }
  }

  focusRef.current = focusPoint;
  if (tracked.focusPoint !== focusPoint || tracked.following !== following) {
    setTracked({ focusPoint, following });
    setCameraFollow((state) => trackFocus(state, focusPoint));
  }

  const changeCamera = useCallback((next: TacticalCamera) => {
    setUserMoved(true);
    setCameraFollow((state) => applyCameraChange(state, next, focusRef.current));
  }, []);

  const zoomIn = useCallback((): void => {
    const centre: WorldPoint = [viewport.width / 2, viewport.height / 2];
    setCamera((current) => zoomCameraAt(current, viewport, PROVISIONAL_ZOOM_STEP, centre));
  }, [viewport, setCamera]);

  const zoomOut = useCallback((): void => {
    const centre: WorldPoint = [viewport.width / 2, viewport.height / 2];
    setCamera((current) => zoomCameraAt(current, viewport, 1 / PROVISIONAL_ZOOM_STEP, centre));
  }, [viewport, setCamera]);

  const zoomToRectangle = useCallback(
    (rect: ScreenRectangle): void => {
      setUserMoved(true);
      setCameraFollow((state) => frameRectangle(state, viewport, rect));
    },
    [viewport],
  );

  const fit = useCallback((): void => {
    if (view === null) return;
    setCameraFollow((state) => ({
      camera: fitCamera(knownPositions(view), viewport, state.camera),
      following: false,
    }));
  }, [view, viewport]);

  const focus = useCallback((): void => {
    if (focusPoint !== null) setCamera((current) => centreCameraOn(current, focusPoint));
  }, [focusPoint, setCamera]);

  const toggleFollow = useCallback((): void => {
    if (!following) setUserMoved(true);
    setCameraFollow((state) =>
      state.following
        ? { camera: state.camera, following: false }
        : trackFocus({ camera: state.camera, following: true }, focusRef.current),
    );
  }, [following]);

  return {
    camera,
    following,
    viewport,
    trails,
    changeCamera,
    setViewport,
    zoomIn,
    zoomOut,
    zoomToRectangle,
    fit,
    focus,
    toggleFollow,
  };
}
