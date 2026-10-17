# Decision Request: The committed baseline is gate-red (N-1 test rot + an incomplete S-1 bump)

## Status

Closed (2026-10-17) — owner confirmed closure. The red-baseline condition was
already resolved and the recorded acceptance conditions are met; see the owner
decision below.

## Trigger

Bringing the orchestrator online at HEAD `0117adc` (`refactor/comment-prune-sweep-a`)
found the repository **not in a startable state**: the mandated definition-of-done
gate is red at HEAD on files committed by prior "completed" tickets, and the
uncommitted, in-progress S-1 ticket 01 work in the tree does not restore it.
Meeting DoD for any sprint now requires repairing failures that span prior tickets
and release gates — a distinct baseline-restoration effort beyond the current
ticket. Per `.opencode/command/sprint.md`, out-of-scope expansion forces a stop.

## Evidence

- **HEAD is lint-red.** `pnpm lint` at HEAD `0117adc` (clean rebuild) → `0 warnings
  and 82 errors`, all in `packages/content-compiler/test/{dataHygiene,
  initialDiplomacy, initialResearchActivity, initialResearchCoherence,
  constructionDesignConsistency, perNationViability,initialFleetLegality}.test.ts`
  — type-aware property access on `ContentBundle`'s `unknown[]` collections.
- **HEAD is test-red on 6 files** (`vp run -r --no-cache test`):
  - `apps/desktop/test/production-promotion.test.ts` — stale unlinked-ship set
    (expects `gbr_malta_temp`, `esp_numancia`, `fra_courbet`, `fra_devastation`,
    `ott_mesudiye`; actual `aut_custoza`, `gbr_temeraire`).
  - `apps/desktop/src/main/commands/battleSandboxCommands.test.ts` — expects the
    renamed `gbr_malta_temp`.
  - `apps/desktop/src/main/commands/commitMonth.test.ts` — snapshot
    `bodyHash`/`bodyLength` stale (`be70e057…`/87671; actual `df0ff474…`/87666).
  - `apps/desktop/src/main/commands/compileCampaign.test.ts` and
    `listNewGameOptions.test.ts` — treat Spain as zero-content and expect it
    excluded from `playerSlotId`.
  - `packages/ship-design/test/productionNationCoverage.test.ts` — anti-vacuity
    floor asserts ≥10 playable nations; the pack has 9 (DR-005).
- **Provenance.** These files were left stale by the N-1 content commits (tickets
  01/03/05/06/08/09, e.g. `f966c06` filled fleets and renamed ships). N-1's audit
  report and the sprint plan record those tickets as complete, and
  `.ai/reports/comment-pruning.md:43` records `vp lint . -> 0 errors` before N-1:
  the gate regressed without being re-run.
- **In-progress S-1 ticket 01.** The working tree holds an apparently-complete,
  uncommitted S-1 readiness/crew change (`campaign/src/readiness.ts`, schema/state/
  compile wiring, `snapshotClone` field list, migration `2.0.0→3.0.0`,
  `golden/hashes.json` re-pin, new tests). It is green on its own focused seam
  (`@bluewave/campaign` test, `check:determinism`, `check:golden`) but it bumps
  `CURRENT_COMPATIBILITY_VERSION` to `3.0.0`, which breaks the unmodified
  `apps/desktop/src/main/drawingBoardDraft.test.ts` (hardcodes `"2.0.0"`/`"3.0.0"`)
  — a ripple the in-progress work did not update (verified: this file passes at
  HEAD, fails with the working tree).
- **Traceability is stale/missing.** `SPRINT-PLAN.md`'s frontier still names
  decision request 0005 as the root blocker though HEAD created `golden/hashes.json`
  (`Golden-Repin: baseline-created`); `docs/PROGRESS.md` and `docs/OPEN-ISSUES.md`
  named by the boot prompt do not exist.
- **No remote.** `git remote -v` is empty; only `master` and the feature branch
  exist, so the checks-green-PR delivery path (ADR-0165) is unavailable.

## Why agent judgment is insufficient

Repairing the pre-existing failures requires choosing the authoritative reading
for release-gate tests: whether Spain's newly authored content (per **DR-005**,
Spain is one of the nine playable nations) makes it a valid player slot and removes
it from the zero-content exclusion list, and whether the N-1 content changes were
intended at all. It also reverses the "completed" status of prior tickets. That is
a governance call, not routine local repair; guessing risks masking a content
defect behind a test edit.

## Options

### Option A: Baseline-restoration pass, then land S-1

- Behavior: fix the stale tests to current content/behaviour (confirming DR-005
  makes Spain player-supported), complete the S-1 compatibility-bump ripple, keep
  the lint typing repair, run the full gate, then land S-1 ticket 01.
- Advantages: restores a green baseline for every later sprint; honest traceability.
- Risks: touches release-gate tests and reverses prior "completed" status.
- Compatibility impact: none beyond S-1's declared `3.0.0` bump.
- Migration impact: none.
- Scope and effort: M.

