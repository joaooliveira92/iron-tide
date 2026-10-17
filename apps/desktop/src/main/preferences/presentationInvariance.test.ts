import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Layer, ManagedRuntime } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import { CURRENT_COMPATIBILITY_VERSION } from "@bluewave/persistence";
import {
  CURRENCY_DISPLAY_MODES,
  DEFAULT_APP_PREFERENCES,
  FORMATTING_LOCALES,
  INTERFACE_DENSITY_PREFERENCES,
  LANGUAGE_PREFERENCES,
  MEASUREMENT_PRESETS,
  NUMBER_SCALE_PREFERENCES,
  THEME_PREFERENCES,
  resolveEffectiveCurrencyDisplayMode,
  type AppPreferences,
} from "../../shared/preferences-contract.js";
import { ContentArtifact } from "../runtime/contentArtifact.js";
import { ProjectStore } from "../runtime/projectStore.js";
import { desktopMainLayer, type CommandEnv } from "../runtime/desktopMainLayer.js";
import { AppPaths, type AppPathsShape } from "../runtime/platform.js";
import { toSaveableState } from "../saveHelpers.js";
import { createPreferencesBridge } from "./preferencesBridge.js";
import { migratePreferencesFileData, preferencesStoreLayer } from "./preferencesStore.js";

const DIR = import.meta.dirname;
const GOLDEN = join(DIR, "..", "..", "..", "..", "..", "golden", "hashes.json");
const CROSS_PROCESS_CHILD = join(
  DIR,
  "..",
  "..",
  "..",
  "..",
  "..",
  "packages",
  "cross-process-test",
  "dist",
  "run-child.js",
);

/**
 * The U-5 standing presentation-invariance suite (U-5 ticket 01, ADR-0202). It
 * drives the *real* production composition — the compiled content artifact, the
 * campaign compiler, the `SaveStore`-backed `ProjectStore`, and the real
 * preferences IPC bridge — with every display preference applied, and observes
 * the compiled snapshot hash, the content hash, the authoritative save payload
 * and the canonical money unchanged. A preference that moved any of them would
 * fail here (the ADR-0202 stop surface), never be re-pinned.
 *
 * The save id and `metadata.json` timestamp are app bookkeeping (non-
 * authoritative); the byte-identity assertion is over the authoritative
 * `campaign.json` / `campaign.sig.json` payload.
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

function makeRuntime(appDir: string): ManagedRuntime.ManagedRuntime<CommandEnv, never> {
  return ManagedRuntime.make(
    Layer.mergeAll(
      desktopMainLayer(),
      preferencesStoreLayer().pipe(Layer.provide(fakeAppPathsLayer(appDir))),
    ),
  );
}

interface CompiledArtifact {
  readonly rawHash: string;
  readonly contentHash: string;
  readonly compatibilityVersion: string;
  readonly campaignJson: string;
  readonly signatureJson: string;
  readonly campaignPayloadHash: string;
  readonly treasures: readonly number[];
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Compiles the real production campaign, saves it, and returns the authoritative surface. */
async function compileAndSave(
  runtime: ManagedRuntime.ManagedRuntime<CommandEnv, never>,
  saveDir: string,
): Promise<CompiledArtifact> {
  const compiled = await runtime.runPromise(
    Effect.gen(function* () {
      const content = yield* ContentArtifact;
      const projects = yield* ProjectStore;
      const output = yield* content.compileProductionCampaign();
      const saveable = toSaveableState(output.state);
      yield* projects.save(saveable, saveDir);
      return {
        rawHash: saveable.rawHash,
        contentHash: output.contentHash,
        compatibilityVersion: output.state.snapshot.compatibilityVersion,
        treasures: [...output.state.snapshot.nations.values()].map((nation) =>
          Number(nation.treasury),
        ),
      };
    }),
  );
  mkdirSync(saveDir, { recursive: true });
  const saveEntry = readdirSync(saveDir, { withFileTypes: true }).find(
    (entry) => entry.isDirectory() && !entry.name.startsWith("."),
  );
  if (saveEntry === undefined) throw new Error("no save directory was published");
  const payloadDir = join(saveDir, saveEntry.name);
  const campaignJson = readFileSync(join(payloadDir, "campaign.json"), "utf8");
  const signatureJson = readFileSync(join(payloadDir, "campaign.sig.json"), "utf8");
  return { ...compiled, campaignJson, signatureJson, campaignPayloadHash: sha256(campaignJson) };
}

/** Every preference patch the sprint names, plus the remaining display preferences. */
function preferenceMatrix(): readonly AppPreferences[] {
  const patches: Partial<AppPreferences>[] = [];
  for (const currencyDisplayMode of CURRENCY_DISPLAY_MODES) patches.push({ currencyDisplayMode });
  for (const measurementPreset of MEASUREMENT_PRESETS) patches.push({ measurementPreset });
  for (const numberScale of NUMBER_SCALE_PREFERENCES) patches.push({ numberScale });
  for (const theme of THEME_PREFERENCES) patches.push({ theme });
  for (const interfaceDensity of INTERFACE_DENSITY_PREFERENCES) patches.push({ interfaceDensity });
  for (const language of LANGUAGE_PREFERENCES) patches.push({ language });
  for (const formattingLocale of FORMATTING_LOCALES) patches.push({ formattingLocale });
  return patches.map((patch) => ({ ...DEFAULT_APP_PREFERENCES, ...patch }));
}

