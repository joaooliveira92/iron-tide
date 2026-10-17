# R-24: Sidecar & save/recover mechanics

**Type:** research
**Status:** resolved
**Blocked by:** None

## Question

What is the exact mechanics for a `pending-turn.json` sidecar to coexist with the
authoritative save and survive app close mid-turn?

Specifically:

- `apps/desktop/src/main/monthlyReports.ts` tolerant-read/atomic-write and
  `runtime/sidecarStores.ts` — the pattern to copy; sidecar location relative to
  `saveDir`, `pointer.json`, and save ids.
- `packages/persistence` `SaveStore` load/verify/signature flow and the `recover`
  command (`recoverCampaign`) — how a load with a pending turn should behave and
  how `abandonPendingTurn` avoids touching authoritative state.
- How `startingRevision` maps to `snapshot.turnNumber` and what happens when
  `commitMonth` is not the path that finalizes a resumed turn.
- The `ui-state.json` read/dismiss pattern for pin/read state (D-15) and confirm
  dismissal is non-authoritative.

## Answer

**Resolved — copy the `monthly-reports.json` sidecar pattern; both new files live
at the `saveDir` root as siblings of `pointer.json` and every save-id directory,
never inside a `SaveStore` save id** (`monthlyReports.ts:10-31`; `uiState.ts:23-26`).

- **Shape:** `pending-turn.json` (at most one; keyed by location = one campaign) and
  `turn-summaries.json` (append/limit ledger). Both non-authoritative, never read by
  `MonthExecutor`, never in the envelope/hash.
- **Mechanics:** tolerant read (missing/corrupt → empty), `.tmp` + `renameSync`
  atomic write (`atomicWrite.ts:12-21`), `AbortError` by `name`. Strict decode
  (`onExcessProperty:"error"`) is available via `Schema.decodeUnknownResult(schema,
  { onExcessProperty: "error" })` (`commandProgram.ts:38-51`).
- **Wiring:** add `PendingTurnStore`/`TurnSummariesStore` as `Context.Service`s in
  `sidecarStores.ts` and merge into `sidecarStoresLayer()` (`:66-122`); add to
  `CommandEnv` + `desktopMainLayer.ts:33-35,54`. `DraftStore.remove`
  (`sidecarStores.ts:116-120`) is the template for `abandonPendingTurn`.
- **Load validation:** read immediately after `sessions.register`
  (`continuityCommands.ts:115-128`) and validate against the **already-verified**
  save: `startingRevision === snapshot.turnNumber`, `campaignId`, compatibility/
  ruleset/content hashes, recomputed `turnId`. On mismatch → reconstruct from the
  pre-turn snapshot (revision chain via `store.ts:694-705`) or report
  **resumption-unavailable**; **never** mutate authoritative state.
- **Abandon:** removes/replaces only the sidecar (+ optional dismissed-fingerprint in
  `ui-state.json`) — **zero** `SaveStore`/pointer ops, so `campaign.json`,
  `campaign.sig.json`, `metadata.json`, `pointer.json`, envelope/hash are
  byte-identical. `recoverCampaignProgram` is corruption recovery only and must not
  be conflated (`continuityCommands.ts:437-526`).
- **Revision mapping:** `startingRevision = snapshot.turnNumber`; the closing save is
  at `startingRevision + 1` (`commitMonth.ts:62-72,169-176`;
  `continuityCommands.ts:370-382`).
- **Read/dismiss:** reuse `ui-state.json` (`uiState.ts:41-49,119-144`); confirmed
  non-authoritative.
