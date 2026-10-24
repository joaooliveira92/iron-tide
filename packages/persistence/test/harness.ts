import { Effect, Exit, Result } from "effect";
import { expect } from "vite-plus/test";

export function runExit<A, E>(effect: Effect.Effect<A, E>): Exit.Exit<A, E> {
  return Effect.runSyncExit(effect);
}

export function unwrapSuccess<A, E extends { readonly _tag: string }>(exit: Exit.Exit<A, E>): A {
  if (Exit.isFailure(exit)) {
    const found = Exit.findError(exit);
    const detail = Result.isSuccess(found) ? found.success._tag : "a defect";
    throw new Error(`Expected success but got ${detail}`);
  }
  return exit.value;
}

export function expectFailureTag<A, E extends { readonly _tag: string }>(
  exit: Exit.Exit<A, E>,
  tag: E["_tag"],
): E {
  if (Exit.isSuccess(exit)) {
    throw new Error(`Expected ${tag} but the effect succeeded`);
  }
  const found = Exit.findError(exit);
  if (Result.isFailure(found)) {
    throw new Error(`Expected typed ${tag} but the effect died`);
  }
  expect(found.success._tag).toBe(tag);
  return found.success;
}
