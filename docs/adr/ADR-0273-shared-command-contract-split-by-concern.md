# ADR-0273: The shared command contract is split by concern

Applies to: commands, desktop

## Status

Superseded by: ADR-0360

Accepted (2026-10-22).

## Context

`apps/desktop/src/shared/campaign-command-contract.ts` (405 lines) and
`campaignCommandSchemas.ts` (504 lines) mixed five concerns in one module pair:
IPC result DTOs that main produces and the renderer reads, UI-state shapes with
the inspector width bounds, monthly-report DTOs, turn-message and interruption
DTOs, and player-battle DTOs. Main and renderer both imported the pair, so any
edit to one concern was a change to the whole cross-process seam, and a
consumer could not tell from an import which wire shape it depended on.

## Decision

1. **One module per concern.** Commit `108af49e` introduced, under
   `apps/desktop/src/shared/`: `campaign-contract.ts`, `reports-contract.ts`,
   `turn-message-contract.ts`, `player-battle-contract.ts`, and
   `ui-state-contract.ts`. Schemas follow the same boundaries:
   `ui-state-schemas.ts`, `monthly-reports-schemas.ts`, and
   `player-battle-schemas.ts`. Shared schema helpers live in
   `schema-primitives.ts`; the remaining command payload schemas stay in
   `campaignCommandSchemas.ts`.
2. **No compatibility barrel.** `campaign-command-contract.ts` is deleted and
   every importer names the concern it uses. A barrel would restore the single
   seam this split removes and hide which wire shapes a module depends on.
3. **UI state stays shared.** The UI-state types, `INSPECTOR_MIN_WIDTH_PX` and
   `INSPECTOR_MAX_WIDTH_PX`, and `UiStateSchema`/`WriteUiStatePayloadSchema`
   remain in `shared/`. Main persists the UI-state sidecar and validates it
   with those schemas, and the `writeUiState` command decodes with the same
   schema, so the shape and its bounds are wire constraints, not renderer
   concerns.
4. **Renderer ownership needs a redesign.** Making UI state renderer-owned
   would require main to stop validating and persisting it, or to validate a
   renderer-defined shape. That is a deliberate persistence and validation
   redesign and needs its own ADR; it is not a side effect of a file move.
5. **Dependency rule.** Main must not import from renderer code. Shared
   modules must not import from main or renderer. Wire shapes that main
   validates or persists belong in `shared/`; a validator is never duplicated
   across the process boundary.

## Consequences

- A new command, DTO, or schema goes in the module for its concern, or in a new
  `<concern>-contract.ts` (with `<concern>-schemas.ts` when it has a validator)
  when none fits. It is not added to `campaignCommandSchemas.ts` unless it is a
  plain command payload.
- Main imports only the wire modules it produces or validates; a change to one
  concern no longer touches the imports of unrelated consumers.
- Wire formats are unchanged: schemas and DTO shapes moved verbatim, so no
  parity fixture, authoritative outcome, or hash changes.
- The inspector width bounds are still read by both processes from
  `ui-state-contract.ts` until the persistence design changes.
