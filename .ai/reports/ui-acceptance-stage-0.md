# UI acceptance run, stage 0: coverage map

Issue #227, brief `.ai/briefs/ui-acceptance-run.md`. Observed on `dev` plus the branch commits, 2026-10-30.

## Existing lane

`heavy pnpm test:e2e` on this branch: 39 passed, 0 failed, 1.2 minutes, 3 workers, exit 0. The lane is 11 spec files. Stages 1 to 3 added
the management, construction, rebuild and diplomacy specs; whether the lane still fits the CI time budget is not yet
known; the brief names that as a blocker.

`campaign-battle-drill.debug.spec.ts` is excluded from the default lane (`testIgnore: "**/*.debug.spec.ts"`) and needs the
debug build, so it does not count as a UI path.

## Method

Each `reachable` row in `scripts/data/reachability-ledger.json` is matched to the e2e steps that reach it. Matching was done
by reading the specs, not by instrumentation. Classes:

- **drives**: an e2e step performs the player verb through the UI and asserts the result. For a `read-*` row the verb is
  reading the screen, so a step that asserts real content, not only that a heading renders, is `drives`.
- **reads**: an e2e step only asserts that the screen renders. The verb is not performed.
- **none**: no default-lane step reaches the row.

Every step is named `test.step("reachable:<row-id>", ...)`, and `node scripts/verify-ui-acceptance-map.mjs`
(`pnpm check:ui-acceptance-map`, also a preflight gate) fails when a `reachable` row has no such step in a default-lane spec.

## Map

| Row                               | Class  | Spec                                                                                                                                                                    |
| --------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| start-new-game                    | drives | `mvp-loop` New Game                                                                                                                                                     |
| read-opening-briefing             | drives | `mvp-loop` New Game: all five briefing pages asserted (appointment names the nation, navy inventory, treasury, foreign intelligence, immediate concerns)                |
| read-campaign-overview            | drives | `mvp-loop` New Game: overview heading with the month, nation, treasury and an immediate priority                                                                        |
| advance-month                     | drives | `mvp-loop` Advance Month                                                                                                                                                |
| manage-campaign-files             | drives | `mvp-loop` Campaign menu; `continuance` load, recent, verify, replay, recover                                                                                           |
| move-fleet                        | drives | `mvp-loop` sail; `strategic-map`                                                                                                                                        |
| read-world-map                    | drives | `strategic-map` the Map lists the player fleets, foreign stations and unmodelled limits                                                                                 |
| assign-station                    | drives | `mvp-loop` foreign station                                                                                                                                              |
| set-ship-readiness                | drives | `mvp-loop` reserve                                                                                                                                                      |
| ship-readiness                    | drives | `mvp-loop` reserve                                                                                                                                                      |
| organise-divisions                | drives | `mvp-loop` organization (create and dissolve; flagship and doctrine not exercised)                                                                                      |
| submit-design                     | drives | `mvp-loop` design; `ship-types`                                                                                                                                         |
| order-construction                | drives | `construction` batch, submit, replace                                                                                                                                   |
| order-foreign-construction        | drives | `construction` foreign yard                                                                                                                                             |
| halt-or-resume-construction       | drives | `construction` halt                                                                                                                                                     |
| cancel-construction-project       | drives | `construction` project cancelled, shown as cancelled after the month, steering controls gone (the engine refunds 0, so no refund to assert)                             |
| read-priorities                   | drives | `status-strip` the Immediate priorities group offers a severity, title and destination; `mvp-loop` New Game                                                             |
| read-battle-history               | drives | `mvp-loop` Battles tab shows the empty state; no production route fills it, see Findings                                                                                |
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
| form-or-break-alliance            | drives | `diplomacy` alliance formed with the Netherlands and shown Allied, then broken and shown Neutral again                                                                  |
| form-or-break-non-aggression-pact | drives | `diplomacy` pact formed with Russia and shown as NAP, then broken                                                                                                       |
| declare-blockade                  | drives | `diplomacy` blockade of the chosen area listed on the war front and the dossier, war score changes after the month                                                      |

## Counts

