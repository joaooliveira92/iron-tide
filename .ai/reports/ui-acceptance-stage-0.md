# UI acceptance run, stage 0: coverage map

Issue #227, brief `.ai/briefs/ui-acceptance-run.md`. Observed on `dev` plus the branch commits, 2026-10-30.

## Existing lane

`heavy pnpm test:e2e` on this branch: 39 passed, 0 failed, 1.2 minutes, 3 workers, exit 0. The lane is 11 spec files. Whether
the 18 uncovered rows fit the CI time budget is not yet known; the brief names that as a blocker.

`campaign-battle-drill.debug.spec.ts` is excluded from the default lane (`testIgnore: "**/*.debug.spec.ts"`) and needs the
debug build, so it does not count as a UI path.

## Method

Each `reachable` row in `scripts/data/reachability-ledger.json` is matched to the e2e steps that reach it. Matching was done
by reading the specs, not by instrumentation. Classes:

- **drives**: an e2e step performs the player verb through the UI and asserts the result.
- **reads**: an e2e step only asserts that the screen renders. The verb is not performed.
- **none**: no default-lane step reaches the row.

## Map

| Row                               | Class  | Spec                                                                                                                                                                  |
| --------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| start-new-game                    | drives | `mvp-loop` New Game                                                                                                                                                   |
| read-opening-briefing             | reads  | `mvp-loop` New Game (clicks through the briefing, asserts nothing on it)                                                                                              |
| read-campaign-overview            | reads  | `mvp-loop` New Game                                                                                                                                                   |
| advance-month                     | drives | `mvp-loop` Advance Month                                                                                                                                              |
| manage-campaign-files             | drives | `mvp-loop` Campaign menu; `continuance` load, recent, verify, replay, recover                                                                                         |
| move-fleet                        | drives | `mvp-loop` sail; `strategic-map`                                                                                                                                      |
| read-world-map                    | reads  | `strategic-map`                                                                                                                                                       |
| assign-station                    | drives | `mvp-loop` foreign station                                                                                                                                            |
| set-ship-readiness                | drives | `mvp-loop` reserve                                                                                                                                                    |
| ship-readiness                    | drives | `mvp-loop` reserve                                                                                                                                                    |
| organise-divisions                | drives | `mvp-loop` organization (create and dissolve; flagship and doctrine not exercised)                                                                                    |
| submit-design                     | drives | `mvp-loop` design; `ship-types`                                                                                                                                       |
| order-construction                | drives | `construction` batch, submit, replace                                                                                                                                 |
| order-foreign-construction        | drives | `construction` foreign yard                                                                                                                                           |
| halt-or-resume-construction       | drives | `construction` halt                                                                                                                                                   |
| cancel-construction-project       | drives | `construction` project cancelled, shown as cancelled after the month, steering controls gone (the engine refunds 0, so no refund to assert)                           |
| read-priorities                   | reads  | `status-strip`                                                                                                                                                        |
| read-battle-history               | reads  | `mvp-loop` empty history only                                                                                                                                         |
| persist-ui-state                  | drives | `management` preference and guided inspection survive restarts                                                                                                        |
| set-research-priority             | drives | `management` research priority queued, holds after the month                                                                                                          |
| fund-special-training             | drives | `management` special training funded, accrues a month                                                                                                                 |
| hold-fleet-exercise               | drives | `management` annual exercise ordered, then marked held                                                                                                                |
| assign-or-relieve-officer         | drives | `management` commander relieved, then assigned                                                                                                                        |
| set-budget-allocation             | drives | `management` budget allocation queued, research spend changes next month                                                                                              |
| revise-project                    | none   | BLOCKED: `RevisionPanel` is only mounted by `DrawingBoard`, which only the unmounted `DrawingBoardDialog` renders; the shipbuilding workspace has no revision control |
| start-rebuild                     | drives | `ship-rebuild` corvette designed, ordered, built, rebuilt with a bulge; ship leaves the rebuildable list after the month                                              |
| accelerate-construction           | drives | `construction` accelerate, status accelerated after the month                                                                                                         |
| authorize-dock-expansion          | drives | `construction` dock expansion queued, new infrastructure project on the slipways after the month                                                                      |
| declare-war                       | none   | debug spec only                                                                                                                                                       |
| accept-peace                      | none   |                                                                                                                                                                       |
| form-or-break-alliance            | none   |                                                                                                                                                                       |
| form-or-break-non-aggression-pact | none   |                                                                                                                                                                       |
| declare-blockade                  | none   |                                                                                                                                                                       |
| fight-or-decline-battle           | none   | debug spec only                                                                                                                                                       |
| combat-fought-battle              | none   | debug spec only                                                                                                                                                       |

## Counts

35 reachable rows: 22 drives, 5 reads, 8 none (one of them BLOCKED). Stage 1 turned six `none` rows into `drives`
(`management.spec.ts`); stage 2 turned four more (`construction.spec.ts`, `ship-rebuild.spec.ts`). Stages 3 and 4 must turn
the remaining 8 `none` rows into `drives`, revise-project needs a production mount first, and the 5 `reads` rows get real
content assertions.

## Gap list, in stage order

1. Stage 1, management: done. set-research-priority, set-budget-allocation, fund-special-training, hold-fleet-exercise,
   assign-or-relieve-officer and persist-ui-state are driven in `management.spec.ts`.
2. Stage 2, construction: done except revise-project. accelerate-construction, authorize-dock-expansion,
   cancel-construction-project and start-rebuild are driven. revise-project is BLOCKED: `RevisionPanel` has no production
   mount (`DrawingBoardDialog` is imported by no screen), so the verb cannot be reached from the UI. It needs a decision:
   mount the panel in the shipbuilding workspace, or reclassify the row.
3. Stage 3, diplomacy: declare-war, accept-peace, form-or-break-alliance, form-or-break-non-aggression-pact,
   declare-blockade.
4. Stage 4, battle: fight-or-decline-battle, combat-fought-battle, read-battle-history with a fought battle.
5. Upgrade the `reads` rows to assertions on real content: read-opening-briefing, read-priorities, read-battle-history.

## Findings for the brief

- cancel-construction-project: the ledger verb says "take the refund", but the engine settles a cancellation with
  `refundedAmount` 0 (work done is forfeited) and the button tooltip says so. The step asserts the visible outcome only.
- start-rebuild: the Rebuild tab unmounts when the player switches to another design tab, which drops the loaded ship. The
  only in-panel edit is the bulge action, so the step drives a bulge rebuild.

- Stage 4 is the risk the brief names. The only battle e2e is the debug spec, so the production route to a battle offer
  is unproven by any default-lane test. Stage 4 starts by finding out whether a campaign reaches an offer without the
  debug build.
- A mapping check (stage 5) cannot rely on spec titles. It needs an explicit row id on each step, for example a
  `test.step("reachable:set-research-priority", ...)` convention.
