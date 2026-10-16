// The dedicated `preferences.read` / `preferences.write` IPC bridge (D6). Mirrors
// `createCampaignCommandDispatcher`: decodes the write payload with the strict
// schema (`{ onExcessProperty: "error" }`), runs the store on the injected
// runtime, and projects the `Exit` to the frozen `BridgeResult` envelope. The
// underlying Effect programs are exported so they are unit-testable directly.
import { Cause, Effect, Exit, ManagedRuntime, Result, Schema, SchemaIssue } from "effect";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import type { AppPreferences, PreferencesSnapshot } from "../../shared/preferences-contract.js";
import type { CommandEnv } from "../runtime/desktopMainLayer.js";
import {
  InvalidPreferencesPayload,
  isPreferencesError,
  projectPreferencesError,
  type PreferencesError,
} from "./preferencesErrors.js";
import { PreferencesStore } from "./preferencesStore.js";
import { WriteAppPreferencesRequestSchema } from "./preferencesSchema.js";

const formatIssues = SchemaIssue.makeFormatterStandardSchemaV1();

function issueMessages(error: Schema.SchemaError): readonly string[] {
  return formatIssues(error.issue).issues.map((issue) => issue.message);
}

/** Reads the app-scope snapshot through the store. */
export const readPreferencesProgram = (): Effect.Effect<
  PreferencesSnapshot,
  PreferencesError,
  CommandEnv
> =>
  Effect.gen(function* () {
    const store = yield* PreferencesStore;
    return yield* store.read();
  });

/** Writes an already-decoded full app-scope object; returns the new snapshot. */
export const writePreferencesProgram = (
  app: AppPreferences,
): Effect.Effect<PreferencesSnapshot, PreferencesError, CommandEnv> =>
  Effect.gen(function* () {
    const store = yield* PreferencesStore;
    return yield* store.write(app);
  });

/** Total mapping from a completed preferences `Exit` to its wire envelope. */
function projectPreferencesExit<A>(exit: Exit.Exit<A, PreferencesError>): BridgeResult<A> {
  if (Exit.isSuccess(exit)) {
    return { outcome: "success", value: exit.value, diagnostics: [] };
  }
  const error = Cause.squash(exit.cause);
  if (isPreferencesError(error)) return projectPreferencesError<A>(error);
  return { outcome: "error", reason: "INTERNAL", diagnostics: [String(error)] };
}

export interface PreferencesBridge {
  read(): Promise<BridgeResult<PreferencesSnapshot>>;
  write(payload: unknown): Promise<BridgeResult<PreferencesSnapshot>>;
}

/**
 * Builds the preferences bridge over the process runtime. Decodes the write
 * payload strictly at the boundary; a malformed or excess-key payload returns
 * the `INVALID_PREFERENCES_PAYLOAD` envelope with a typed `_tag`, never a throw.
 */
export function createPreferencesBridge(
  getRuntime: () => ManagedRuntime.ManagedRuntime<CommandEnv, never>,
): PreferencesBridge {
  return {
    async read() {
      const exit = await getRuntime().runPromiseExit(readPreferencesProgram());
      return projectPreferencesExit(exit);
    },
    async write(payload: unknown) {
      const decoded = Schema.decodeUnknownResult(WriteAppPreferencesRequestSchema, {
        onExcessProperty: "error",
      })(payload);
      if (Result.isFailure(decoded)) {
        return projectPreferencesError(
          new InvalidPreferencesPayload({ issues: issueMessages(decoded.failure) }),
        );
      }
      const exit = await getRuntime().runPromiseExit(writePreferencesProgram(decoded.success.app));
      return projectPreferencesExit(exit);
    },
  };
}
