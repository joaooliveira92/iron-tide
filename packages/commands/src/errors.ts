import type { Diagnostic } from "@bluewave/diagnostics";
import { Data } from "effect";

/**
 * In-process tagged error for fail-closed command lifecycle, registry,
 * settlement, canonicalization and invariant failures.
 *
 * `Data.TaggedError` (not `Schema.TaggedError`) is deliberate: these failures
 * are raised and handled in-process and never cross a wire/serialization
 * boundary, so the command/event contract and reason-code vocabulary are
 * unchanged (`MIG-WIRE-3`) and the package stays runtime-free (`MIG-RUNTIME-1`)
 * — only `Data` is imported. The `_tag` discriminator lets a later wave recover
 * with `Effect.catchTag` without this package importing the runtime.
 *
 * The `message` text is carried verbatim from the previous plain
 * `Error` and `code` is preserved exactly where the previous throw assigned
 * one; `diagnostics` carries the collector output where the previous throw
 * attached it.
 */
export class CommandError extends Data.TaggedError("CommandError")<{
  readonly message: string;
  readonly code?: string;
  readonly diagnostics?: readonly Diagnostic[];
}> {}
