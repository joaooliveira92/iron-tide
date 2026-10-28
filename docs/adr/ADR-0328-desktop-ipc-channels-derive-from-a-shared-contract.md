# ADR-0328: Desktop IPC channels are declared once in a shared contract

Applies to: desktop

Rule: Every desktop bridge channel is declared once in `shared/ipc-contract.ts`; preload exposure and main-process registration derive names and payload types from it.

## Status

Accepted (2026-10-28).

## Context

Each bridge channel was spelled by hand in three places: the `ipcRenderer` call
in `src/preload`, the `ipcMain` registration in `src/main/index.ts`, and the
allow-list in `test/boundary.test.ts`. Nothing tied them together. A channel
renamed on one side, or a payload reshaped on one side, still typechecked and
failed only at runtime, where the failure shows up as a missed window action, a
silent preference read or a lost quit flush. The boundary test enforced the
allow-list by matching registration strings, so it could not notice that preload
and main disagreed about a payload.

## Decision

1. `src/shared/ipc-contract.ts` is the one registry. `ipcRequests`,
   `ipcMessages` and `ipcEvents` each hold one entry per channel: the channel
   string plus the phantom argument tuple and result type. The module holds no
   `effect` import, so preload and main both read it.
2. Preload spells no channel. `invoke`, `send` and the quit-flush subscription
   take the contract entry and derive the name and payload types from it; the
   exposed `window.bluewave` surface keeps its typed interface, and each method
   must call the entry with that entry's arguments.
3. Main builds its handlers through `createIpcHandlers` in `src/main/ipc.ts`,
   whose records are keyed by contract entry name, so a contract channel without
   a handler fails typecheck. `registerIpcChannels` iterates the contract through
   the guarded registrar, so a channel cannot be registered under a name the
   contract does not declare.
4. Strict decoding stays where it already lives: the campaign dispatcher, the
   preferences bridge and the crash reporter still decode raw payloads before any
   handler sees them. The contract types the renderer-side surface, not the wire.
5. `window:state-changed` and `app:quit-flush` are declared as main-to-renderer
   events. `app:quit-flush-complete` is now a guarded message, so its sender is
   checked like every other channel; the flush stays bounded by its timeout.

## Compatibility

No channel is added or removed and player-visible behaviour is unchanged. The
boundary test asserts the contract inventory, that main registers exactly the
contract's channels, and that no channel literal survives in preload or main.
Adding a channel is one contract row, one handler entry and one preload exposure.
