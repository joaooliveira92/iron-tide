import { Data } from "effect";

/**
 * Combat-local in-process tagged error for fail-closed invariant and integrity
 * failures — the tagged counterpart of `BluewaveError` for the residual plain
 * throws that carry no cross-wire contract.
 *
 * `Data.TaggedError` (not `Schema.TaggedError`) is deliberate: these failures
 * are raised and handled in-process and never cross a wire/serialization
 * boundary, so the package stays runtime-free (`MIG-RUNTIME-1`) and every
 * record/hash surface is unchanged (`MIG-DET-1`). Combat is not
 * renderer-reachable, so this cannot pull `effect` into the renderer bundle.
 *
 * The `message` text is carried verbatim from the previous plain `Error` so
 * callers that match on it are unaffected; `code` carries the stable reason code
 * where one exists.
 */
export class CombatInvariantError extends Data.TaggedError("CombatInvariantError")<{
  readonly message: string;
  readonly code?: string;
  readonly context?: Readonly<Record<string, unknown>>;
}> {}
