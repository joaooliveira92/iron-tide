import { Cause, Exit, ManagedRuntime } from "effect";
import type { Effect } from "effect";
import { cliLayer, type CliEnv } from "../src/runtime/cliLayer.js";

/**
 * Drives a compiler-CLI program against the production CLI layer on one
 * `ManagedRuntime`, disposing it afterwards — the same shape `main.ts` uses.
 * The program's `ExitCategory` is returned on success; a defect (a thrown
 * engine or `safePath` error) is rethrown so a test can assert the throw.
 */
export async function runCli<A>(program: Effect.Effect<A, never, CliEnv>): Promise<A> {
  const runtime = ManagedRuntime.make(cliLayer);
  try {
    const exit = await runtime.runPromiseExit(program);
    if (Exit.isFailure(exit)) {
      throw Cause.squash(exit.cause);
    }
    return exit.value;
  } finally {
    await runtime.dispose();
  }
}
