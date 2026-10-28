import { describe, expect, it, vi } from "vite-plus/test";

import { recordRendererDiagnostic } from "./renderer-diagnostics.js";

describe("renderer diagnostics", () => {
  it("records the started renderer and clears a previous fallback reason", () => {
    document.documentElement.dataset.overviewRendererFallback = "old";
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    recordRendererDiagnostic({ renderer: "globe", event: "started" });
    expect(document.documentElement.dataset.overviewRenderer).toBe("globe");
    expect(document.documentElement.dataset.overviewRendererFallback).toBeUndefined();
    expect(window.__bluewaveRendererDiagnostics?.at(-1)).toEqual({
      renderer: "globe",
      event: "started",
    });
    info.mockRestore();
  });

  it("records a structured fallback reason", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    recordRendererDiagnostic({
      renderer: "legacy",
      event: "fallback",
      reason: "WebGL is unavailable on this device",
    });
    expect(document.documentElement.dataset.overviewRenderer).toBe("legacy");
    expect(document.documentElement.dataset.overviewRendererFallback).toBe(
      "WebGL is unavailable on this device",
    );
    expect(window.__bluewaveRendererDiagnostics?.at(-1)).toMatchObject({
      renderer: "legacy",
      event: "fallback",
    });
    warn.mockRestore();
  });
});
