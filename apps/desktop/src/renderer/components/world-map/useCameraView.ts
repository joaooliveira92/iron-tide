import { useStoreLifecycle } from "../../lib/use-store-lifecycle.js";
import type { CameraView, MapCamera } from "./useMapCamera.js";

export function useCameraView(camera: MapCamera): CameraView {
  const [view] = useStoreLifecycle<CameraView>(
    () => camera.getView(),
    (target) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const bump = () => {
        clearTimeout(timer);
        timer = setTimeout(() => target.set(camera.getView()), 120);
      };
      const unsubscribe = camera.subscribe(bump);
      bump();
      return () => {
        clearTimeout(timer);
        unsubscribe();
      };
    },
    [camera.getView, camera.subscribe],
  );
  return view;
}
