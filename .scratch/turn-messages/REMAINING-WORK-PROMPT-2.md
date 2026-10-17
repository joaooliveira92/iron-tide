# Prompt: verify and land the `turn-messages` remaining work (round 2)

You are a coding agent working in the **Bluewave / Iron Tide** monorepo at
`/Users/joao/dev/iron-tide`. A previous agent implemented the remaining
`turn-messages` work (tasks T1–T7 of `REMAINING-WORK-PROMPT.md`) and left it
**uncommitted** in the working tree on branch `turn-messages` in the primary
checkout (HEAD `2d01918`). Your job is to **review, verify, fix if needed, and
land** that work — not to re-implement it from scratch unless the focused tests
or gates actually fail.

Work on the existing branch `turn-messages`. The work is already in the primary
checkout (this is the `turn-messages` worktree); do not create a second worktree
for the same branch. Never commit on `dev`/`main`.

## Read first (authority order)

1. `AGENTS.md` (repo working rules) and `.ai/ENGINEERING-CONTRACT.md`.
2. `RULES.md`, `docs/agents/runtime-free-gate.md`, `docs/agents/golden-repinning.md`.
3. The spec `.scratch/turn-messages/spec.md`, the original brief
   `.scratch/turn-messages/REMAINING-WORK-PROMPT.md`, and the tickets
   `.scratch/turn-messages/issues/01..08-*.md`.
4. The uncommitted diff itself: `git status`, `git diff`, `git diff --stat`.

Core invariants you must not break: **determinism** (no ambient time/random/
locale; canonical ordering; integer/fixed-point only in authoritative packages),
the **frozen `@bluewave/events` wire format**, the **runtime-free guard**
(`packages/messages/src` imports only the runtime-free Effect subset), the
**golden hashes** (`golden/hashes.json`; `pnpm check:golden`), and the
**content lock** (`content/production/1880/content-lock.json`).

## Current state (what the previous agent already did, uncommitted)

`git diff --stat` shows ~32 tracked files changed plus these untracked files:
`apps/desktop/src/main/runtime/decisionSource.ts` and
`docs/adr/ADR-0221-turn-identity-stable-across-resume.md`.

Implemented tasks (each has focused tests added alongside):

- **T1 — Localize all player-facing chrome (ADR-0209).** Added `ui.*` keys to
  `content/production/1880/ui/en-US.yaml`; `TurnSummaryPanel.tsx`,
  `DecisionDialog.tsx`, `BattleRequestDialog.tsx`, `PendingTurnRecoveryPrompt.tsx`
  now render only catalogue text via `resolveMessage`. `README`-adjacent chrome
  maps (`CATEGORY_LABELS`, `group.label`) were removed. The content lock was
  re-pinned (`pnpm content:build` + `pnpm content:verify`), and
  `apps/desktop/src/main/uiCatalogue.test.ts` `REQUIRED_KEYS` was extended.
- **T2 — Validate a pending turn on load.** `ReadPendingTurnResult` gained
  `valid: boolean`; `readPendingTurnProgram` validates the stored pending record
  against the verified save (recomputed `turnId` + content hashes from the
  `ContentArtifact` service); `useCampaignShell` maps `valid: false` to
  `unavailable` so `PendingTurnRecoveryPrompt` shows the incompatible message
  with no Resume button.
