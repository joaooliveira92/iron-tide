# ADR-0360: Desktop IPC and process boundary architecture

Consolidates: ADR-0273, ADR-0276, ADR-0320, ADR-0328

Applies to: commands, desktop, persistence

Rule: Desktop bridge channels are declared once in `shared/ipc-contract.ts`; the command surface is split by concern; UI-state writes are field patches merged once in main; navigation, permission and CSP are guarded from a single policy.

## Status

Accepted (2026-10-30).
Supersedes: ADR-0273
Supersedes: ADR-0276
Supersedes: ADR-0320
Supersedes: ADR-0328

## Context

The desktop process boundary had four independent gaps. The command contract (`campaign-command-contract.ts`, 405 lines) mixed IPC result DTOs, UI-state shapes, monthly-report DTOs, turn-message DTOs and player-battle DTOs in one module pair, so an edit to one concern touched the whole cross-process seam. The `writeUiState` command required every field on every call, forcing a read-modify-write span of two IPC calls and two merge implementations across the seam. The Electron shell set no navigation, permission or Content Security Policy controls, so the renderer could open windows and navigate to any URL with the preload bridge attached. Each bridge channel was spelled by hand in three places (preload, main registration, boundary test) with no shared contract connecting them.

## Decision

1. **The command contract is split by concern.** One module per concern under `apps/desktop/src/shared/`: `campaign-contract.ts`, `reports-contract.ts`, `turn-message-contract.ts`, `player-battle-contract.ts`, `ui-state-contract.ts`. Schemas follow the same boundaries. No compatibility barrel is introduced. Shared schema helpers live in `schema-primitives.ts`; remaining command payload schemas stay in `campaignCommandSchemas.ts`.

2. **Main must not import from renderer code.** Shared modules must not import from main or renderer. Wire shapes that main validates or persists belong in `shared/`; a validator is never duplicated across the process boundary.

3. **UI-state writes are field-level patches.** `writeUiState` carries `sessionId` plus any subset of `dismissedFingerprints`, `firstMonthInspection`, `inspector` and `turnMessages`. An absent field is left as stored; a present field replaces that field wholesale. `UiStatePatch` is the shared type in `ui-state-contract.ts`.

4. **One merge, in main.** `applyUiStatePatch` in `main/uiState.ts` is the only merge. It runs between the sidecar load and save, which are synchronous. The renderer sends only the fields it owns and never reads before writing. `dismissedFingerprints` became optional in `WriteUiStatePayloadSchema`; the command is decoded with `onExcessProperty: "error"`.

5. **Shell guards are installed once, before any window exists.** `shellGuards.ts` holds the policy as pure predicates plus one installer. Renderer-created windows are always denied. `will-navigate` and `will-redirect` are cancelled unless the target is the packaged renderer entry or, in development only, the exact dev-server origin. `webview` attachment is cancelled.

6. **Permission requests are checked against `ALLOWED_PERMISSIONS`.** The only entry is `clipboard-sanitized-write`. Device permissions are denied.

7. **CSP is a single definition in `csp.ts`** delivered by the header hook. Production declares `script-src 'self'`, `connect-src 'self'`, `font-src 'self'`, and `object-src`, `base-uri`, `form-action` and `frame-ancestors` as `'none'`. No `unsafe-eval`. Exception: `style-src` keeps `'unsafe-inline'` for `GlobeShell.tsx` and `gradient-background-text.tsx`. The renderer is sandboxed; the preload is built as CommonJS (`index.cjs`).

8. **IPC handlers are registered through `guardIpc`**, which rejects invokes with a tagged `UntrustedSender` error and drops one-way messages unless the sender frame is the trusted entry.

9. **Desktop IPC channels are declared once in `shared/ipc-contract.ts`.** `ipcRequests`, `ipcMessages` and `ipcEvents` each hold one entry per channel: the channel string plus the phantom argument tuple and result type. The module holds no `effect` import, so preload and main both read it.

10. **Preload spells no channel.** `invoke`, `send` and the quit-flush subscription take the contract entry and derive the name and payload types from it.

11. **Main builds handlers through `createIpcHandlers`**, keyed by contract entry name, so a contract channel without a handler fails typecheck. `registerIpcChannels` iterates the contract through the guarded registrar, so a channel cannot be registered under a name the contract does not declare.

## Consequences

- A new command, DTO, or schema goes in the module for its concern, or in a new `<concern>-contract.ts` (with `<concern>-schemas.ts` when it has a validator) when none fits.
- Main imports only the wire modules it produces or validates; a change to one concern no longer touches the imports of unrelated consumers.
- A new UI-state field is added to the schema, `UiState`, `UiStatePatch`, and `applyUiStatePatch`, and nowhere else.
- A new permission or external-link feature must add an explicit allow-list entry and a test; the default stays denial.
- A new channel is one contract row, one handler entry and one preload exposure. Renaming a channel on one side is caught by typecheck.
- Wire formats are unchanged: schemas and DTO shapes moved verbatim, so no parity fixture, authoritative outcome, or hash changes.