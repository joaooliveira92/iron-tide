# Desktop view

`apps/desktop` is the Electron app. It has three layers with a hard boundary
between them, and the renderer is **presentational and non-authoritative** — no
engine, no filesystem, no parsing.

## Layers

| Layer | Owns |
| --- | --- |
| `src/main` | Authoritative composition: loads the compiled content artifact, runs the engine, executes commands, owns the window and lifecycle. The full Effect runtime is allowed here. |
| `src/preload` | A narrow `window.bluewave` API exposed with `contextBridge` under context isolation. Imports no `effect`. |
| `src/renderer` | React UI only. Imports no `effect`, parses no YAML, reads no files. |

## Bridge channels

Every channel is declared once in `src/shared/ipc-contract.ts` (ADR-0328).
Preload and main derive channel names and payload types from that table, so they
never spell a channel string themselves; main still decodes each payload
strictly before a handler sees it.

## Reading state

The renderer never holds authoritative state. It reads through read-only query
conventions over IPC:

- `useBridgeQuery` runs a named main-process query (`campaign:execute`) and folds
  the result to a view model.
- `useCampaignProjection` reads the campaign projection.
- Shell contexts (`campaign-shell-state`, `useCampaignShell`) carry navigation and
  presentation state, and the status strip is a pure view model.

Commands are intents: the renderer asks main to execute one; main validates and
resolves it. The renderer never mutates authoritative state.

## Content over IPC

Content reaches the renderer as **already-decoded, data-only DTOs** shipped from
main (`contentArtifact`, `shipBuildingContent`, `referenceDesigns`,
`presentationContent`). The renderer receives no file path, no raw document, and
no parser — so it bundles no `yaml` or validation runtime. A test seam injects a
fixture DTO directly.

## Screens and shell

Screens live in `src/renderer/screens/` (campaign-list, overview, fleet, treasury,
research, construction, shipbuilding, diplomacy, strategic-map, tactical-map, …) and are
registered through a screen registry/routes. The strategic map reads the compiled
campaign only (`inspectMap.strategic`), orders fleets through the shared
`useMovementOrders` payload builder, and carries no fixture world. Debug-only screens (simulation,
tactical-sandbox, debugging) are gated behind the build-time debug flag and absent
from release builds.

## Presentation-only state

Per-campaign UI state (inspector layout, font choice, density, background) lives
in a renderer-owned `ui-state.json` sidecar and shell contexts. It is
presentation only: never read by the month executor, never authoritative.

## Lifecycle and failure

The shell decides lifecycle and failure recovery purely: an unrecoverable failure
is surfaced rather than leaving a blank window, a crashed renderer stays
recoverable, shutdown is bounded by a renderer flush handshake, a second launch
focuses the running window, and a local support bundle captures crash/error
observability with bounded, privacy-respecting writes.

## Seeing the app

Agents inspect and drive the running app with `pnpm snap`; see
[desktop snap](desktop-snap.md).