- **T3 — Disable the advance control while blocked.** `HeaderAdvanceMonth` /
  `SiteHeader` gained `disabled`/`advanceDisabled`; `App.tsx` passes
  `advanceDisabled={shell.state.interruption !== null}`; `useCampaignShell`'s
  `advanceMonth` early-returns while a blocking request (`interruption.request`)
  is outstanding (the recovery prompt's Resume, which has no request, still works).
- **T4 — Decision result message.** `useCampaignShell.answerDecision` surfaces a
  presentation-only result line derived from the chosen option's `effects`
  (`ui.decision.result*` catalogue keys).
- **T5 — Entity availability + read-only historical record.** `TurnSummaryPanel`
  gained an `isEntityAvailable` signal; an unavailable entity renders an in-place
  read-only historical record (`entity-historical`) instead of navigating.
  `OverviewScreen` derives the signal from `PlayerProjection`.
- **T6 — Desktop E2E decision + battle.** Added a test-only `DecisionSource`
  service (`runtime/decisionSource.ts`, wired into `desktopMainLayer`/`CommandEnv`)
  and a battle-bearing session fixture; `turnMessagesE2e.test.ts` proves
  suspend → persist → reload → resume **exactly once** and **re-execution parity**.
- **T7 — Validate `interruptionId` at the boundary.** `pending-turn.json` gained
  an `outstanding` identity; `answerDecision`/`submitBattleResult` reject a
  mismatched `interruptionId` (`INTERRUPTION_ID_MISMATCH`) before recording,
  leaving the sidecar unchanged.

Latent defects fixed because T6 could not otherwise pass:

- **Stable turn identity across resume** (recorded as **ADR-0221**): the desktop
  turn transaction and `validatePending` now compute `turnId` from the turn's
  pre-execution inputs (`computeOrderedInputsHash([])`), not the accumulating
  recorded inputs. Previously every resume changed each interruption's id and
  the turn stuck at `invalid-input`.
- **Clear the pending-turn sidecar on completion** in `resolveTurn`'s
  `finishTransaction`, so a finished turn cannot prompt a resume.
- **Pre-existing lint debt** in `packages/messages` (unused `scalar`; two
  useless array spreads; unary minus on a `SafeInt`; a test fixture passing a
  raw number as `SafeInt`) and one object spread in
  `packages/phase-engine/test/interruption.test.ts` was fixed so `pnpm lint`
  passes. These are behaviour-preserving and outside packages on the golden-repin
  guard list.

## Remaining work

### R1 — Review the diff against the spec and standards

Read the full diff. For each of T1–T7 confirm the acceptance criteria in
`.scratch/turn-messages/REMAINING-WORK-PROMPT.md` are met by the tests in the
diff. Flag anything the previous agent missed; fix it test-first (red → green).

Known gaps to consider (do **not** fabricate data):

- **T5 availability is partial.** `PlayerProjection` does not enumerate ship or
  ship-class ids, so a sunk/scrapped ship cannot be detected as unavailable from
  the projection — only `technology`, `region`, and `nation` links are
  adjudicated; every other kind defaults to available (unchanged navigation). If
  you can source a real availability signal without new authoritative state, do
  so; otherwise record the limitation (a short comment and/or an ADR amendment)
  rather than inventing availability.
- **T2 has no renderer integration test for the `valid → unavailable` wiring**
  (the component test covers `unavailable`; the main test covers `valid`). Add a
  focused test at `useCampaignShell`/`App` level if cheap.

### R2 — Run the full verification floor (all must be green)

```sh
pnpm preflight
pnpm test:scripts
pnpm format            # pnpm format:fix if it reports drift
pnpm lint
pnpm lint:effect       # 0 errors; warnings are allowed
pnpm typecheck
pnpm --filter @bluewave/messages test
pnpm --filter @bluewave/phase-engine test
pnpm --filter @bluewave/desktop test
pnpm --filter @bluewave/content-compiler test
pnpm --filter @bluewave/content-codemod test
pnpm check:golden
pnpm check:determinism
pnpm check:equivalence
pnpm check:golden-repin
pnpm check:balance-reports
pnpm test:heavy
pnpm content:verify
```

**Do NOT run `pnpm test:e2e` (Playwright)** — the human asked to skip it.

Known flakes (re-run **in isolation**, do not weaken them):

- `apps/desktop/src/renderer/a11y.audit.test.tsx > Drawing Board — every tab on
  the battleship` can time out at 120 s under full parallel load; it passes alone
  (≈21 s).
- `@bluewave/content-compiler` `confidence` and `@bluewave/content-codemod`
  `determinism` are the two flakes named in the original brief.

**Golden rule:** `golden/hashes.json` must stay byte-identical — authored
`content/**` is exempt from the reference run, so the T1 content change cannot
move it (`pnpm check:golden` proves this). Re-pin a golden only with an
understood authoritative cause (see `docs/agents/golden-repinning.md`);
`scripts/regenerate-golden-hashes.cjs` is the only sanctioned way.

### R3 — Commit narrowly

- One task per commit, Conventional Commit subjects.
- Do **not** commit unrelated scaffolding that is already in the tree:
  `.ai/WORKTREES.md` (u-3/u-4 worktree rows), `.scratch/u-3-formatting-boundary/`,
  and (unless the repo convention includes it) `.ai/specs/turn-messages.md` and
  `.scratch/turn-messages/`. Keep the turn-messages commits to the code, tests,
  content, ADR, and `scripts/adr-index.cjs` change.
- Never commit secrets, `.env`, stores, caches, or machine-specific settings.
- End with a clean tree (of the turn-messages work).

### R4 — Report

For each task: files changed, the exact command(s) run and their result, and any
acceptance checkbox you could not meet with the reason. End with a two-axis
(**Standards** / **Spec**) review of the diff.

## Explicitly OUT of scope — do not do these

- Authored crisis/decision content, eligibility, AI weights, narrative keys → **S-4**.
- Battle-offer gameplay policy (accept/decline rules, VP/prestige costs, force
  composition, support forces, mission selection) → **T-1**.
- New domain events (`@bluewave/events` is frozen; `BattleInitiated`/
  `BattleResolved` stay unemitted).
- Tactical combat-engine changes, phase-boundary memoization, a translation
  runtime beyond keyed catalogue + en-US fallback.
- Playwright E2E (`pnpm test:e2e`).

## Commands that were already green before you start (re-confirm, don't assume)

The previous agent observed these green: `pnpm preflight`, `pnpm test:scripts`,
`pnpm format`, `pnpm lint`, `pnpm lint:effect`, `pnpm typecheck`,
`pnpm check:golden`, `pnpm check:determinism`, `pnpm check:equivalence`,
`pnpm check:golden-repin` (skipped: no commit range), `pnpm check:balance-reports`,
`pnpm test:heavy`, `pnpm content:verify`, and the messages / phase-engine /
desktop / content-compiler / content-codemod suites (the desktop suite was
2125/2127, the one failure being the isolated-only a11y timeout above). The full
`pnpm check` end-to-end was **not** run.
