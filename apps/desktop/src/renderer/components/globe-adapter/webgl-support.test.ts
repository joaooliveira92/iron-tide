import { describe, expect, it } from "vite-plus/test";

import { detectGraphicsSupport, type GraphicsCanvas } from "./webgl-support.js";

function canvasWith(contexts: Record<string, unknown>): GraphicsCanvas {
  return {
    getContext(name: string) {
      const value = contexts[name];
      if (value instanceof Error) throw value;
      return value ?? null;
    },
  };
}

describe("graphics capability detection", () => {
  it("prefers WebGL2 when it is available", () => {
    expect(detectGraphicsSupport(() => canvasWith({ webgl2: {}, webgl: {} }))).toEqual({
      supported: true,
      api: "webgl2",
    });
  });

  it("accepts WebGL1 when WebGL2 is absent", () => {
    expect(detectGraphicsSupport(() => canvasWith({ webgl: {} }))).toEqual({
      supported: true,
      api: "webgl",
    });
  });

  it("falls back when no context can be created", () => {
    expect(detectGraphicsSupport(() => canvasWith({}))).toEqual({
      supported: false,
      reason: "WebGL is unavailable on this device",
    });
  });

  it("falls back when the context factory throws", () => {
    expect(
      detectGraphicsSupport(() =>
        canvasWith({ webgl2: new Error("blocked"), webgl: new Error("blocked") }),
      ),
    ).toEqual({ supported: false, reason: "WebGL is unavailable on this device" });
  });

  it("falls back when there is no canvas", () => {
    expect(detectGraphicsSupport(() => null)).toEqual({
      supported: false,
      reason: "no canvas element is available",
    });
  });
});
