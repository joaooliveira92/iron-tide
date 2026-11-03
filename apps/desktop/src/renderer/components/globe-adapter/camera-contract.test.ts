import { describe, expect, it } from "vite-plus/test";

import {
  CAMERA_STATE_VERSION,
  DEFAULT_APP_CAMERA,
  clampCamera,
  decodeCameraState,
  fitWorldCamera,
  fromRendererCamera,
  returnToNorth,
  toRendererCamera,
  type AppCameraState,
} from "./camera-contract.js";

describe("camera contract", () => {
  it("round-trips a versioned camera without leaking renderer internals", () => {
    const state: AppCameraState = {
      version: CAMERA_STATE_VERSION,
      centre: [12.5, 41.9],
      zoom: 4.25,
      bearing: 330,
      pitch: 35,
      projection: "globe",
    };
    const restored = fromRendererCamera(toRendererCamera(state));
    expect(restored).toEqual(state);
  });

  it("normalises longitude, bearing and latitude into a safe range", () => {
    const clamped = clampCamera({
      ...DEFAULT_APP_CAMERA,
      centre: [200, 95],
      bearing: -30,
      pitch: 120,
      zoom: 40,
    });
    expect(clamped.centre).toEqual([-160, 85.0511287798066]);
    expect(clamped.bearing).toBe(330);
    expect(clamped.pitch).toBe(85);
    expect(clamped.zoom).toBe(22);
  });

  it("leaves an in-range longitude bit-for-bit unchanged across repeated round trips", () => {
    let state: AppCameraState = { ...DEFAULT_APP_CAMERA, centre: [-3.2, 55.9] };
    for (let pass = 0; pass < 5; pass += 1) {
      state = fromRendererCamera(toRendererCamera(state));
    }
    expect(state.centre).toEqual([-3.2, 55.9]);
  });

  it("rejects an unknown version or malformed state and falls back", () => {
    expect(decodeCameraState({ ...DEFAULT_APP_CAMERA, version: 2 })).toBeNull();
    expect(decodeCameraState({ ...DEFAULT_APP_CAMERA, centre: [0] })).toBeNull();
    expect(decodeCameraState({ ...DEFAULT_APP_CAMERA, zoom: "4" })).toBeNull();
    expect(decodeCameraState(DEFAULT_APP_CAMERA)).toEqual(DEFAULT_APP_CAMERA);
  });

  it("defines fit-world and return-to-north fallbacks", () => {
    expect(fitWorldCamera("globe").projection).toBe("globe");
    expect(fitWorldCamera("mercator").projection).toBe("mercator");
    expect(returnToNorth({ ...DEFAULT_APP_CAMERA, bearing: 42 }).bearing).toBe(0);
  });
});
