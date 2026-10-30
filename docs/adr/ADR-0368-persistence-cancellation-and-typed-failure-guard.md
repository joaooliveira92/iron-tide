# ADR-0368: Persistence has no abort signal; its typed failures are guarded by the ratchet

Applies to: compiler-cli, content-compiler, desktop, persistence

Rule: Persistence operations take no `AbortSignal` and report no cancellation error, because every body is synchronous and cannot be interrupted mid-flight, and interruption is the Effect runtime's concern at the call site; failures in `packages/persistence/src` leave the typed channel only at sites frozen in the shrink-only typed-failure baseline.

## Status

Accepted (2026-10-30).

Amends: ADR-0343

## Context

ADR-0343 rule 2 under save retention says persistence failures are typed: `PersistenceIoError` for filesystem failure and `PersistenceCancelledError` when the abort signal fired. Every production caller (`apps/desktop/src/main/runtime/projectStore.ts`, `apps/compiler-cli/src/commands.ts`) omits the signal. The save and load bodies are synchronous and single-threaded, so an abort cannot be observed mid-flight; only a signal that is already aborted at the call was ever exercised, by tests. The signal was also a parallel foreign cancellation channel next to Effect's own, and it forced `save(state, saveDir, signal, extras)` and `saveEffect(state, saveDir, extras, signal)` to disagree on argument order.

The typed-failure ratchet (`scripts/assert-tagged-errors.mjs`) guarded `packages/campaign/src` only. `persistence` returns failures as `Result` and `Effect`, and its `try/catch` sites collapsed failures into `null` and `false` before the 2026-10 audit (#371). Nothing stopped a new collapse.

## Rules

1. **No abort signal.** `SaveStore.save`, `saveEffect`, `load`, `loadById`, `loadResult` and `loadByIdResult` take no `AbortSignal`. `save` takes `(state, saveDir, extras)`. `PersistenceCancelledError`, `CANCELLED_CODE` and the cancellation arm of `LoadFailure` are removed. A caller that needs cancellation interrupts the fiber that runs the `*Effect` method.

2. **Failures are typed.** `PersistenceIoError` for filesystem failure, `PersistenceCorruptSaveError`, `PersistenceMissingSaveError` and `PersistenceCompatibilityMismatchError` for load. `saveEffect` fails with `PersistenceIoError` only. This replaces the second clause of ADR-0343 save-retention rule 2.

3. **The ratchet covers persistence.** `TYPED_FAILURE_ROOTS` lists `packages/persistence/src` beside `packages/campaign/src`. Each reachability scope guards the roots it contains. Existing `try/catch` and `throw` sites are frozen in `scripts/typed-failure-leaks.baseline.json` (shrink-only). The synchronous best-effort getters stay frozen there on purpose (ADR-0343); a new collapse fails the gate.

4. **Migration and compiler reads report failure.** `migrateSaveDirectory` returns `{ status: "failed", reason }` instead of rethrowing. `Compiler.compile` reports a content file it cannot read as a `FILE-READ` diagnostic carrying the cause, and keeps "absent from the compiler input" for a missing file.

## Consequences

- `save`, `saveEffect`, `load` and `loadById` lose a parameter. Tests that asserted pre-aborted cancellation are deleted; no production caller changes.
- Reintroducing cancellation needs work chunked into `Effect.sync` steps scoped with `Effect.onInterrupt`, and a new ADR.
- The persistence baseline (14 sites) only shrinks.
