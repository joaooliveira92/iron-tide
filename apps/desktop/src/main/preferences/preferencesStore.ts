// The app-scope preferences store (D3/D5). One JSON file in the Electron
// user-data directory, written atomically and read tolerantly: a missing,
// unreadable or undecodable file recovers to the central defaults so a bad
// setting can never block startup (formal logged recovery is ticket 06). The
// store is non-authoritative — it never touches a save or a golden hash (D7).
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

/** The preferences file name, a sibling of the save ids in the user-data dir. */
export const PREFERENCES_FILENAME = "preferences.json";

/** The tolerant read fallback (and the initial shape). */
export function defaultPreferencesSnapshot(): PreferencesSnapshot {
  return { version: PREFERENCES_SCHEMA_VERSION, app: DEFAULT_APP_PREFERENCES };
}

/** The decoded snapshot, or the defaults for a missing/corrupt/undecodable file. */
function loadPreferencesFile(userDataDir: string): PreferencesSnapshot {
  const path = join(userDataDir, PREFERENCES_FILENAME);
  if (!existsSync(path)) return defaultPreferencesSnapshot();
  try {
    const decoded = Schema.decodeUnknownResult(PreferencesFileSchema, {
      onExcessProperty: "error",
    })(JSON.parse(readFileSync(path, "utf8")));
    if (Result.isFailure(decoded)) return defaultPreferencesSnapshot();
    return { version: decoded.success.version, app: decoded.success.app };
  } catch {
    return defaultPreferencesSnapshot();
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

/**
 * The store layer. Resolves the `AppPaths` service once when the layer is built
 * (D2); `userDataDir()` is read per operation so a moved profile is observed.
 * Its methods carry no per-call requirement.
 */
export function preferencesStoreLayer(): Layer.Layer<PreferencesStore, never, AppPaths> {
  return Layer.effect(
    PreferencesStore,
    Effect.map(AppPaths, (paths) => ({
      read: () =>
        Effect.gen(function* () {
          const userDataDir = yield* paths
            .userDataDir()
            .pipe(Effect.catchTag("CommandFailed", () => Effect.succeed(null)));
          return userDataDir === null
            ? defaultPreferencesSnapshot()
            : loadPreferencesFile(userDataDir);
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
