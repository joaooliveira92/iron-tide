export const CAMERA_STATE_VERSION = 1;

export type CameraProjection = "globe" | "mercator";

export interface AppCameraState {
  readonly version: typeof CAMERA_STATE_VERSION;
  readonly centre: readonly [number, number];
  readonly zoom: number;
  readonly bearing: number;
  readonly pitch: number;
  readonly projection: CameraProjection;
}

export interface RendererCameraState {
  readonly centre: readonly [number, number];
  readonly zoom: number;
  readonly bearing: number;
  readonly pitch: number;
  readonly projection: CameraProjection;
}

export const DEFAULT_APP_CAMERA: AppCameraState = {
  version: CAMERA_STATE_VERSION,
  centre: [10, 30],
  zoom: 1.4,
  bearing: 0,
  pitch: 0,
  projection: "globe",
};

export class CameraContractError extends Error {
  readonly _tag = "CameraContractError";
  readonly reason: "version" | "shape" | "range";

  constructor(reason: CameraContractError["reason"], message: string) {
    super(message);
    this.reason = reason;
  }
}

function finite(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new CameraContractError("shape", `${label} must be a finite number`);
  }
  return value;
}

function wrapLongitude(value: number): number {
  const wrapped = ((value + 180) % 360) - 180;
  return wrapped === -180 ? 180 : wrapped;
}

export function clampCamera(state: AppCameraState): AppCameraState {
  return {
    ...state,
    centre: [
      wrapLongitude(state.centre[0]),
      Math.max(-85.0511287798066, Math.min(85.0511287798066, state.centre[1])),
    ],
    zoom: Math.max(0, Math.min(22, state.zoom)),
    bearing: ((state.bearing % 360) + 360) % 360,
    pitch: Math.max(0, Math.min(85, state.pitch)),
  };
}

export function decodeCameraState(value: unknown): AppCameraState | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (record.version !== CAMERA_STATE_VERSION) return null;
  const centre = record.centre;
  if (!Array.isArray(centre) || centre.length !== 2) return null;
  const projection = record.projection;
  if (projection !== "globe" && projection !== "mercator") return null;
  try {
    return clampCamera({
      version: CAMERA_STATE_VERSION,
      centre: [finite(centre[0], "centre.lon"), finite(centre[1], "centre.lat")],
      zoom: finite(record.zoom, "zoom"),
      bearing: finite(record.bearing, "bearing"),
      pitch: finite(record.pitch, "pitch"),
      projection,
    });
  } catch (error) {
    if (error instanceof CameraContractError) return null;
    throw error;
  }
}

export function toRendererCamera(state: AppCameraState): RendererCameraState {
  const clamped = clampCamera(state);
  return {
    centre: clamped.centre,
    zoom: clamped.zoom,
    bearing: clamped.bearing,
    pitch: clamped.pitch,
    projection: clamped.projection,
  };
}

export function fromRendererCamera(state: RendererCameraState): AppCameraState {
  return clampCamera({
    version: CAMERA_STATE_VERSION,
    centre: state.centre,
    zoom: state.zoom,
    bearing: state.bearing,
    pitch: state.pitch,
    projection: state.projection,
  });
}

export function fitWorldCamera(projection: CameraProjection): AppCameraState {
  return {
    ...DEFAULT_APP_CAMERA,
    projection,
    zoom: projection === "globe" ? 1.2 : 1.6,
  };
}

export function returnToNorth(state: AppCameraState): AppCameraState {
  return { ...state, bearing: 0 };
}
