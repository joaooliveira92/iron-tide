import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { Context, Data, Effect, Layer } from "effect";

export class CliFileSystemError extends Data.TaggedError("CliFileSystemError")<{
  readonly operation: string;
  readonly path: string;
  readonly message: string;
}> {}

export interface CliFileSystemShape {
  readonly readFile: (path: string) => Effect.Effect<string, CliFileSystemError>;
  readonly writeFile: (path: string, data: string) => Effect.Effect<void>;
  readonly exists: (path: string) => Effect.Effect<boolean>;
  readonly makeDirectory: (path: string) => Effect.Effect<void>;
  readonly remove: (path: string) => Effect.Effect<void>;
}

export class CliFileSystem extends Context.Service<CliFileSystem, CliFileSystemShape>()(
  "bluewave/compiler-cli/CliFileSystem",
) {}

const errorMessage = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

const syncOrDie = <A>(thunk: () => A): Effect.Effect<A> =>
  Effect.suspend(() => {
    try {
      return Effect.succeed(thunk());
    } catch (err) {
      return Effect.die(err);
    }
  });

export const cliFileSystemLayer: Layer.Layer<CliFileSystem> = Layer.succeed(CliFileSystem, {
  readFile: (path) =>
    Effect.try({
      try: () => readFileSync(path, "utf8"),
      catch: (cause) =>
        new CliFileSystemError({ operation: "readFile", path, message: errorMessage(cause) }),
    }),
  writeFile: (path, data) =>
    syncOrDie(() => {
      writeFileSync(path, data, "utf8");
    }),
  exists: (path) => Effect.sync(() => existsSync(path)),
  makeDirectory: (path) =>
    syncOrDie(() => {
      mkdirSync(path, { recursive: true });
    }),
  remove: (path) =>
    syncOrDie(() => {
      rmSync(path, { force: true });
    }),
});
