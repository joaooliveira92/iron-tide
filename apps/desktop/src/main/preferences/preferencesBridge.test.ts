import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Layer, ManagedRuntime } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import {
  DEFAULT_APP_PREFERENCES,
  DEFAULT_CAMPAIGN_PREFERENCES,
  PREFERENCES_SCHEMA_VERSION,
  type AppPreferences,
  type CampaignPreferences,
} from "../../shared/preferences-contract.js";
import {
  clearCampaignSessionsForTest,
  registerCampaignSession,
  type CampaignSessionRecord,
} from "../campaignSessions.js";
import { desktopMainLayer, type CommandEnv } from "../runtime/desktopMainLayer.js";
import { AppPaths, type AppPathsShape } from "../runtime/platform.js";
import { CAMPAIGN_PREFERENCES_FILENAME } from "./campaignPreferencesStore.js";
import { createPreferencesBridge, type PreferencesBridge } from "./preferencesBridge.js";
import {
  InvalidPreferencesPayload,
  isPreferencesError,
  projectPreferencesError,
} from "./preferencesErrors.js";
import { PREFERENCES_FILENAME, preferencesStoreLayer } from "./preferencesStore.js";

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

function makeRuntime(userDataDir: string): ManagedRuntime.ManagedRuntime<CommandEnv, never> {
  return ManagedRuntime.make(
    Layer.mergeAll(
      desktopMainLayer(),
      preferencesStoreLayer().pipe(Layer.provide(fakeAppPathsLayer(userDataDir))),
    ),
  );
}

describe("preferences bridge", () => {
  let root: string;
  let runtime: ManagedRuntime.ManagedRuntime<CommandEnv, never>;
  let bridge: PreferencesBridge;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "bw-desktop-preferences-bridge-"));
    clearCampaignSessionsForTest();
    runtime = makeRuntime(root);
    bridge = createPreferencesBridge(() => runtime);
  });
  afterEach(async () => {
    await runtime.dispose();
    clearCampaignSessionsForTest();
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

  it("re-reads a written value after a fresh composition (fresh runtime, same profile)", async () => {
    const app: AppPreferences = {
      ...DEFAULT_APP_PREFERENCES,
      theme: "highContrast",
      interfaceDensity: "compact",
      textScale: 115,
      measurementPreset: "metric",
      currencyDisplayMode: "budgetPoints",
    };
    expect((await bridge.write({ app })).outcome).toBe("success");
    await runtime.dispose();

    const fresh = makeRuntime(root);
    try {
      const read = await createPreferencesBridge(() => fresh).read();
      expect(read.outcome).toBe("success");
      if (read.outcome === "success") expect(read.value.app).toEqual(app);
    } finally {
      await fresh.dispose();
    }
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

  it("a rejected payload is not persisted: the stored file is byte-unchanged", async () => {
    const app: AppPreferences = { ...DEFAULT_APP_PREFERENCES, theme: "dark" };
    expect((await bridge.write({ app })).outcome).toBe("success");
    const file = join(root, PREFERENCES_FILENAME);
    const before = readFileSync(file, "utf8");

    const rejected = await bridge.write({
      app: { ...DEFAULT_APP_PREFERENCES, theme: "light", excess: true },
    });
    expect(rejected.outcome).toBe("error");
    if (rejected.outcome === "error") expect(rejected.reason).toBe("INVALID_PREFERENCES_PAYLOAD");
    expect(readFileSync(file, "utf8")).toBe(before);

    const read = await bridge.read();
    if (read.outcome === "success") expect(read.value.app).toEqual(app);
  });

  it("round-trips campaign-scope preferences through the real session-backed sidecar", async () => {
    const saveDir = join(root, "save");
    mkdirSync(saveDir, { recursive: true });
    registerCampaignSession({ sessionId: "session-1", saveDir } as CampaignSessionRecord);
    const campaign: CampaignPreferences = {
      ...DEFAULT_CAMPAIGN_PREFERENCES,
      showSupplyOverlay: true,
      confirmBeforeTurn: false,
    };

    const written = await bridge.writeCampaign("session-1", { campaign });
    expect(written.outcome).toBe("success");
    if (written.outcome === "success") expect(written.value.campaign).toEqual(campaign);
    expect(readFileSync(join(saveDir, CAMPAIGN_PREFERENCES_FILENAME), "utf8")).toContain(
      '"showSupplyOverlay": true',
    );

    const read = await bridge.readCampaign("session-1");
    expect(read.outcome).toBe("success");
    if (read.outcome === "success") expect(read.value.campaign).toEqual(campaign);
  });

  it("rejects a campaign-scope excess-key payload and leaves the sidecar unchanged", async () => {
    const saveDir = join(root, "save");
    mkdirSync(saveDir, { recursive: true });
    registerCampaignSession({ sessionId: "session-1", saveDir } as CampaignSessionRecord);
    const campaign: CampaignPreferences = { ...DEFAULT_CAMPAIGN_PREFERENCES };
    expect((await bridge.writeCampaign("session-1", { campaign })).outcome).toBe("success");
    const file = join(saveDir, CAMPAIGN_PREFERENCES_FILENAME);
    const before = readFileSync(file, "utf8");

    const rejected = await bridge.writeCampaign("session-1", {
      campaign: { ...campaign, extra: true },
    });
    expect(rejected.outcome).toBe("error");
    if (rejected.outcome === "error") expect(rejected.reason).toBe("INVALID_PREFERENCES_PAYLOAD");
    expect(readFileSync(file, "utf8")).toBe(before);
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
