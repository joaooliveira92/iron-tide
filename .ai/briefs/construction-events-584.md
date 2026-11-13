# Task brief: Builds suffer delays and cost overruns the player is told the cause of

```yaml
task:
  id: "#584"
  objective: "A player advancing months sees an in-progress build slip or cost more, and the Build tab and turn report name the cause and the amount"
  repository: "joaooliveira92/iron-tide"
  target_branch: "dev"
  working_branch: "feat/issue-584-construction-events"
  worktree: ".worktrees/issue-584-construction-events"
  risk: "high"
  pull_request: null
  pr_authorized: true
  merge_authorized: false
  validation:
    - "pnpm verify:affected"
    - "pnpm preflight"
    - "pnpm test:scripts"
    - "pnpm check"
    - "pnpm check:balance-reports"
    - "pnpm snap (Seen)"
```

## Status on dev (2026-11-13)

All five slices shipped (#641, #644, #658, #662, #679, #688, #697) and every acceptance criterion is met. The issue body is stale: its "Blocked by" line and its UNVERIFIED event-engine note are resolved (see Evidence). The YAML above names the original working branch; slice 5 used `feat/issue-584-cause-wording`.

| Item                                                                           | State                          | Evidence on dev                                                                                                                                                                     |
| ------------------------------------------------------------------------------ | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Content section, schema, parity (AC4 schema half)                              | shipped                        | `content-schema/src/construction-event.ts`, `construction-event.test.ts` (#641)                                                                                                     |
| Compiler diagnostics (AC4)                                                     | shipped                        | `content-compiler/test/constructionEventCollection.test.ts`, DELAY-row diagnostics (#662)                                                                                           |
| Delay draw, `delayReasonCode`, `ConstructionDelayed` (AC1, 2, 3)               | shipped                        | `phase-engine/src/constructionEvents.ts`, `packages/events` validation (#644, #662)                                                                                                 |
| Overrun draw, remaining-work rule, cap, `ConstructionOverrun` (AC2, 3)         | shipped                        | `phase-engine/src/constructionOverrun.ts`, `construction-overrun.test.ts` (#658)                                                                                                    |
| Six-kind PROVISIONAL catalogue, multi-month delays, capacity-pressure doubling | shipped                        | `content/production/1880/construction-events.ts` (#662)                                                                                                                             |
| Measured (AC7)                                                                 | shipped                        | `docs/research/p6-construction-events.md`, gated by `check:balance-reports`: 8 seeds, 60 months, 1.95 delays and 1.61 overruns per hundred project-months, 18 of 47 deliveries late |
| Replay and cross-process hash (AC1)                                            | shipped                        | `replay-construction-events.test.ts`                                                                                                                                                |
| Reachability row (AC8)                                                         | shipped, `dormant-by-decision` | `scripts/data/reachability-ledger.json`, id `construction-events`                                                                                                                   |
| Goldens repinned with cause (AC9)                                              | shipped per slice              | commit bodies of 6b83c421 and cc8cf322                                                                                                                                              |
| Inspector cause list, newest first (AC5, 6)                                    | shipped                        | `project-causes.ts`, `ProjectReadout.test.tsx` (#688)                                                                                                                               |
| Turn report cause and amount (AC5)                                             | shipped                        | `construction-message-text.ts`, `TurnSummaryPanel.test.tsx` (#688)                                                                                                                  |
| Cause wording authored in the content catalogue                                | shipped                        | `content/production/1880/ui/en-US.yaml` keys `construction.cause.*`, `construction.event.*` (#697)                                                                                  |
| Unpayable overrun adds no payment-default delay                                | shipped                        | `construction-acceleration.test.ts` with `test/helpers/constructionFixtures.ts` (#697)                                                                                              |
| `pnpm snap` showing cause text (AC10)                                          | met, after-only                | live strict runs of the built app, quoted under AC10 evidence below                                                                                                                 |
| Good-news events, ship-class scaling, player responses                         | deferred by decision           | out of scope below                                                                                                                                                                  |

Blockers: none. #563 (events and prestige slice 1) is a different engine path and was never needed; #223 was a closed readout ticket.

### AC10 evidence (2026-11-13)

Built desktop, `pnpm snap --strict --freeze --make-save <dir>`: Build, Design catalog, Order, quantity 2, Place order, then advance. A fresh campaign draws its own seed, so each run differs; each capture below is a separate run with no snap problems recorded.

- Project inspector after 36 months, Cost and schedule: "September 1882: a rise in the price of materials added 1 NC to the cost" above "July 1880: rework of faulty workmanship added 7 NC to the cost", newest first, total cost 102 NC.
- Turn report after 7 months, category Construction, "Construction cost overrun": "A build's cost rose by 3 NC from July 1880: rework of faulty workmanship."

Before and after is waived: #697 showed the Slipways stage text identical before and after the wording move, and cause lines cannot exist on a pre-#688 checkout.

### Decisions on the former open questions

1. Slice 5 repinned now (owner approved, #697).
2. AC10 accepted after-only, as above.
3. #584 closes with the PR that records this status.
4. An overrun the treasury cannot pay is recorded and adds no payment-default delay; the test shipped in #697.

## Problem

Nothing ever goes wrong or right during a build. A project can be `DELAYED`, but the player is not told why, and cost never moves after the order is placed. Builds read as a timer, not as ships made by yards, suppliers and weather.

## Evidence

- Delay causes today are three and narrow: acceleration capacity pressure (`phase-engine/src/constructionAcceleration.ts`), payment default (`economyPhases.ts`), foreign-contract war hold (`foreignContractPhase.ts`). The code is carried on `delayReasonCode` (`campaign/src/state.ts`, optional string) and shown only inside `not building (...)` in `ProjectReadout.tsx`.
- No overrun mechanism exists: `totalWork` changes only for the one-time acceleration premium.
- Verified for this brief: the event engine is diplomatic. `content-schema/src/event.ts` defines gates (government, era window, tension counterpart, traits, flags) and answers that are `hawk | dove | neutral` with effects limited to `budgetBp`, `prestige`, `unrest`, `tension`, `setFlag`. It has no project trigger and no effect that can act on a construction project. `applyEventsForMonth` runs from `runDiplomacyPhase`, a nation-level phase, with stream `events/<nation>/<month>`.
- So construction events cannot be added as new rows of the diplomatic catalogue. They need their own small content section and draw.
- Delivery already emits a ledger event (`ShipDelivered`, #624, `packages/events`); the new events follow that envelope.
- Slice 1 of events and prestige (#563) is a different engine path (dilemma suspension). This ticket needs none of it.

## Constraints and non-goals

- Determinism: draws use a new domain-separated stream family, e.g. `construction-events/<nation>/<project>/<month>`; integer basis-point maths; no `Math.random`, wall-clock or `process.env`.
- Content-driven: kinds, frequencies and magnitudes live in `content/production/1880`, marked PROVISIONAL. No gameplay numbers in code.
- Strict decoding: new content section uses Effect Schema with excess-property errors and a compiler-stage diagnostic for malformed rows.
- Wire formats: an added project field or event kind needs a parity test from existing fixtures; follow the compat-bump checklist in the repo notes only if the save shape changes.
- Out of scope: prestige effects, Navy League and Kaiser demands (#589), player-chosen responses, strikes or sabotage storylines, foreign-built projects (their holds stay as they are), the diplomatic event catalogue (#563, #429).

## Acceptance criteria

1. A seeded campaign month draws at least one delay and one overrun on in-progress projects; each records a cause code and amount; two runs with the same seed hash identically.
2. Engine: a delay adds N months through the existing delay path; an overrun adds X percent to remaining work only, never to work already done; neither can fire on `PLANNED`, `HALTED`, `COMPLETED` or `CANCELLED` projects, nor twice on one project in one month.
3. Appended events `ConstructionDelayed` and `ConstructionOverrun` carry project id, cause code, and amount, and validate in `packages/events`.
4. Content schema parity test from existing fixtures; compiler diagnostics test for an unknown trigger, a negative magnitude and a missing cause text key.
5. Build tab project inspector and the monthly turn report show the cause in plain words and the amount; no raw code or `YYYY-MM` appears (same regex tests as `construction-labels.test.ts`).
6. Explainable: the inspector lists each cause that has hit the project, newest first.
7. Measured: the frequency claim cites a generated balance report (`pnpm check:balance-reports`); a 60-month passive run reports delays and overruns per hundred project-months and the share of projects late at delivery.
8. Reachability ledger: the new rows are `dormant-by-decision` (no player decision), or a row with evidence tests if a response is added later.
9. Goldens repinned with a stated cause per `docs/agents/golden-repinning.md`.
10. `pnpm snap` before and after on the Slipways stage and project inspector.

## Approach

`agent decides`. The owner approved every bracketed recommendation below on 2026-11-09, so build without returning for those answers. Numbers stay PROVISIONAL and are tuned from the balance report. Tracer-bullet slices:

1. One delay kind end to end: content row, schema, draw, `delayReasonCode`, event, inspector text. Goldens repinned.
2. One overrun kind end to end, with the remaining-work rule.
3. Fill a modest catalogue (about 6 kinds, grouped as materials, labour, design change, weather or yard), frequencies tuned from the balance report.
4. Turn-report projection and the cause list.

Design decisions, approved by the owner as recommended (bracketed):

- Rate shape: per project-month probability in basis points, scaled by yard capacity pressure and ship class tonnage? [flat base rate, modified by one factor: capacity pressure above 100 percent doubles the delay chance]
- Magnitudes: delay 1 to 3 months, overrun 2 to 10 percent of remaining work? [yes, PROVISIONAL]
- Ceiling: cap cumulative overrun at 30 percent of original `totalWork` so a ship cannot snowball? [yes]
- Good news: any early-finish or underrun events? [no in this ticket; add after the bad-news path is measured]
- Foreign contracts and rebuilds: included? [home builds and rebuilds yes, foreign contracts no]
- Does the treasury absorb an overrun automatically through the existing payment path, or does an unpaid overrun feed the payment-default delay? [automatic through the existing path; no new payment rule]

## Required tests

- Regression: the existing delay causes still record their codes and text after the change.
- Seeded draw triggers a delay and an overrun; cause and amount recorded; replay hashes identical across runs and across the cross-process child.
- Eligibility: no draw on ineligible statuses; one hit per project per month; cumulative cap holds.
- Compiler: malformed construction-event rows fail with named diagnostics.
- Renderer: every cause code renders plain text with the amount; no raw enum.

## Expected artifacts

Balance report under the repo's report location, `pnpm snap` before and after screenshots, golden-repin note, PR link.

## Delivery authority

- Pull request: `draft at first push, ready when gates pass`.
- Merge: `not authorized`. Independent review required before `ready-to-merge` (high risk, golden movement).

## Blockers that need a human

The permanent stop conditions in `AGENTS.md`, plus: any golden hash that moves without an understood cause; a save-shape change that migrates authoritative outcomes.

## Downstream work

Investigate, implement slice by slice, test, validate, open the draft PR, review, supervise CI. See [task lifecycle](../../docs/agents/task-lifecycle.md).

## Rollback

Revert the branch. Removing the construction-events content section returns the draw to a no-op, so builds behave as before.