### Option B: Repair only the S-1 ripple; document the rest

- Behavior: fix `drawingBoardDraft.test.ts` and commit S-1 ticket 01 with a
  distinct, recorded statement that `pnpm check` is red on five pre-existing,
  unrelated files.
- Advantages: preserves the S-1 work; narrow.
- Risks: violates DoD (`pnpm check` green); leaves later sprints blocked.
- Compatibility impact: none beyond S-1.
- Migration impact: none.
- Scope and effort: S.

### Option C: Reopen N-1 for re-verification

- Behavior: treat the stale tests as evidence N-1 was not properly validated;
  reopen N-1 tickets 01/05/06/08/09 and re-run their acceptance before any repair.
- Advantages: least likely to mask a content defect.
- Risks: large; delays the frontier.
- Compatibility impact: none.
- Migration impact: none.
- Scope and effort: L.

## Recommendation

Option A, contingent on confirming the N-1 content changes are intended (Spain
content-backed per DR-005). Do not weaken a gate; update expectations only after
intent is confirmed.

## Work safely completed while blocked

- Diagnosed and classified every gate failure (pre-existing vs S-1-caused) with
  reproducible commands; the in-progress S-1 work was preserved intact, not
  overwritten, and no commit was made.
- Restored `pnpm lint` to green by typing the N-1 audit tests' compiled-bundle
  access (`packages/content-compiler/test/helpers/campaignRecords.ts` plus the
  seven tests): 82 → 0 errors.
- Corrected the stale anti-vacuity floor in
  `packages/ship-design/test/productionNationCoverage.test.ts` (10 → 9, matching DR-005). **Reversed by ADR-0214**: the nine-nation roster was a regression; the anti-vacuity floor is restored to ≥10.

## Decision-ready packet (reconciled 2026-10-17)

**Status reframe.** The red-baseline condition this request was raised against
(`HEAD 0117adc`) is **no longer present**. On the current `dev` (`51632a0`, which
carries the N-1 content, ADR-0214's ten-playable roster, and S-1 ticket 01), the
independent orchestrator observed: `pnpm preflight` **exit 0**; `pnpm lint` **0 errors**;
`pnpm typecheck` **exit 0**; and the previously-red files all pass
(`apps/desktop/src/main/commands/{commitMonth,listNewGameOptions,compileCampaign,battleSandboxCommands}.test.ts`,
`apps/desktop/src/main/drawingBoardDraft.test.ts`, `apps/desktop/test/production-promotion.test.ts`
→ 59 passed; `packages/ship-design/test/productionNationCoverage.test.ts` → 4 passed;
the full `@bluewave/desktop` suite → 2218 passed, 1 skipped). The stale tests were
brought current and the S-1 compatibility-bump ripple completed.

**Exact question requiring owner authority.** Confirm Option A (a baseline-restoration
pass, then S-1) was the intended remediation and is now satisfied — i.e. that the
brought-forward N-1 content changes were intended, that Spain is player-supported, and
that the anti-vacuity floor stays `≥10` (ADR-0214) rather than being lowered to nine.

**Affected scope.** The N-1 content commits; the content-compiler bundle-typing tests
and `packages/content-compiler/test/helpers/campaignRecords.ts`; the desktop command
and promotion tests; `packages/ship-design/test/productionNationCoverage.test.ts`;
S-1 ticket 01; the traceability of N-1's "complete" tickets.

**Known constraints and invariants.** Do not weaken a gate to pass (fix the cause);
ADR-0214 supersedes ADR-0205 (ten playable); DR-005's nine-plus-USA roster; the
`≥10` production coverage assertion is the intentional release invariant.

**Options.** A — baseline-restoration pass, then land S-1 (now the de-facto state).
B — repair only the S-1 ripple and document the rest as pre-existing red (no longer
applicable: the baseline is green). C — reopen N-1 for re-verification (unnecessary:
the tests pass at current content).

**Consequences.** _Gameplay:_ none beyond the already-landed N-1/ADR-0214 content.
_Determinism:_ the golden baseline is green and matches (`check:golden` 11/11).
_Saves/wire:_ unchanged. _Balance/content/tests/migration:_ already reflected in the
landed commits.

**Recommendation.** Close 0008 as resolved by Option A; the evidence above is the
closure record. No further owner action is required to unblock work.

**Minimum owner response to unblock.** "Confirmed — close 0008" (or reopen with a
contradicting concern).

**Must not be guessed.** Whether the N-1 content changes were intended (owner
confirmation sought); whether to lower the anti-vacuity floor (no — it stays `≥10`).

## Owner decision (2026-10-17)

**Chosen:** Confirmed — close 0008.

**Authorized production values or rules.** The brought-forward N-1 content
changes are intended. Spain remains player-supported, and the production
anti-vacuity floor must remain at least 10 playable nations in accordance with
ADR-0214.

**Additional constraints.** Closure is administrative. Do not combine it with
unrelated implementation or reinterpret it as authorization for decisions 0003,
0005, 0006, or 0007.
