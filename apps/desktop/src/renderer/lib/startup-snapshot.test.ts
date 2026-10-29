import { describe, expect, it } from "vite-plus/test";
import type { BluewaveDesktopBridge } from "../../preload/index.js";
import type { AppStartupSnapshot, BridgeResult } from "../../shared/bridge-contract.js";
import {
  DEFAULT_APP_PREFERENCES,
  PREFERENCES_SCHEMA_VERSION,
} from "../../shared/preferences-contract.js";
import { loadStartupSnapshot } from "./startup-snapshot.js";

const snapshot: AppStartupSnapshot = {
  preferences: { version: PREFERENCES_SCHEMA_VERSION, app: DEFAULT_APP_PREFERENCES },
  windowState: {
    platform: "darwin",
    isMaximized: true,
    maximizable: true,
    minimizable: true,
  },
};

function bridgeReturning(
  result: BridgeResult<AppStartupSnapshot> | Promise<BridgeResult<AppStartupSnapshot>>,
): { bridge: BluewaveDesktopBridge; calls: () => number } {
  let calls = 0;
  const bridge = {
    readStartupSnapshot: () => {
      calls += 1;
      return Promise.resolve(result);
    },
  } as BluewaveDesktopBridge;
  return { bridge, calls: () => calls };
}

describe("loadStartupSnapshot", () => {
  it("returns the startup snapshot from a single request", async () => {
    const table = bridgeReturning({ outcome: "success", value: snapshot, diagnostics: [] });
    await expect(loadStartupSnapshot(table.bridge)).resolves.toEqual(snapshot);
    expect(table.calls()).toBe(1);
  });

  it("returns null when the snapshot request reports an error", async () => {
    const table = bridgeReturning({
      outcome: "error",
      reason: "PREFERENCES_READ_FAILED",
      diagnostics: ["bad file"],
    });
    await expect(loadStartupSnapshot(table.bridge)).resolves.toBeNull();
  });

  it("returns null when the bridge is missing or the request rejects", async () => {
    await expect(loadStartupSnapshot(undefined)).resolves.toBeNull();
    const bridge = {
      readStartupSnapshot: () => Promise.reject(new Error("ipc down")),
    } as BluewaveDesktopBridge;
    await expect(loadStartupSnapshot(bridge)).resolves.toBeNull();
  });
});
