import { describe, expect, it } from "vite-plus/test";
import {
  applyContentSecurityPolicy,
  CONTENT_SECURITY_POLICY,
  installContentSecurityPolicy,
  type CspHeaderDetails,
} from "./csp.js";
import { desktopWindowOptions } from "./windowOptions.js";

describe("desktopWindowOptions", () => {
  it("uses the fixed window frame and sandboxed web preferences", () => {
    expect(desktopWindowOptions("darwin", "/app/preload/index.cjs")).toEqual({
      width: 1280,
      height: 820,
      minWidth: 960,
      minHeight: 640,
      frame: false,
      titleBarStyle: "hidden",
      trafficLightPosition: { x: 20, y: 21 },
      webPreferences: {
        preload: "/app/preload/index.cjs",
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
  });

  it("omits macOS title-bar options on other platforms", () => {
    for (const platform of ["win32", "linux"] as const) {
      const options = desktopWindowOptions(platform, "preload");
      expect(options.titleBarStyle).toBeUndefined();
      expect(options.trafficLightPosition).toBeUndefined();
      expect(options.frame).toBe(false);
    }
  });
});

describe("installContentSecurityPolicy", () => {
  const hook = (): {
    listener: ((details: CspHeaderDetails, callback: (result: unknown) => void) => void) | null;
    install: (isDev: boolean) => void;
  } => {
    let listener:
      | ((details: CspHeaderDetails, callback: (result: unknown) => void) => void)
      | null = null;
    return {
      get listener() {
        return listener;
      },
      install: (isDev) =>
        installContentSecurityPolicy(
          {
            webRequest: {
              onHeadersReceived: (next) => {
                listener = next;
              },
            },
          },
          isDev,
        ),
    };
  };

  it("applies the production policy to renderer responses", () => {
    const target = hook();
    target.install(false);
    let result: unknown = null;
    target.listener?.({ url: "file:///renderer/index.html" }, (value) => {
      result = value;
    });
    expect(result).toEqual({
      responseHeaders: applyContentSecurityPolicy(undefined, false),
    });
    expect(JSON.stringify(result)).toContain(CONTENT_SECURITY_POLICY);
  });

  it("leaves unmanaged protocols untouched", () => {
    const target = hook();
    target.install(true);
    let result: unknown = null;
    target.listener?.({ url: "devtools://devtools/bundled/inspector.html" }, (value) => {
      result = value;
    });
    expect(result).toEqual({});
  });
});
