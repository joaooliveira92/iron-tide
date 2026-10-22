import { Cause, Effect, Exit, ManagedRuntime, Result, Schema, SchemaIssue } from "effect";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import type {
  AppPreferences,
  CampaignPreferences,
  CampaignPreferencesSnapshot,
  PreferencesSnapshot,
} from "../../shared/preferences-contract.js";
import type { CommandEnv } from "../runtime/desktopMainLayer.js";
import { CampaignSessionStore } from "../runtime/campaignSessionStore.js";
import {
  InvalidPreferencesPayload,
  isPreferencesError,
  PreferencesReadFailed,
  projectPreferencesError,
  type PreferencesError,
} from "./preferencesErrors.js";
import { PreferencesStore } from "./preferencesStore.js";
import { CampaignPreferencesStore } from "./campaignPreferencesStore.js";
import {
  WriteAppPreferencesRequestSchema,
  WriteCampaignPreferencesRequestSchema,
} from "./preferencesSchema.js";

const formatIssues = SchemaIssue.makeFormatterStandardSchemaV1();

function issueMessages(error: Schema.SchemaError): readonly string[] {
  return formatIssues(error.issue).issues.map((issue) => issue.message);
}

export const readPreferencesProgram = (): Effect.Effect<
  PreferencesSnapshot,
  PreferencesError,
  CommandEnv
> =>
  Effect.gen(function* () {
    const store = yield* PreferencesStore;
    return yield* store.read();
  });

export const writePreferencesProgram = (
  app: AppPreferences,
): Effect.Effect<PreferencesSnapshot, PreferencesError, CommandEnv> =>
  Effect.gen(function* () {
    const store = yield* PreferencesStore;
    return yield* store.write(app);
  });

function saveDirOf(sessionId: string): Effect.Effect<string, PreferencesError, CommandEnv> {
  return Effect.gen(function* () {
    const sessions = yield* CampaignSessionStore;
    const record = yield* sessions.get(sessionId).pipe(
      Effect.catchTag("SessionNotFound", () =>
        Effect.fail(
          new PreferencesReadFailed({
            reason: "SESSION_NOT_FOUND",
            diagnostics: [sessionId],
          }),
        ),
      ),
    );
    return record.saveDir;
  });
}

export const readCampaignPreferencesProgram = (
  sessionId: string,
): Effect.Effect<CampaignPreferencesSnapshot, PreferencesError, CommandEnv> =>
  Effect.gen(function* () {
    const saveDir = yield* saveDirOf(sessionId);
    const store = yield* CampaignPreferencesStore;
    return yield* store.read(saveDir);
  });

export const writeCampaignPreferencesProgram = (
  sessionId: string,
  campaign: CampaignPreferences,
): Effect.Effect<CampaignPreferencesSnapshot, PreferencesError, CommandEnv> =>
  Effect.gen(function* () {
    const saveDir = yield* saveDirOf(sessionId);
    const store = yield* CampaignPreferencesStore;
    return yield* store.write(saveDir, campaign);
  });

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
  readCampaign(sessionId: string): Promise<BridgeResult<CampaignPreferencesSnapshot>>;
  writeCampaign(
    sessionId: string,
    payload: unknown,
  ): Promise<BridgeResult<CampaignPreferencesSnapshot>>;
}

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
    async readCampaign(sessionId: string) {
      const exit = await getRuntime().runPromiseExit(readCampaignPreferencesProgram(sessionId));
      return projectPreferencesExit(exit);
    },
    async writeCampaign(sessionId: string, payload: unknown) {
      const decoded = Schema.decodeUnknownResult(WriteCampaignPreferencesRequestSchema, {
        onExcessProperty: "error",
      })(payload);
      if (Result.isFailure(decoded)) {
        return projectPreferencesError(
          new InvalidPreferencesPayload({ issues: issueMessages(decoded.failure) }),
        );
      }
      const exit = await getRuntime().runPromiseExit(
        writeCampaignPreferencesProgram(sessionId, decoded.success.campaign),
      );
      return projectPreferencesExit(exit);
    },
  };
}
