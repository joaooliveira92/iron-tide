import { Effect } from "effect";
import { CrashReporter } from "./runtime/crashReporter.js";

export const reportRendererCrash = (report: unknown): Effect.Effect<void, never, CrashReporter> =>
  Effect.gen(function* () {
    const crash = yield* CrashReporter;
    const parsed = yield* crash.parseRendererInput(report);
    if (parsed === null) return;
    yield* crash.capture("renderer", parsed.kind, {
      message: parsed.message,
      stack: parsed.stack,
    });
  }).pipe(Effect.catchTag("CommandFailed", () => Effect.void));
