import { Data } from "effect";

export class CombatInvariantError extends Data.TaggedError("CombatInvariantError")<{
  readonly message: string;
  readonly code?: string;
  readonly context?: Readonly<Record<string, unknown>>;
}> {}
