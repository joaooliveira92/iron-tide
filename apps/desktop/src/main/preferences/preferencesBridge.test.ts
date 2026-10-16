import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Layer, ManagedRuntime } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import {
  DEFAULT_APP_PREFERENCES,
  PREFERENCES_SCHEMA_VERSION,
  type AppPreferences,
} from "../../shared/preferences-contract.js";
import { desktopMainLayer, type CommandEnv } from "../runtime/desktopMainLayer.js";
import { AppPaths, type AppPathsShape } from "../runtime/platform.js";
import { createPreferencesBridge, type PreferencesBridge } from "./preferencesBridge.js";
import {
  InvalidPreferencesPayload,
  isPreferencesError,
  projectPreferencesError,
} from "./preferencesErrors.js";
import { preferencesStoreLayer } from "./preferencesStore.js";

/**
 * `desktopMainLayer()` closes over the real `AppPaths` when it builds its own
 * store (via `Layer.provideMerge`), so an outer `Layer.succeed(AppPaths, fake)`
 * cannot reach it. Compose the real `preferencesStoreLayer()` over a fake
 * `AppPaths` and merge it last, so the bridge resolves the temp-dir-backed store.
 */
function fakeAppPathsLayer(userDataDir: string): Layer.Layer<AppPaths> {
  const shape: AppPathsShape = {
    supportDir: () => Effect.succeed(join(userDataDir, "support")),
    userDataDir: () => Effect.succeed(userDataDir),
    homeDir: userDataDir,
    appVersion: () => Effect.succeed("test"),
    platform: "darwin",
    arch: "arm64",
    processId: 1,
  };
  return Layer.succeed(AppPaths, shape);
}

describe("preferences bridge", () => {
  let root: string;
  let runtime: ManagedRuntime.ManagedRuntime<CommandEnv, never>;
  let bridge: PreferencesBridge;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "bw-desktop-preferences-bridge-"));
    runtime = ManagedRuntime.make(
      Layer.mergeAll(
        desktopMainLayer(),
        preferencesStoreLayer().pipe(Layer.provide(fakeAppPathsLayer(root))),
      ),
    );
    bridge = createPreferencesBridge(() => runtime);
  });
  afterEach(async () => {
    await runtime.dispose();
    rmSync(root, { recursive: true, force: true });
  });

  it("reads the central defaults before any write", async () => {
    const result = await bridge.read();
    expect(result.outcome).toBe("success");
    if (result.outcome === "success") {
      expect(result.value.version).toBe(PREFERENCES_SCHEMA_VERSION);
      expect(result.value.app).toEqual(DEFAULT_APP_PREFERENCES);
    }
  });

  it("writes a valid full object and reads it back", async () => {
    const app: AppPreferences = { ...DEFAULT_APP_PREFERENCES, theme: "dark", font: "jakarta" };
    const written = await bridge.write({ app });
    expect(written.outcome).toBe("success");
    if (written.outcome === "success") expect(written.value.app).toEqual(app);

    const read = await bridge.read();
    expect(read.outcome).toBe("success");
    if (read.outcome === "success") expect(read.value.app).toEqual(app);
  });

  it("rejects an excess-key payload with the typed INVALID_PREFERENCES_PAYLOAD reason", async () => {
    const result = await bridge.write({ app: { ...DEFAULT_APP_PREFERENCES, highContrast: true } });
    expect(result.outcome).toBe("error");
    if (result.outcome === "error") expect(result.reason).toBe("INVALID_PREFERENCES_PAYLOAD");
  });

  it("rejects a malformed payload with the typed INVALID_PREFERENCES_PAYLOAD reason", async () => {
    const result = await bridge.write({ app: { theme: "neon" } });
    expect(result.outcome).toBe("error");
    if (result.outcome === "error") expect(result.reason).toBe("INVALID_PREFERENCES_PAYLOAD");
  });

  it("rejects a non-object payload with the typed INVALID_PREFERENCES_PAYLOAD reason", async () => {
    const result = await bridge.write("not-an-object");
    expect(result.outcome).toBe("error");
    if (result.outcome === "error") expect(result.reason).toBe("INVALID_PREFERENCES_PAYLOAD");
  });

  it("pins the InvalidPreferencesPayload _tag and its wire projection", () => {
    const error = new InvalidPreferencesPayload({ issues: ["bad key"] });
    expect(error._tag).toBe("InvalidPreferencesPayload");
    expect(isPreferencesError(error)).toBe(true);
    expect(projectPreferencesError(error)).toEqual({
      outcome: "error",
      reason: "INVALID_PREFERENCES_PAYLOAD",
      diagnostics: ["bad key"],
    });
  });
});
