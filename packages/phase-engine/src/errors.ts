import { Data } from "effect";

/**
 * In-process tagged error for the `@bluewave/phase-engine` foundation
 * (snapshot clone, financial ledger, command lifecycle).
 *
 * `Data.TaggedError` (not `Schema.TaggedError`) is deliberate: these failures
 * are raised and handled in-process and never cross a wire/serialization
 * boundary, so the snapshot/command/ledger formats are unchanged (`MIG-WIRE-3`)
 * and the package stays runtime-free (`MIG-RUNTIME-1`) — only `Data` is
 * imported, no `Effect`/`Layer` runtime. `phase-engine` is a synchronous
 * deterministic pipeline with no IO, so wrapping it in a runtime would be the
 * "blind wrapping of pure functions" the runtime-usage policy forbids.
 *
 * The `message` text is carried verbatim from the previous plain `Error`, and
 * `code` is preserved exactly where the previous throw assigned one; callers
 * that match on either are unaffected. The `_tag` discriminator lets a later
 * wave recover with `Effect.catchTag` without this package importing the
 * runtime. Phase execution order and outputs are unchanged (`MIG-DET-1`).
 */
export class PhaseEngineError extends Data.TaggedError("PhaseEngineError")<{
  readonly message: string;
  readonly code?: string;
}> {}
