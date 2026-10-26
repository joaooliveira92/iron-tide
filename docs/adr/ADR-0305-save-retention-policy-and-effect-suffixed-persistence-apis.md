# ADR-0305: Saves are retained by an opt-in count with a protected head; Effect-returning persistence methods carry an `Effect` suffix

## Status

Accepted (2026-10-26). Covers the persistence changes delivered by PRs [#312](https://github.com/joaooliveira92/iron-tide/pull/312) to
[#316](https://github.com/joaooliveira92/iron-tide/pull/316). Builds on [ADR-0268](ADR-0268-code-carries-no-comments.md) only for the rule that rationale lives here.

## Decision

1. **Retention is opt-in.** `SaveStoreOptions.retainSaves` is unset by default, so `SaveStore` never deletes a save unless a caller
   asks. A set value must be a safe integer of at least 2, otherwise the constructor throws `PersistenceInvalidOptionError`.
2. **The head is protected.** After a successful save, `prune` keeps the active save and the previous save unconditionally, then fills
   the remaining budget with the newest others in `list` order. Directories whose name is not a valid save id are never deleted. The
   floor of 2 exists so the active/previous pair that `revert` needs always fits.
3. **Desktop sets the count.** The desktop app passes `PROVISIONAL_RETAINED_SAVES = 50` (`saveRetention.ts`). The number is a
   PROVISIONAL product choice (ADR-0252) and is tuned there, not in the package.
4. **Time and identity enter through a port.** `PersistenceClock` (`nowMillis`, `nowIso`, `uuid`) defaults to `systemClock`, the only
   place the package reads wall-clock time or random UUIDs. Tests inject a fixed clock.
5. **Stale temp files are swept on save.** `sweepStaleTemp` runs before each save and removes abandoned temp save directories and the
   pointer temp file, so a crashed write cannot accumulate.
6. **Effect API naming.** A method that returns an `Effect` and wraps an existing synchronous method takes that method's name plus an
   `Effect` suffix (`saveEffect`, `listEffect`, `isCurrentEffect`, `activeSaveIdEffect`, `previousSaveIdEffect`). The synchronous
   methods stay, so existing callers are unaffected. `load` and `loadMonthInput` already return `Effect` and keep their names.
   Failures are typed: `PersistenceIoError` for filesystem failure and `PersistenceCancelledError` when the abort signal fired.
7. **Boundary use.** `apps/desktop/src/main` and `apps/compiler-cli` call the `*Effect` methods and no longer wrap the synchronous ones
   in `Effect.try` themselves.

## Not delivered (tracked, not hidden)

- The synchronous methods still swallow some filesystem errors in `catch {}` blocks, and `revert(): boolean` cannot say why it failed.
  Making them typed changes return types, so it is its own PR.
- There is no retention policy for replays or month-input files; only save directories are pruned.

## Compatibility

Additive. No wire format, save layout or authoritative hash changes; golden hashes verify unchanged. A `SaveStore` built without
options behaves as before apart from the temp sweep.