32 reachable rows: 32 drives, 0 reads, 0 none. Stage 1 turned six `none` rows into `drives` (`management.spec.ts`); stage 2
turned five more (`construction.spec.ts`, `ship-rebuild.spec.ts`); stage 3 turned four more (`diplomacy.spec.ts`). Stage 4
found no production route to a battle, so accept-peace, fight-or-decline-battle and combat-fought-battle were reclassified
`dormant-by-decision` (#422) and left the table: the ledger now counts 32 reachable, 14 dormant-by-decision, 14 internal.
Stage 5a gave the five `read-*` rows content assertions, so none remain as `reads`.

## Gap list, in stage order

1. Stage 1, management: done. set-research-priority, set-budget-allocation, fund-special-training, hold-fleet-exercise,
   assign-or-relieve-officer and persist-ui-state are driven in `management.spec.ts`.
2. Stage 2, construction: done. accelerate-construction, authorize-dock-expansion, cancel-construction-project,
   start-rebuild and revise-project are driven. revise-project was unreachable (`DrawingBoardDialog` was imported by no
   screen); the slipways inspector now has a Revise control, shown only for a player-designed project the engine can
   revise, that opens the drawing board on that project.
3. Stage 3, diplomacy: done for four rows. declare-war, form-or-break-alliance, form-or-break-non-aggression-pact and
   declare-blockade are driven in `diplomacy.spec.ts`.
4. Stage 4, battle: not drivable. No production route reaches a battle offer, so accept-peace, fight-or-decline-battle and
   combat-fought-battle are `dormant-by-decision` (#422) and no `battle.spec.ts` exists. Unblocking needs an owner decision
   on thresholds or content (#422); when it lands, restore the three rows and drive them.
5. Stage 5a: done. The five `read-*` rows assert real content, every `reachable` row carries a
   `test.step("reachable:<row-id>", ...)`, and `scripts/verify-ui-acceptance-map.mjs` enforces the mapping.
6. Stage 5b: the two-process hash comparison and `.ai/reports/ui-reachability.md`.

## Findings for the brief

- cancel-construction-project: the ledger verb said "take the refund", but the engine settles a cancellation with
  `refundedAmount` 0 (work done is forfeited) and the button tooltip says so. The ledger verb now says the work is forfeited
  and nothing is refunded; the step asserts the visible outcome only.
- start-rebuild: the Rebuild tab unmounts when the player switches to another design tab, which drops the loaded ship. The
  only in-panel edit is the bulge action, so the step drives a bulge rebuild.

- Stage 4 outcome: no production route to a battle offer, an ACTIVE war, or a fought battle. Issue #422. The three rows
  accept-peace, fight-or-decline-battle and combat-fought-battle are reclassified `dormant-by-decision` and are not in the
  map table. The epic's packaged-app acceptance cannot include fought battles, accepted or declined offers, or accepted
  peace until #422 is resolved by an owner decision.
- Evidence chain. `applyDeclareWar` creates a war DECLARED_NOT_ACTIVE (`diplomacy.ts:97`); the only code that sets ACTIVE
  is `applyBattleResult` (`battles.ts:113-115`); Accept peace needs ACTIVE (`validateAcceptPeace`,
  `diplomacyValidation.ts:105`; `WarFront.tsx`). A declared war does create battle opportunities for two nations with ships
  in one area (`opportunity.ts`), but `generateBattles` rejects an opportunity unless each side's eligible firepower in the
  area is at least 300 (fleet battle) or 150 (cruiser battle) (`mission.ts:38-39`, `pipeline.ts:256-260`); only the two
  nations' own ships count. Built ships get `mainGunsCount * floor(caliber / 100000)` firepower
  (`constructionPhase.ts:238`).
- Measurement, production composition (`compileCampaignProgram` then `resolveTurnProgram` per month, no player orders,
  scratch probe in `/tmp/epic220`, not committed). The 1880 start holds at most 50 firepower per nation in total and 34 in
  one area (UK); every other nation 12 to 26. The AI only plans budget, research and construction (`aiPlanner.ts`,
  `aiProcurement.ts`): it never declares war and never moves a fleet. Over 240 months the largest firepower any nation
  holds in one area is 42 (Italy, month 80); France 24, Russia 36, Ottoman Empire 40; no war ever started. Six option
  variants over 120 months (generated legacy fleet, historical budget, very_large fleet size, alternate continuity, fast
  research, four player nations, hard difficulties) gave the same maximum of 42. The player's own strength does not help,
  because the enemy side cannot reach 150 in any area.
- Routes ruled out: concentrating all fleets and sailing to an enemy area (the enemy side stays under threshold); declaring
  on other nations (every nation is under threshold); waiting many months (AI growth saturates at 42); AI-initiated wars
  (the AI never declares); other nations, archetypes and the new-game options (no variant changed the world); the
  `seedCampaignBattleDrill` command (debug build only, `debugGate.ts`).
- read-battle-history is `drives` on its empty state only: no production route puts an entry in the history, so a populated
  entry cannot be asserted until #422 is resolved.
- declare-blockade is driven during a Declared war; the blockade adds war score each month even though the war is not ACTIVE.
- The mapping check cannot rely on spec titles, so each step carries an explicit row id, `test.step("reachable:<row-id>", ...)`.
  `scripts/verify-ui-acceptance-map.mjs` fails on a `reachable` row without a default-lane step, a step that names a
  non-`reachable` row, and a row claimed only by a `*.debug.spec.ts`.
