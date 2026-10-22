import { Context, Effect, Layer } from "effect";
import {
  captureCrash,
  createCrashLimiter,
  type CrashContext,
  type CrashDetails,
  type CrashEmitter,
  type CrashKind,
  type CrashLimiter,
  type CrashLimiterOptions,
  type CrashSource,
  detailsFromError,
  installProcessCrashHandlers,
  parseRendererCrashInput,
  type RendererCrashInput,
} from "../crashSupport.js";
import { CommandFailed } from "./commandError.js";
import { AppPaths, Clock } from "./platform.js";

export class CrashReporter extends Context.Service<
  CrashReporter,
  {
    readonly capture: (
      source: CrashSource,
      kind: CrashKind,
      details: CrashDetails,
    ) => Effect.Effect<string | null, CommandFailed>;
    readonly parseRendererInput: (value: unknown) => Effect.Effect<RendererCrashInput | null>;
    readonly installProcessHandlers: (
      onFatal: (error: unknown, bundlePath: string | null) => void,
      emitter?: CrashEmitter,
    ) => Effect.Effect<() => void, CommandFailed>;
    readonly createLimiter: (options: CrashLimiterOptions) => Effect.Effect<CrashLimiter>;
    readonly detailsFromError: (error: unknown) => Effect.Effect<CrashDetails>;
  }
>()("bluewave/desktop/CrashReporter") {}

function crashContext(
  paths: AppPaths["Service"],
  clock: Clock["Service"],
  limiter: CrashLimiter,
): Effect.Effect<CrashContext, CommandFailed> {
  return Effect.gen(function* () {
    const bundleDir = yield* paths.supportDir();
    const appVersion = yield* paths.appVersion();
    const now = yield* clock.now();
    return {
      bundleDir,
      appVersion,
      platform: paths.platform,
      arch: paths.arch,
      processId: paths.processId,
      homeDir: paths.homeDir,
      now: () => now,
      log: (message: string) => console.error(message),
      limiter,
      maxBundles: 20,
    };
  });
}

export function crashReporterLayer(): Layer.Layer<CrashReporter, never, AppPaths | Clock> {
  return Layer.effect(
    CrashReporter,
    Effect.gen(function* () {
      const paths = yield* AppPaths;
      const clock = yield* Clock;
      const limiter = createCrashLimiter({
        maxPerWindow: 5,
        windowMs: 60_000,
        dedupWindowMs: 60_000,
      });
      return {
        capture: (source, kind, details) =>
          Effect.gen(function* () {
            return captureCrash(source, kind, details, yield* crashContext(paths, clock, limiter));
          }),
        parseRendererInput: (value) => Effect.sync(() => parseRendererCrashInput(value)),
        installProcessHandlers: (onFatal, emitter) =>
          Effect.gen(function* () {
            return installProcessCrashHandlers(
              yield* crashContext(paths, clock, limiter),
              onFatal,
              emitter,
            );
          }),
        createLimiter: (options) => Effect.sync(() => createCrashLimiter(options)),
        detailsFromError: (error) => Effect.sync(() => detailsFromError(error)),
      };
    }),
  );
}
