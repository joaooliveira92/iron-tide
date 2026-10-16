import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Layer, ManagedRuntime } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import {
  DEFAULT_APP_PREFERENCES,
  PREFERENCES_SCHEMA_VERSION,
  type AppPreferences,
  type PreferencesSnapshot,
} from "../../shared/preferences-contract.js";
import { AppPaths, type AppPathsShape } from "../runtime/platform.js";
import {
  PREFERENCES_FILENAME,
  PreferencesStore,
  preferencesStoreLayer,
} from "./preferencesStore.js";

/** A fake `AppPaths` pinned to a per-test temp dir (the only external boundary). */
function appPathsLayer(userDataDir: string): Layer.Layer<AppPaths> {
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

function makeRuntime(userDataDir: string) {
  return ManagedRuntime.make(
    preferencesStoreLayer().pipe(Layer.provide(appPathsLayer(userDataDir))),
  );
}

type StoreRuntime = ReturnType<typeof makeRuntime>;

const readStore = (runtime: StoreRuntime): Promise<PreferencesSnapshot> =>
  runtime.runPromise(
    Effect.gen(function* () {
      const store = yield* PreferencesStore;
      return yield* store.read();
    }),
  );

const writeStore = (runtime: StoreRuntime, app: AppPreferences): Promise<PreferencesSnapshot> =>
  runtime.runPromise(
    Effect.gen(function* () {
      const store = yield* PreferencesStore;
      return yield* store.write(app);
    }),
  );

describe("preferences store", () => {
  let root: string;
  let runtime: StoreRuntime;
  const filePath = () => join(root, PREFERENCES_FILENAME);

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "bw-desktop-preferences-"));
    runtime = makeRuntime(root);
  });
  afterEach(async () => {
    await runtime.dispose();
    rmSync(root, { recursive: true, force: true });
  });

  it("recovers the central defaults when the file is missing", async () => {
    const snapshot = await readStore(runtime);
    expect(snapshot.version).toBe(PREFERENCES_SCHEMA_VERSION);
    expect(snapshot.app).toEqual(DEFAULT_APP_PREFERENCES);
  });

  it("recovers the central defaults when the file is corrupt or undecodable", async () => {
    writeFileSync(filePath(), "{ this is not json", "utf8");
    expect((await readStore(runtime)).app).toEqual(DEFAULT_APP_PREFERENCES);

    // Well-formed JSON that fails the strict schema (unknown key) also recovers.
    writeFileSync(filePath(), JSON.stringify({ version: 1, app: { theme: "neon" } }), "utf8");
    expect((await readStore(runtime)).app).toEqual(DEFAULT_APP_PREFERENCES);
  });

  it("writes atomically: persists the full object and leaves no .tmp behind", async () => {
    const app: AppPreferences = {
      ...DEFAULT_APP_PREFERENCES,
      theme: "dark",
      background: "stars",
      interfaceDensity: "compact",
    };
    const written = await writeStore(runtime, app);
    expect(written).toEqual({ version: PREFERENCES_SCHEMA_VERSION, app });

    const raw = JSON.parse(readFileSync(filePath(), "utf8"));
    expect(raw).toEqual({ version: PREFERENCES_SCHEMA_VERSION, app });
    expect(existsSync(`${filePath()}.tmp`)).toBe(false);
  });

  it("reports a failed write with a stable tag and leaves no partial artifact", async () => {
    const app: AppPreferences = { ...DEFAULT_APP_PREFERENCES, theme: "dark" };
    await writeStore(runtime, app);
    // Remove the directory after a valid write so the next atomic write cannot
    // land — the previous file (now gone with the dir) is never left partial.
    rmSync(root, { recursive: true, force: true });

    const error: unknown = await writeStore(runtime, { ...app, theme: "light" }).then(
      () => null,
      (thrown: unknown) => thrown,
    );
    expect(error).toMatchObject({ _tag: "PreferencesWriteFailed" });
    expect(existsSync(filePath())).toBe(false);
    expect(existsSync(`${filePath()}.tmp`)).toBe(false);
  });

  it("round-trips a write through a fresh runtime read", async () => {
    const app: AppPreferences = {
      ...DEFAULT_APP_PREFERENCES,
      theme: "light",
      font: "jakarta",
      textScale: 115,
      measurementSelections: { speed: "knots" },
    };
    await writeStore(runtime, app);

    const fresh = makeRuntime(root);
    try {
      const snapshot = await readStore(fresh);
      expect(snapshot.app).toEqual(app);
      expect(snapshot.version).toBe(PREFERENCES_SCHEMA_VERSION);
    } finally {
      await fresh.dispose();
    }
  });
});
