// The compiler CLI's filesystem port (T9; ADR-0159). Every raw `node:fs`
// operation the CLI performs is wrapped as an `Effect` method here — this is the
// only module in `apps/compiler-cli/src` that imports `node:fs`, so the `run*`
// programs never touch the filesystem directly. The operations mirror exactly
// the synchronous calls `commands.ts`/`main.ts` used before the migration
// (`readFileSync`/`writeFileSync`/`existsSync`/`mkdirSync`/`rmSync`); reads stay
// synchronous, so no behaviour changes.
//
// Error model: `readFile` is a *typed* failure (`CliFileSystemError`) because
// the callers recover from it and map it to a documented `ExitCategory`. The
// mutating operations have no recovery branch in the original code — they let a
// throw escape to `main` — so a thrown exception there stays a defect (the
// Effect equivalent of the previously-uncaught exception), exactly as before.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { Context, Data, Effect, Layer } from "effect";

/** A recoverable `readFile` failure the CLI maps to an `ExitCategory`. */
export class CliFileSystemError extends Data.TaggedError("CliFileSystemError")<{
  readonly operation: string;
  readonly path: string;
  readonly message: string;
}> {}

export interface CliFileSystemShape {
  /** Reads a file as UTF-8 text. */
  readonly readFile: (path: string) => Effect.Effect<string, CliFileSystemError>;
  /** Writes UTF-8 text, creating or truncating the file. */
  readonly writeFile: (path: string, data: string) => Effect.Effect<void>;
  /** Whether a path exists. */
  readonly exists: (path: string) => Effect.Effect<boolean>;
  /** Creates a directory (and its parents). */
  readonly makeDirectory: (path: string) => Effect.Effect<void>;
  /** Removes a file, ignoring a missing path (`rmSync(path, { force: true })`). */
  readonly remove: (path: string) => Effect.Effect<void>;
}

export class CliFileSystem extends Context.Service<CliFileSystem, CliFileSystemShape>()(
  "bluewave/compiler-cli/CliFileSystem",
) {}

const errorMessage = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

/** Runs a synchronous side effect, turning a thrown exception into a defect. */
const syncOrDie = <A>(thunk: () => A): Effect.Effect<A> =>
  Effect.suspend(() => {
    try {
      return Effect.succeed(thunk());
    } catch (err) {
      return Effect.die(err);
    }
  });

/** The production `node:fs`-backed CLI filesystem. Raw `node:fs` lives only here. */
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
