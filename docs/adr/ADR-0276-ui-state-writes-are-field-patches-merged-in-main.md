# ADR-0276: UI-state writes are field patches merged once, in main

Applies to: desktop, persistence

## Status

Superseded by: ADR-0360

Accepted (2026-10-22). Extends ADR-0273; does not supersede it.

## Context

`writeUiState` required `dismissedFingerprints` on every call. The renderer
wrapper `writeUiStatePatch` therefore read the stored state over IPC, copied the
dismissal set, and wrote it back, and main's `writeUiStateProgram` then re-read
the sidecar and merged again with a per-field ternary. Two merge
implementations sat on either side of the seam, and the read-modify-write
spanned two IPC calls, so a stale dismissal set copied by one hook could
overwrite a newer one while three independent hooks (guided inspection,
inspector layout, turn messages) each wrote a different field.

## Decision

1. **The command is a field-level patch.** `writeUiState` carries `sessionId`
   plus any subset of `dismissedFingerprints`, `firstMonthInspection`,
   `inspector`, and `turnMessages`. A field that is absent is left as stored; a
   field that is present replaces that field wholesale. `UiStatePatch` is the
   shared type in `ui-state-contract.ts`.
2. **One merge, in main.** `applyUiStatePatch` in `main/uiState.ts` is the only
   merge. It runs inside the command program between the sidecar load and save,
   which are synchronous, so concurrent patches for different fields cannot lose
   each other. The renderer sends only the fields it owns and never reads before
   writing.
3. **Wire change is a loosening.** `dismissedFingerprints` became optional in
   `WriteUiStatePayloadSchema`, which stays the single validator; the command is
   now decoded with `onExcessProperty: "error"`. Every payload the previous
   contract accepted still decodes to the same value and merges to the same
   state (parity fixtures in `campaignCommandSchemas.test.ts`). `ui-state.json`
   and the read path are unchanged.
4. **Ownership is unchanged.** Main still persists and validates UI state with
   the shared schemas, as ADR-0273 points 3 and 5 require. This ADR does not make
   UI state renderer-owned, so the redesign ADR-0273 point 4 calls for remains
   open.

## Consequences

- A new UI-state field is added to the schema, `UiState`, `UiStatePatch`, and
  `applyUiStatePatch`, and nowhere else.
- Callers that previously carried the dismissal set (the campaign preferences
  restart) drop their read.
- A write that must clear a field needs a representation for "absent on
  purpose"; none exists today, and none is introduced here.
