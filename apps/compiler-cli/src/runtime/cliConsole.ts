// The compiler CLI's stdout/stderr port (T9; ADR-0159). The `run*` programs and
// the dispatch emit through this service so no internals write to `process.std*`
// directly; the layer preserves the exact bytes the CLI printed before the
// migration (`process.stdout.write`/`process.stderr.write`, no `console.*`).
import { Context, Effect, Layer } from "effect";

export interface CliConsoleShape {
  /** Writes to stdout, byte-for-byte. */
  readonly out: (text: string) => Effect.Effect<void>;
  /** Writes to stderr, byte-for-byte. */
  readonly err: (text: string) => Effect.Effect<void>;
}

export class CliConsole extends Context.Service<CliConsole, CliConsoleShape>()(
  "bluewave/compiler-cli/CliConsole",
) {}

/** The production process stdout/stderr console. Raw `process.std*` lives only here. */
export const cliConsoleLayer: Layer.Layer<CliConsole> = Layer.succeed(CliConsole, {
  out: (text) =>
    Effect.sync(() => {
      process.stdout.write(text);
    }),
  err: (text) =>
    Effect.sync(() => {
      process.stderr.write(text);
    }),
});
