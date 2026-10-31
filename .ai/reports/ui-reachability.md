# UI acceptance run: final report

Issue #227 under epic #220, brief `.ai/briefs/ui-acceptance-run.md`. Observed on `feat/ui-acceptance-run`, 2026-10-30. This
supersedes the coverage map in `ui-acceptance-stage-0.md`, which stays as the stage-by-stage history.

## Ledger counts

| Point                    | Source                                                   | reachable | dormant-by-decision | internal | unclassified |
| ------------------------ | -------------------------------------------------------- | --------- | ------------------- | -------- | ------------ |
| First report on #220     | `docs/reachability-report.md` at `096c0483` (2026-10-21) | 30        | 11                  | 11       | 0            |
| Start of the #227 branch | same file at `af25e4fd` (2026-10-30)                     | 35        | 11                  | 14       | 0            |
| Now                      | `node scripts/verify-reachability-ledger.mjs`            | 32        | 14                  | 14       | 0            |

Observed output now: `reachability ledger: ok (32 reachable, 14 dormant-by-decision, 14 internal, 0 unclassified)`. The
brief quotes the 35 / 11 / 14 row. The 35 to 32 change is the three battle rows (accept-peace, fight-or-decline-battle,
combat-fought-battle) reclassified `dormant-by-decision` in `944a5932` (#422). Nothing else moved in this branch.

## Reachable row to e2e step

Every `reachable` row has a `test.step("reachable:<row-id>", ...)` in a default-lane spec, and
`node scripts/verify-ui-acceptance-map.mjs` (`pnpm check:ui-acceptance-map`, a preflight gate) fails when one is missing. The
spec column was regenerated from the step names in `apps/desktop/e2e/*.spec.ts` on 2026-10-30 and matches the descriptions
below. All 32 rows are `drives`: the step performs the player verb through the UI and asserts the visible result, or for the
`read-*` rows asserts real content.

| Row                                 | Spec and what the step does                                                                                                                                             |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `set-research-priority`             | `management` research priority queued, holds after the month                                                                                                            |
| `move-fleet`                        | `mvp-loop` sail; `strategic-map`                                                                                                                                        |
| `assign-station`                    | `mvp-loop` foreign station                                                                                                                                              |
| `set-ship-readiness`                | `mvp-loop` reserve                                                                                                                                                      |
| `fund-special-training`             | `management` special training funded, accrues a month                                                                                                                   |
| `hold-fleet-exercise`               | `management` annual exercise ordered, then marked held                                                                                                                  |
| `organise-divisions`                | `mvp-loop` organization (create and dissolve; flagship and doctrine not exercised)                                                                                      |
| `set-budget-allocation`             | `management` budget allocation queued, research spend changes next month                                                                                                |
| `submit-design`                     | `mvp-loop` design; `ship-types`                                                                                                                                         |
| `revise-project`                    | `construction` revise: a player-designed project is opened from the slipways Revise control, redesigned on the drawing board, queued, and shown on hold after the month |
| `start-rebuild`                     | `ship-rebuild` corvette designed, ordered, built, rebuilt with a bulge; ship leaves the rebuildable list after the month                                                |
| `order-construction`                | `construction` batch, submit, replace                                                                                                                                   |
| `halt-or-resume-construction`       | `construction` halt                                                                                                                                                     |
| `accelerate-construction`           | `construction` accelerate, status accelerated after the month                                                                                                           |
| `authorize-dock-expansion`          | `construction` dock expansion queued, new infrastructure project on the slipways after the month                                                                        |
| `order-foreign-construction`        | `construction` foreign yard                                                                                                                                             |
| `cancel-construction-project`       | `construction` project cancelled, shown as cancelled after the month, steering controls gone (the engine refunds 0, so no refund to assert)                             |
| `declare-war`                       | `diplomacy` war declared on France, shown as Declared with the score bar and an At war rail entry after the month                                                       |
| `form-or-break-alliance`            | `diplomacy` alliance formed with the Netherlands and shown Allied, then broken and shown Neutral again                                                                  |
| `form-or-break-non-aggression-pact` | `diplomacy` pact formed with Russia and shown as NAP, then broken                                                                                                       |
| `declare-blockade`                  | `diplomacy` blockade of the chosen area listed on the war front and the dossier, war score changes after the month                                                      |
| `advance-month`                     | `mvp-loop` Advance Month                                                                                                                                                |
| `assign-or-relieve-officer`         | `management` commander relieved, then assigned                                                                                                                          |
| `ship-readiness`                    | `mvp-loop` reserve                                                                                                                                                      |
| `read-campaign-overview`            | `mvp-loop` New Game: overview heading with the month, nation, treasury and an immediate priority                                                                        |
| `read-world-map`                    | `strategic-map` the Map lists the player fleets, foreign stations and unmodelled limits                                                                                 |
| `read-battle-history`               | `mvp-loop` Battles tab shows the empty state; no production route fills it, see Findings                                                                                |
| `read-priorities`                   | `status-strip` the Immediate priorities group offers a severity, title and destination; `mvp-loop` New Game                                                             |
| `read-opening-briefing`             | `mvp-loop` New Game: all five briefing pages asserted (appointment names the nation, navy inventory, treasury, foreign intelligence, immediate concerns)                |
| `start-new-game`                    | `mvp-loop` New Game                                                                                                                                                     |
| `manage-campaign-files`             | `mvp-loop` Campaign menu; `continuance` load, recent, verify, replay, recover                                                                                           |
| `persist-ui-state`                  | `management` preference and guided inspection survive restarts                                                                                                          |

## Hash evidence

What is compared. `apps/desktop/e2e/hash-agreement.spec.ts` starts a new campaign through the UI from the fixed seed
`ba44581c2f1d8e5c9753ffc80be8e6a0` (United Kingdom, Shipyard Baron), then drives these verbs and advances four months:

- month 1: research priority (Gunnery High), budget allocation (+2 research), special training (Gunnery), a Home Fleet
  movement order, a one-ship construction batch order (5 commands recorded);
- month 2: dissolve a division (1 command); month 3: create a division (1 command); month 4: relieve a division commander
  (1 command).

The spec reads the recorded commands back from each save's `month-input.json` and asserts every month holds at least one and
month 1 holds at least five. It then runs `apps/desktop/src/main/commands/replayPackageChild.ts` (compiled to
`apps/desktop/dist/main/commands/replayPackageChild.js`) twice, each in its own `node` process with no Electron and no UI. The
child runs the production `replayCampaignProgram`, the same program behind the Replay button. For each month it loads the saved
snapshot of the month before and the logged command list, re-executes the month with `MonthExecutor` and the production
content, and compares the resulting snapshot hash with the hash of the snapshot the UI run saved for the month after.

Per revision the child prints `expected` (hash of the UI-saved snapshot) and `actual` (hash from the engine-only
re-execution). The spec asserts all four revisions match, `actual` equals `expected` for each, and the two child processes
print identical output.

Observed. The check was run as separate `playwright test` invocations of the spec (two development runs plus the two logged
runs below) and once more inside the full lane. Every run printed the same pair, so the UI-run hash and the engine-only hash
agree and are identical across separate Electron and node processes.

| Run       | Log                                  | UI final hash (revision 4)                                         | Engine-only final hash (revision 4)                                |
| --------- | ------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| 1         | `/tmp/epic220/stage5b-hash-run1.log` | `cc45549c4a53dc2c32f3d79785102e10a48d85370f6209be96c66340f4022179` | `cc45549c4a53dc2c32f3d79785102e10a48d85370f6209be96c66340f4022179` |
| 2         | `/tmp/epic220/stage5b-hash-run2.log` | `cc45549c4a53dc2c32f3d79785102e10a48d85370f6209be96c66340f4022179` | `cc45549c4a53dc2c32f3d79785102e10a48d85370f6209be96c66340f4022179` |
| full lane | `/tmp/epic220/stage5b-full.log`      | `cc45549c4a53dc2c32f3d79785102e10a48d85370f6209be96c66340f4022179` | `cc45549c4a53dc2c32f3d79785102e10a48d85370f6209be96c66340f4022179` |

No golden hash was changed or pinned. The final hash is deliberately not pinned in the spec, because it moves with any
authoritative engine change and would then need a re-pin; the evidence is agreement within and across runs.

Limits, stated plainly:

- The engine-only run starts each month from the snapshot the UI run saved for the previous month, not from a recompile of the
  seed. It proves that the logged commands plus the saved pre-month state reproduce the UI-saved post-month state in a clean
  process. It does not independently recompile the opening state from the seed in the engine alone; that the opening state
  is seed-determined is covered by the identical hash across the separate runs, all of which started from the same seed.
- Construction orders reach the saved snapshot before the month runs, so a replay from revision 0 alone could not reproduce
  them. The production Replay semantics used here (per-month, from the saved pre-month snapshot) is the reason the construction
  order in the scenario replays correctly.
- The child needs `apps/desktop/dist`, produced by `pnpm --filter @bluewave/desktop typecheck` (`tsc -b`). The spec fails with
  that instruction when the file is missing, and `.github/workflows/desktop-e2e.yml` now runs the step before the lane.

## E2E lane size and time

`heavy pnpm test:e2e` on this branch's final spec set: 55 passed, 0 failed, 0 flaky, 2.0 minutes, 3 workers, exit 0, over 15
default-lane spec files (log `/tmp/epic220/stage5b-full.log`; the machine was loaded by other sessions, load average about 17
on 10 cores). The stage 0 baseline was 39 tests over 11 files in 1.2 minutes; stage 5a was 54 tests in 3.4 minutes. The one
added test in this stage is the hash-agreement spec (about 12 seconds alone). Whether the lane fits the CI time budget is
unmeasured here: the workflow allows 30 minutes for build, lane, packaging and smoke, and CI uses 2 workers.

The run launches the built Electron app (`out/main/index.js`, release build, debug-only commands rejected), not an
electron-builder packaged artefact; `smoke:packaged` covers the packaged artefact separately.

## Carve-out: fought battles (#422)

No production route reaches a battle offer, an ACTIVE war or a fought battle, so battles are not in the acceptance run. The
three rows accept-peace, fight-or-decline-battle and combat-fought-battle are `dormant-by-decision` (#422), with no
`battle.spec.ts`. `read-battle-history` is driven on its empty state only. The evidence chain (a declared war stays
DECLARED_NOT_ACTIVE; only a fought battle makes it ACTIVE; `generateBattles` needs 300 or 150 eligible firepower per side in one
area; the 1880 world and the AI never exceed 42 in any area over 240 months) is in `ui-acceptance-stage-0.md` under Findings.
Unblocking needs an owner decision on thresholds or content; then the three rows return to `reachable` and get steps.

## Epic #220 acceptance bullets

| Bullet                                                                          | Status                                          | Evidence                                                                                                                                                                                           |
| ------------------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The ledger exists, is gated in `pnpm check`, and has no unclassified capability | Met                                             | `check:reachability-ledger` is in `check:steps` and preflight; 0 unclassified.                                                                                                                     |
| Each sub-issue is closed or has a recorded decision deferring it                | Met per the orchestrator's status               | #225, #226, #228, #221, #222 closed; #223 and #224 decided; #227 is this work. Observed in this branch: only the ledger and the e2e lane. Issue state was not re-read from GitHub for this report. |
| A packaged-app run reaches every capability the ledger lists as `reachable`     | Met for the 32 reachable rows, with a carve-out | Every one has a driven step. The run uses the built app, not an electron-builder artefact. Battles are carved out through #422 (dormant, not reachable) rather than driven.                        |

Acceptance criteria of the brief: every `reachable` row has a step and a table (met); a check fails on an unmapped row (met,
`verify-ui-acceptance-map`); the run is green twice in two processes with equal UI and engine hashes (met, above); the report
quotes the ledger counts and the hash evidence (this file).
