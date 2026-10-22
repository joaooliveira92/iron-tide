import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Context, Effect, Layer, Result, Schema } from "effect";
import {
  DEFAULT_APP_PREFERENCES,
  PREFERENCES_SCHEMA_VERSION,
  type AppPreferences,
  type PreferencesSnapshot,
} from "../../shared/preferences-contract.js";
import { atomicWrite } from "../runtime/atomicWrite.js";
import { AppPaths } from "../runtime/platform.js";
import { PreferencesWriteFailed, type PreferencesError } from "./preferencesErrors.js";
import { PreferencesFileSchema } from "./preferencesSchema.js";

export const PREFERENCES_FILENAME = "preferences.json";

export function defaultPreferencesSnapshot(): PreferencesSnapshot {
  return { version: PREFERENCES_SCHEMA_VERSION, app: DEFAULT_APP_PREFERENCES };
}

export interface PreferencesRecovery {
  readonly snapshot: PreferencesSnapshot;
  readonly recovered: boolean;
  readonly reason: string | null;
}

export function migratePreferencesFileData(raw: unknown): PreferencesRecovery {
  const decoded = Schema.decodeUnknownResult(PreferencesFileSchema, {
    onExcessProperty: "error",
  })(raw);
  if (Result.isFailure(decoded)) {
    const version =
      typeof raw === "object" && raw !== null && "version" in raw
        ? (raw as { readonly version?: unknown }).version
        : undefined;
    return {
      snapshot: defaultPreferencesSnapshot(),
      recovered: true,
      reason:
        typeof version === "number" && version !== PREFERENCES_SCHEMA_VERSION
          ? `unknown-version:${version}`
          : "undecodable",
    };
  }
  return {
    snapshot: { version: decoded.success.version, app: decoded.success.app },
    recovered: false,
    reason: null,
  };
}

function loadPreferencesFile(userDataDir: string): PreferencesRecovery {
  const path = join(userDataDir, PREFERENCES_FILENAME);
  if (!existsSync(path)) {
    return { snapshot: defaultPreferencesSnapshot(), recovered: false, reason: null };
  }
  try {
    return migratePreferencesFileData(JSON.parse(readFileSync(path, "utf8")));
  } catch {
    return { snapshot: defaultPreferencesSnapshot(), recovered: true, reason: "unparseable" };
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export interface PreferencesStoreShape {
  readonly read: () => Effect.Effect<PreferencesSnapshot, PreferencesError>;
  readonly write: (app: AppPreferences) => Effect.Effect<PreferencesSnapshot, PreferencesError>;
}

export class PreferencesStore extends Context.Service<PreferencesStore, PreferencesStoreShape>()(
  "bluewave/desktop/PreferencesStore",
) {}

export function preferencesStoreLayer(): Layer.Layer<PreferencesStore, never, AppPaths> {
  return Layer.effect(
    PreferencesStore,
    Effect.map(AppPaths, (paths) => ({
      read: () =>
        Effect.gen(function* () {
          const userDataDir = yield* paths
            .userDataDir()
            .pipe(Effect.catchTag("CommandFailed", () => Effect.succeed(null)));
          if (userDataDir === null) return defaultPreferencesSnapshot();
          const recovery = loadPreferencesFile(userDataDir);
          if (recovery.recovered) {
            yield* Effect.logWarning(
              `preferences recovered to defaults (${recovery.reason ?? "unknown"})`,
            );
          }
          return recovery.snapshot;
        }),
      write: (app) =>
        Effect.gen(function* () {
          const userDataDir = yield* paths.userDataDir().pipe(
            Effect.catchTag("CommandFailed", (error) =>
              Effect.fail(
                new PreferencesWriteFailed({
                  reason: "PREFERENCES_PATH_UNAVAILABLE",
                  diagnostics: error.diagnostics,
                }),
              ),
            ),
          );
          return yield* Effect.try({
            try: () => {
              const snapshot: PreferencesSnapshot = {
                version: PREFERENCES_SCHEMA_VERSION,
                app,
              };
              atomicWrite(
                join(userDataDir, PREFERENCES_FILENAME),
                JSON.stringify(snapshot, null, 2),
              );
              return snapshot;
            },
            catch: (error) =>
              new PreferencesWriteFailed({
                reason: "PREFERENCES_WRITE_FAILED",
                diagnostics: [messageOf(error)],
              }),
          });
        }),
    })),
  );
}
