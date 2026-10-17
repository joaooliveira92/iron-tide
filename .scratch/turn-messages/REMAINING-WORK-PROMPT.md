# Prompt: finish the `turn-messages` effort (remaining work)

You are a coding agent working in the **Bluewave / Iron Tide** monorepo at
`/Users/joao/dev/iron-tide`. A feature called **turn-messages** has been
implemented across eight tickets; the backend and the main renderer surfaces
exist and are green. Your job is to close the remaining, in-scope gaps listed
below. Work on the existing branch `turn-messages` in a dedicated worktree
(`pnpm worktrees new <slug>`), never on `dev`/`main`.

## Read first (authority order)

1. `AGENTS.md` (repo working rules) and `.ai/ENGINEERING-CONTRACT.md`.
2. `RULES.md`, `docs/agents/runtime-free-gate.md`, `docs/agents/golden-repinning.md`.
3. The spec: `.scratch/turn-messages/spec.md` and the tickets in
   `.scratch/turn-messages/issues/01..08-*.md`.
4. The code you will touch (below). Do not assume anything exists — read it.

Core invariants you must not break: **determinism** (no ambient time/random/
locale; canonical ordering; integer/fixed-point only in authoritative packages),
the **frozen `@bluewave/events` wire format**, the **runtime-free guard**
(`packages/messages/src` imports only the runtime-free Effect subset), and the
**golden hashes** (`golden/hashes.json`; `pnpm check:golden`).

## What already exists (orientation)

- `packages/messages/src/` — `TurnMessage`/`EntityReference`/`EffectReference`
  schemas, pure projection (`project.ts`), policy (`policy.ts`), aggregation
  (`aggregate.ts`), and the interruption contracts + id hashing (`interruption.ts`).
- `packages/phase-engine/src/interruption.ts` — the additive seam:
  `InterruptionChannel` (`turnId`, `recordedInputs`, `pendingDecisions`),
  `consumeDecision`, `consumeBattleResult`, `applyRecordedBattleResult`,
  `runInterruptionCheckpoint`, `trailingInputSuspension`. `MonthResult` gained
  `outcome`/`suspended`.
- `apps/desktop/src/main/commands/turnTransaction.ts` — `runTurnTransaction`
  (shared execute→persist→project core). `resolveTurn.ts` — `resolveTurn`,
  `answerDecision`, `submitBattleResult`, `abandonPendingTurn`, `readPendingTurn`.
  `commitMonth.ts` delegates to the transaction.
- `apps/desktop/src/main/pendingTurn.ts` — `pending-turn.json` sidecar.
  `turnSummaries.ts` — `turn-summaries.json` sidecar + `readTurnSummaries`.
- `apps/desktop/src/renderer/screens/overview/TurnSummaryPanel.tsx`,
  `useTurnSummaries.ts`, `useTurnMessageState.ts`, `turn-summary-format.ts`.
- `apps/desktop/src/renderer/shell/useCampaignShell.ts`,
  `campaign-shell-state.ts`, `CampaignShellContext.tsx`, `App.tsx`, and
  `shell/interruptions/{DecisionDialog,BattleRequestDialog,PendingTurnRecoveryPrompt}.tsx`.
- `content/production/1880/ui/en-US.yaml` — the compiled en-US catalogue;
  renderer resolver `apps/desktop/src/renderer/content/uiCatalogue.ts`.

## Tasks (do them in vertical slices, test-first)

Work one task at a time: write a failing test at the public seam, make it pass,
run the focused test file, then the package suite. Use the `tdd` skill.

### T1 — Localize all player-facing chrome (ADR-0209)

**Problem:** the DTO-supplied message keys resolve, but the surrounding UI text is
hardcoded (`title="Turn summary"`, `placeholder="Search"`, `"All categories"`,
`"No resolved turns yet."`, `"Details"/"Pin"/"Read"`, `"Accept"/"Decline"/"Delegate"`,
`"Choose"`, `"Abandon this turn"`, `"Outstanding turn cannot be resumed"`, etc.).

**Do:** add stable keys to `content/production/1880/ui/en-US.yaml` for every
player-visible string in `TurnSummaryPanel.tsx`, `DecisionDialog.tsx`,
`BattleRequestDialog.tsx`, `PendingTurnRecoveryPrompt.tsx`; resolve each with
`resolveMessage(key)` from `../content/uiCatalogue.js`. No raw keys may render.
Because the catalogue is compiled content, re-pin the content lock: run
`pnpm content:build` then `pnpm content:verify`, and update the `bodyHash` in
`content/production/1880/content-lock.json` to the value `content:verify` reports
(deliberate content change). Also extend the required-key list in
`apps/desktop/src/main/uiCatalogue.test.ts`.

**Acceptance:** every visible label comes from the catalogue; a test asserts each
new key exists and resolves; `pnpm content:verify` passes.

### T2 — Validate a pending turn on load (report before resume)

**Problem:** `readPendingTurn` returns the record without checking it against the
save, so the recovery prompt always offers "Resume" and incompatibility is only
discovered after resuming.

**Do:** give `readPendingTurn` the same validation `resolveTurn` uses
(`validatePending` in `commands/resolveTurn.ts`): recompute `turnId` from the
record's own `committedOrderHash`/`orderedInputsHash`; compare `campaignId`,
`startingRevision`, `rulesetVersion`, `compatibilityVersion`, and every
`contentHashes` entry against the already-verified save (ship-building and
armament hashes come from the `ContentArtifact` service). Return
`{ pending, valid: boolean }` (or `{ pending, reason }`) and have the renderer's
`PendingTurnRecoveryPrompt` show the *incompatible* explanation when invalid
(no Resume button), without mutating the save.

