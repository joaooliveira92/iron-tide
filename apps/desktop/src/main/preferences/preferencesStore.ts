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
export interface PreferencesRecovery {
  readonly snapshot: PreferencesSnapshot;
  /** True when the stored data could not be used and defaults were substituted. */
  readonly recovered: boolean;
  readonly reason: string | null;
}

/**
 * Pure, total migration/decoding of the app-scope file (D5, ticket 06). A valid
 * current-version object decodes; a missing file yields defaults silently; a
 * corrupt, undecodable or unknown-version object recovers to the central defaults
 * with a reason so the store can log it. Deterministic and idempotent: the same
 * raw input always yields the same snapshot.
 */
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
