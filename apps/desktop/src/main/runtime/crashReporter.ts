// The crash-support boundary as a service (INC-4; ADR-0159). Wraps
// `crashSupport.ts`'s local-only support-bundle helpers so the crash path
// resolves `CrashReporter` + `AppPaths` + `Clock` from the Layer instead of
// reading `app.getPath`/`homedir`/`new Date` at module load. The raw
// `node:fs` bundle write stays inside `captureCrash`; process-level handler
// *registration* is exposed here but performed by the edge (`index.ts`).
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
    /** Builds and writes one support bundle; `null` when suppressed or failed. */
    readonly capture: (
      source: CrashSource,
      kind: CrashKind,
      details: CrashDetails,
    ) => Effect.Effect<string | null, CommandFailed>;
    /** Decodes a renderer crash payload; `null` when it is not the expected shape. */
    readonly parseRendererInput: (value: unknown) => Effect.Effect<RendererCrashInput | null>;
    /**
     * Installs the main-process crash handlers, returning an uninstall
     * function. The registration is the edge's call; the handler body resolves
     * the context through this service.
     */
    readonly installProcessHandlers: (
      onFatal: (error: unknown, bundlePath: string | null) => void,
      emitter?: CrashEmitter,
    ) => Effect.Effect<() => void, CommandFailed>;
    /** A fresh write limiter with the supplied windows. */
    readonly createLimiter: (options: CrashLimiterOptions) => Effect.Effect<CrashLimiter>;
    /** A best-effort `{message, stack}` from anything a crash handler can receive. */
    readonly detailsFromError: (error: unknown) => Effect.Effect<CrashDetails>;
  }
>()("bluewave/desktop/CrashReporter") {}

/** Builds the `CrashContext` from the platform services, lazily per call. */
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
      // One limiter for the process lifetime: a render loop can emit thousands
      // of identical errors, so writes are capped and deduped (ADR-0133).
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