**Acceptance:** a stale/corrupt pending record is reported invalid on load;
`abandonPendingTurn` still clears only the sidecar and leaves the authoritative
state byte-identical.

### T3 — Disable the advance control while a blocking interruption is active

**Problem:** the dialogs overlay the campaign, but the header's advance/Turn
control is not actually disabled.

**Do:** when `shell.state.interruption` is non-null, disable the primary advance
action and prevent `PreTurnReviewDialog`/`advanceMonth` from firing. Find where
the primary action is set (`shell/primary-action.ts`, `site-header-state.ts`,
`SiteHeader.tsx`, `components/PreTurnReviewDialog.tsx`, `useCampaignShell.ts`).

**Acceptance:** with a suspended turn open, the advance control is disabled and
`advanceMonth` cannot run until the decision/battle is answered or the turn is
abandoned.

### T4 — Decision result message

**Problem:** after answering a decision the shell only says "Month advanced to …";
ticket 07 wants a result message describing what changed.

**Do:** when a decision is answered, surface a message derived from the chosen
option's declared effects (e.g. the `DecisionEffect` treasury delta) — either an
after-action message or a `TurnMessage` appended by the transaction. The chosen
option is known at the boundary; keep it presentation-only (never authoritative).

**Acceptance:** answering shows a result message that names the change; a test
asserts it.

### T5 — Entity links: availability + read-only historical record

**Problem:** entity links navigate blindly; a sunk/scrapped/unknown entity should
open a read-only record instead of failing.

**Do:** give the summary panel an availability signal (from the campaign
projection the screen already loads) and, when an entity is unavailable, render a
read-only historical detail (the message's stored `subjectRefs`/`effectRefs`
previous→new values) instead of navigating. No new authoritative state.

**Acceptance:** an unavailable entity opens a read-only record; available ones
still navigate; a test covers both.

### T6 — End-to-end decision and battle (test harness, in scope)

**Problem:** `apps/desktop/src/main/turnMessagesE2e.test.ts` advances turns but
contains no decision or battle, so suspend→persist→reload→resume is unproven
through the *desktop* transaction (it is proven at the phase-engine seam only).

**Do:** introduce a test-only seam to raise a decision and a battle through
`resolveTurn`:
- Add an injectable `DecisionSource` (Effect service) that `resolveTurnProgram`
  reads to populate `pendingDecisions`, defaulting to empty so production is
  unchanged. A test layer can supply one deterministic test decision (with
  `DecisionOption.effects`) to trigger a real suspension.
- For a battle, register a session whose snapshot carries a pending battle (model
  it on `packages/phase-engine/test/battle-fixtures.ts` `makeBattleSnapshot`; a
  battle with no `manifestHash` exercises the seam without combat content).
Then assert, end to end: `resolveTurn` suspends → `pending-turn.json` is written
→ a fresh session (simulating reload) resumes via `answerDecision` /
`submitBattleResult` → the battle result is applied **exactly once** (no
double-count) → the month completes and the final authoritative hash equals the
same run executed with all inputs supplied at once (re-execution parity).

**Acceptance:** the E2E includes one decision and one battle, covers reload
resume exactly-once, and re-execution parity; the summary sidecar and save agree.

### T7 — Validate answer/submit `interruptionId` at the boundary

**Problem:** `answerDecision`/`submitBattleResult` record the payload's
`interruptionId` without matching it to the outstanding request, so a mismatch is
persisted and the turn is then permanently `invalid-input`.

**Do:** store the outstanding interruption request (or the minimum to recompute
its `interruptionId`: phase, ordinal, subjectKey) in `pending-turn.json`; reject an
answer/submission whose `interruptionId` does not match with a typed error before
recording it.

**Acceptance:** a mismatched `interruptionId` is rejected at the command boundary
and leaves the pending sidecar unchanged; a test covers it.

## Explicitly OUT of scope — do not do these

- Authored crisis/decision content, eligibility, AI weights, narrative keys →
  **S-4**. Do not author decisions; only build the test harness in T6.
- Battle-offer gameplay policy (accept/decline rules, VP/prestige costs, force
  composition, support forces, mission selection, briefing) → **T-1**. The dialog
  and the exactly-once `BattleResult` port are enough; do not invent combat
  outcomes. If accept/decline/delegate need to differ, add only a presentation
  `choice` discriminator + after-action message, not resolution rules.
- New domain events. `@bluewave/events` is frozen; `BattleInitiated`/
  `BattleResolved` stay unemitted. (This is also why there is no ship-completion
  or war/peace event to highlight — do not add one.)
- Tactical combat-engine changes, phase-boundary memoization, a translation
  runtime beyond keyed catalogue + en-US fallback.

## Verification (definition of done)

On the exact commit: `pnpm preflight`, `pnpm test:scripts`, and `pnpm check` must
be green, tree clean, Conventional Commit subjects. At minimum run
`pnpm --filter @bluewave/messages test`,
`pnpm --filter @bluewave/phase-engine test`,
`pnpm --filter @bluewave/desktop test`, `pnpm check:golden`, and
`pnpm content:verify`. Two heavy tests (`content-compiler` `confidence`,
`content-codemod` `determinism`) are known to time out under parallel load but
pass in isolation — re-run them alone to confirm, do not weaken them.

Never weaken a gate or re-pin a golden without an understood authoritative cause
(see `docs/agents/golden-repinning.md`). Record any architecture-constraining
decision as an ADR (`pnpm adr:index`). Commit narrowly, one task per commit.

## Report back

For each task: the files changed, the exact test command and result, and any
acceptance checkbox you could not meet with the reason. End with a two-axis
(Standards / Spec) review of your diff.
