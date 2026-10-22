import { Context, Effect, Layer } from "effect";

export interface CliConsoleShape {
  readonly out: (text: string) => Effect.Effect<void>;
  readonly err: (text: string) => Effect.Effect<void>;
}

export class CliConsole extends Context.Service<CliConsole, CliConsoleShape>()(
  "bluewave/compiler-cli/CliConsole",
) {}

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
