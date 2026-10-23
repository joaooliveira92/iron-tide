# Error management

Docs: <https://effect.website/docs/v4/error-management/expected-errors> and sibling pages (unexpected-errors, fallback, matching, retrying, timing-out, sandboxing, error-accumulation, error-channel-operations, parallel-and-sequential-errors, yieldable-errors).

## Signals

- `try {`, `throw`, `.catch(`, `instanceof .*Error` in or next to Effect code.
- `Effect.tryPromise`, `Effect.try`, `Effect.promise`.
- `Effect.catch(`, `Effect.ignore`, `Effect.ignoreCause`, `Effect.orDie`, `Effect.die`, `catchDefect`, `catchCause`.
- `Effect<_, unknown` or `Effect<_, Error` signatures; string-literal failures.
- Absence: an effectful package with no `_tag` errors at all.

## Idioms

- Expected failures live in the error channel as tagged errors. Inside `Effect.gen`, `return yield* new MyError(...)` fails and narrows control flow.
- Recover per call site: `catchTag` (array of tags allowed), `catchTags`, `catchIf`, `catchFilter(Filter.tagged(...))`, and `catchReason` / `catchReasons` / `unwrapReason` for an error carrying a tagged `reason`.
- `Effect.catch` handles every typed failure, never defects or interruptions. `catchDefect` and `catchCause` belong at an edge where continuing is safe.
- Observe without recovering: `tapError`, `tapErrorTag`, `tapCause`, `tapDefect`. Translate: `mapError`. Validate a success: `filterOrFail`.
- Move a failure into a value: `Effect.result` (typed only), `Effect.exit` (full `Cause`), `Effect.option` (only when every failure means absence).
- Report every problem at once with `Effect.validate` (all errors, no successes) or `Effect.partition` (both sides). `Effect.all(..., { mode: "result" })` runs everything.
- `Effect.retry` takes `times`, `while`, `until`, or a `Schedule`. `Effect.timeout` fails with `TimeoutError`; `timeoutOption` and `timeoutOrElse` choose another outcome. The placement of `timeout` against `retry` decides whether it bounds each attempt or the whole operation.
- A defect means a bug or a violated invariant. `Effect.die(new Error(...))` states one; `orDie` states "unrecoverable here" after a `mapError`.

## Gaps

| Smell | Kind | Direction |
| --- | --- | --- |
| `try`/`catch` around code that awaits or runs an Effect | bypass | Typed failure plus `catchTag` at the call site |
| `instanceof` to tell errors apart | bypass | `_tag` and `catchTag`; tests discriminate by `_tag` |
| `Effect.catch(() => Effect.succeed(x))` over a wide error union | leak | Narrow with `catchTag` so unhandled errors stay typed |
| `ignore` / `ignoreCause` on work whose failure matters | leak | Handle the specific tag; log the rest with `tapError` |
| `E = unknown`, `Error`, or a bare string | leak | A tagged class per failure the caller can act on |
| `Effect.tryPromise(() => ...)` with no mapped failure | leak | Pass `{ try, catch }` mapping to a tagged error |
| Hand-rolled retry loop with sleep and counter | bypass | `Effect.retry` with a `Schedule` (see scheduling) |
| `Promise.race` or `setTimeout` as a timeout | bypass | `Effect.timeout` / `timeoutOrElse` |
| Validation loop that stops at the first error but the caller needs all | bypass | `Effect.validate` |
| Two error classes sharing one `_tag` | leak | Rename: `catchTag` cannot tell them apart and nothing warns |
| Cause tree walking (`Sequential`, `Parallel`) | drift | `cause.reasons` and the `Cause.has*` guards |

## Project

AGENTS.md "Errors" decides the class: `Data.TaggedError` in-process, `Schema.TaggedError` for wire errors. `Effect.orDie` appears only where recovery is intentional. Do not propose a shared error transformer or guard that probes the failure channel.