describe("presentation invariance (U-5 ticket 01)", () => {
  let appDir: string;
  let runtime: ManagedRuntime.ManagedRuntime<CommandEnv, never>;

  beforeEach(() => {
    appDir = mkdtempSync(join(tmpdir(), "bw-u5-invariance-app-"));
    runtime = makeRuntime(appDir);
  });
  afterEach(async () => {
    await runtime.dispose();
    rmSync(appDir, { recursive: true, force: true });
  });

  it("no display preference moves the compiled snapshot, the save, or the canonical money", async () => {
    const bridge = createPreferencesBridge(() => runtime);
    const goldenBefore = readFileSync(GOLDEN, "utf8");

    // Baseline: compile the real production campaign with the central defaults.
    const baselineApp: AppPreferences = { ...DEFAULT_APP_PREFERENCES };
    expect((await bridge.write({ app: baselineApp })).outcome).toBe("success");
    const baseline = await compileAndSave(runtime, join(appDir, "save-baseline"));

    expect(baseline.rawHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(baseline.contentHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(baseline.compatibilityVersion).toBe(CURRENT_COMPATIBILITY_VERSION);

    // Canonical money is a branded integer, never a formatted string.
    expect(baseline.treasures.length).toBeGreaterThan(0);
    for (const treasury of baseline.treasures) expect(Number.isSafeInteger(treasury)).toBe(true);

    // Negative control: the equality/hash comparison has teeth — a changed
    // authoritative payload is detected, so an unchanged result is meaningful
    // and not "the assertion never compares anything".
    const tamperedJson = `${baseline.campaignJson.slice(0, -2)}x}`;
    expect(tamperedJson).not.toBe(baseline.campaignJson);
    expect(sha256(tamperedJson)).not.toBe(baseline.campaignPayloadHash);

    let index = 0;
    for (const app of preferenceMatrix()) {
      index += 1;
      // The preference is really applied: the write round-trips through the store.
      const written = await bridge.write({ app });
      expect(written.outcome).toBe("success");
      if (written.outcome === "success") expect(written.value.app).toEqual(app);
      const artifact = await compileAndSave(runtime, join(appDir, `save-${String(index)}`));

      // Clause 1: the compiled campaign snapshot hash is identical.
      expect(artifact.rawHash).toBe(baseline.rawHash);
      // Clause 2: the reference (content) hash and the save payload are byte-identical.
      expect(artifact.contentHash).toBe(baseline.contentHash);
      expect(artifact.compatibilityVersion).toBe(baseline.compatibilityVersion);
      expect(artifact.campaignJson).toBe(baseline.campaignJson);
      expect(artifact.signatureJson).toBe(baseline.signatureJson);
      expect(artifact.campaignPayloadHash).toBe(baseline.campaignPayloadHash);

      // Clause 3: no formatted money or currency reason code appears in the save.
      expect(artifact.treasures).toEqual(baseline.treasures);
      for (const forbidden of [
        "£",
        "€",
        "¥",
        " NC",
        " BP",
        "Naval Credits",
        "Budget Points",
        "National Historical",
        "noActiveNation",
        "nationalCurrencyNotConfigured",
        "nationalCurrencyInvalid",
        "nationalCurrencyOutsideSupportedPeriod",
        "settings.currency",
      ]) {
        expect(artifact.campaignJson).not.toContain(forbidden);
      }
    }

    // Clause 6: no golden hash moved and the compatibility version is unchanged.
    expect(readFileSync(GOLDEN, "utf8")).toBe(goldenBefore);
  }, 120_000);

  it("re-asserts the consolidated per-clause proofs (default, fallback, migration, locale/language split)", () => {
    // Clause 2/9: a fresh profile defaults to Naval Credits; NC/BP are honoured.
    expect(DEFAULT_APP_PREFERENCES.currencyDisplayMode).toBe("navalCredits");
    expect(resolveEffectiveCurrencyDisplayMode("navalCredits", { kind: "noActiveNation" })).toEqual(
      {
        mode: "navalCredits",
      },
    );
    expect(resolveEffectiveCurrencyDisplayMode("budgetPoints", { kind: "noActiveNation" })).toEqual(
      {
        mode: "budgetPoints",
      },
    );

    // Clause 9: National Historical falls back to Naval Credits with a reason.
    expect(
      resolveEffectiveCurrencyDisplayMode("nationalHistorical", {
        kind: "nationalCurrencyNotConfigured",
      }),
    ).toEqual({ mode: "navalCredits", fallbackReason: "nationalCurrencyNotConfigured" });

    // Clauses 8/12: text (language) and number formatting (locale) are independent
    // unions; the money formatter reads only the formatting locale, never the language.
    expect(LANGUAGE_PREFERENCES).toEqual(["en"]);
    expect(FORMATTING_LOCALES).toEqual(["en-US"]);
    expect(DEFAULT_APP_PREFERENCES.language).toBe("en");
    expect(DEFAULT_APP_PREFERENCES.formattingLocale).toBe("en-US");

    // Clause 13/14: version-0 and corrupt state recover to the deterministic defaults.
    const recovered = migratePreferencesFileData({ version: 0, app: {} });
    expect(recovered.recovered).toBe(true);
    expect(recovered.snapshot.app).toEqual(DEFAULT_APP_PREFERENCES);
    expect(migratePreferencesFileData(null).recovered).toBe(true);
  });

  it.skipIf(!existsSync(CROSS_PROCESS_CHILD))(
    "the cross-process reference run still matches the golden baseline",
    () => {
      const stdout = execFileSync(process.execPath, [CROSS_PROCESS_CHILD], {
        encoding: "utf8",
        timeout: 60_000,
        env: { ...process.env, NODE_OPTIONS: "" },
      });
      const lines = stdout.trim().split("\n");
      const actual = JSON.parse(lines[lines.length - 1]!) as Record<string, string | boolean>;
      const golden = JSON.parse(readFileSync(GOLDEN, "utf8")) as Record<string, string | boolean>;
      for (const key of Object.keys(golden)) {
        expect(actual[key]).toBe(golden[key]);
      }
    },
  );
});
