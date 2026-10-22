import { Cause, Exit, ManagedRuntime } from "effect";
import type { Effect } from "effect";
import { cliLayer, type CliEnv } from "../src/runtime/cliLayer.js";

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
