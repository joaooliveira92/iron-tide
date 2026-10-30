export type GraphicsCanvas = {
  getContext(contextId: string): unknown;
};

export type GraphicsSupport =
  | { readonly supported: true; readonly api: "webgl2" | "webgl" }
  | { readonly supported: false; readonly reason: string };

export type CanvasFactory = () => GraphicsCanvas | null;

function defaultCanvas(): GraphicsCanvas | null {
  if (typeof document === "undefined") return null;
  return document.createElement("canvas");
}

export function detectGraphicsSupport(factory: CanvasFactory = defaultCanvas): GraphicsSupport {
  const canvas = factory();
  if (canvas === null) return { supported: false, reason: "no canvas element is available" };
  for (const api of ["webgl2", "webgl"] as const) {
    try {
      const context = canvas.getContext(api);
      if (context !== null) return { supported: true, api };
    } catch {
      continue;
    }
  }
  return { supported: false, reason: "WebGL is unavailable on this device" };
}
