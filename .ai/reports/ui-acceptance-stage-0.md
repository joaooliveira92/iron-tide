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

| Row                               | Class  | Spec                                                                                                                                                                    |
| --------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| start-new-game                    | drives | `mvp-loop` New Game                                                                                                                                                     |
| read-opening-briefing             | reads  | `mvp-loop` New Game (clicks through the briefing, asserts nothing on it)                                                                                                |
| read-campaign-overview            | reads  | `mvp-loop` New Game                                                                                                                                                     |
| advance-month                     | drives | `mvp-loop` Advance Month                                                                                                                                                |
| manage-campaign-files             | drives | `mvp-loop` Campaign menu; `continuance` load, recent, verify, replay, recover                                                                                           |
| move-fleet                        | drives | `mvp-loop` sail; `strategic-map`                                                                                                                                        |
| read-world-map                    | reads  | `strategic-map`                                                                                                                                                         |
| assign-station                    | drives | `mvp-loop` foreign station                                                                                                                                              |
| set-ship-readiness                | drives | `mvp-loop` reserve                                                                                                                                                      |
| ship-readiness                    | drives | `mvp-loop` reserve                                                                                                                                                      |
| organise-divisions                | drives | `mvp-loop` organization (create and dissolve; flagship and doctrine not exercised)                                                                                      |
| submit-design                     | drives | `mvp-loop` design; `ship-types`                                                                                                                                         |
| order-construction                | drives | `construction` batch, submit, replace                                                                                                                                   |
| order-foreign-construction        | drives | `construction` foreign yard                                                                                                                                             |
| halt-or-resume-construction       | drives | `construction` halt                                                                                                                                                     |
| cancel-construction-project       | drives | `construction` project cancelled, shown as cancelled after the month, steering controls gone (the engine refunds 0, so no refund to assert)                             |
| read-priorities                   | reads  | `status-strip`                                                                                                                                                          |
| read-battle-history               | reads  | `mvp-loop` empty history only                                                                                                                                           |
| persist-ui-state                  | drives | `management` preference and guided inspection survive restarts                                                                                                          |
| set-research-priority             | drives | `management` research priority queued, holds after the month                                                                                                            |
| fund-special-training             | drives | `management` special training funded, accrues a month                                                                                                                   |
| hold-fleet-exercise               | drives | `management` annual exercise ordered, then marked held                                                                                                                  |
| assign-or-relieve-officer         | drives | `management` commander relieved, then assigned                                                                                                                          |
| set-budget-allocation             | drives | `management` budget allocation queued, research spend changes next month                                                                                                |
| revise-project                    | drives | `construction` revise: a player-designed project is opened from the slipways Revise control, redesigned on the drawing board, queued, and shown on hold after the month |
| start-rebuild                     | drives | `ship-rebuild` corvette designed, ordered, built, rebuilt with a bulge; ship leaves the rebuildable list after the month                                                |
| accelerate-construction           | drives | `construction` accelerate, status accelerated after the month                                                                                                           |
| authorize-dock-expansion          | drives | `construction` dock expansion queued, new infrastructure project on the slipways after the month                                                                        |
| declare-war                       | drives | `diplomacy` war declared on France, shown as Declared with the score bar and an At war rail entry after the month                                                       |
| accept-peace                      | none   | BLOCKED: no production path makes a war ACTIVE, see Findings                                                                                                            |
| form-or-break-alliance            | drives | `diplomacy` alliance formed with the Netherlands and shown Allied, then broken and shown Neutral again                                                                  |
| form-or-break-non-aggression-pact | drives | `diplomacy` pact formed with Russia and shown as NAP, then broken                                                                                                       |
| declare-blockade                  | drives | `diplomacy` blockade of the chosen area listed on the war front and the dossier, war score changes after the month                                                      |
| fight-or-decline-battle           | none   | debug spec only                                                                                                                                                         |
| combat-fought-battle              | none   | debug spec only                                                                                                                                                         |

## Counts

35 reachable rows: 27 drives, 5 reads, 3 none. Stage 1 turned six `none` rows into `drives`
(`management.spec.ts`); stage 2 turned five more (`construction.spec.ts`, `ship-rebuild.spec.ts`); stage 3 turned four more
(`diplomacy.spec.ts`). The 3 remaining `none` rows are accept-peace (BLOCKED, see Findings) and the two battle rows, whose
route is the same blocker. The `reads` rows still need real content assertions.

## Gap list, in stage order

1. Stage 1, management: done. set-research-priority, set-budget-allocation, fund-special-training, hold-fleet-exercise,
   assign-or-relieve-officer and persist-ui-state are driven in `management.spec.ts`.
2. Stage 2, construction: done. accelerate-construction, authorize-dock-expansion, cancel-construction-project,
   start-rebuild and revise-project are driven. revise-project was unreachable (`DrawingBoardDialog` was imported by no
   screen); the slipways inspector now has a Revise control, shown only for a player-designed project the engine can
   revise, that opens the drawing board on that project.
3. Stage 3, diplomacy: done for four rows. declare-war, form-or-break-alliance, form-or-break-non-aggression-pact and
   declare-blockade are driven in `diplomacy.spec.ts`. accept-peace is BLOCKED (see Findings).
4. Stage 4, battle: fight-or-decline-battle, combat-fought-battle, read-battle-history with a fought battle.
5. Upgrade the `reads` rows to assertions on real content: read-opening-briefing, read-priorities, read-battle-history.

## Findings for the brief

- cancel-construction-project: the ledger verb says "take the refund", but the engine settles a cancellation with
  `refundedAmount` 0 (work done is forfeited) and the button tooltip says so. The step asserts the visible outcome only.
- start-rebuild: the Rebuild tab unmounts when the player switches to another design tab, which drops the loaded ship. The
  only in-panel edit is the bulge action, so the step drives a bulge rebuild.

- accept-peace: BLOCKED, and the cause is shared with stage 4. The Accept peace control is shown only for a war with status
  ACTIVE (`WarFront.tsx`, `diplomacyBeginPeace`), and the engine validator also requires ACTIVE
  (`validateAcceptPeace`). `applyDeclareWar` creates a war as DECLARED_NOT_ACTIVE; the only code that sets ACTIVE is
  `applyBattleResult`, i.e. a resolved battle. Battle generation rejects an opportunity unless both sides field eligible
  firepower of at least 300 (fleet battle) or 150 (cruiser battle) in one area (`pipeline.ts`, `mission.ts`). Observed in a
  UI campaign: UK 1880 fleets total 16 to 34 firepower per area, every other nation 12 to 26; after 36 advanced months the
  strongest foreign fleet was 50 (Ottoman Empire). The UK Home Fleet, sailed through the Fleet screen to the French
  Channel coast during a declared war, produced no battle and the war stayed Declared for five months. No AI
  nation declares war on the player, and a surrender settles through `settleWar`, not Accept peace. So no production
  start state reaches an acceptable peace without an engine, content or balance change.
- Stage 4 is the risk the brief names, and accept-peace now confirms it: the battle offer has no production route in a
  fresh campaign for the same firepower reason. The only battle e2e is the debug spec, which seeds a drill through the
  debug bridge, so a production route to an offer is unproven by any default-lane test.
- declare-blockade is driven during a Declared war; the blockade adds war score each month even though the war is not ACTIVE.
- A mapping check (stage 5) cannot rely on spec titles. It needs an explicit row id on each step, for example a
  `test.step("reachable:set-research-priority", ...)` convention.
