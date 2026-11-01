import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  use,
  useMemo,
  useState,
} from "react";

import type { AppCameraState } from "../globe-adapter/camera-contract.js";
import { initialMapPrototypeState, type MapPrototypeState } from "./map-state.js";

export interface SharedWorldMap {
  readonly state: MapPrototypeState;
  readonly setState: Dispatch<SetStateAction<MapPrototypeState>>;
  readonly camera: AppCameraState | null;
  readonly setCamera: (camera: AppCameraState) => void;
}

const SharedWorldMapContext = createContext<SharedWorldMap | null>(null);

export function SharedWorldMapProvider({ children }: { readonly children: ReactNode }) {
  const [state, setState] = useState<MapPrototypeState>(initialMapPrototypeState);
  const [camera, setCamera] = useState<AppCameraState | null>(null);
  const value = useMemo(() => ({ state, setState, camera, setCamera }), [state, camera]);
  return <SharedWorldMapContext.Provider value={value}>{children}</SharedWorldMapContext.Provider>;
}

export function useSharedWorldMap(): SharedWorldMap | null {
  return use(SharedWorldMapContext);
}
