import { useEffect, useState } from "react";

import type { CameraView, MapCamera } from "./useMapCamera.js";

export function useCameraView(camera: MapCamera): CameraView {
  const [view, setView] = useState<CameraView>(() => camera.getView());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const bump = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setView(camera.getView()), 120);
    };
    const unsubscribe = camera.subscribe(bump);
    bump();
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [camera.getView, camera.subscribe]);
  return view;
}
